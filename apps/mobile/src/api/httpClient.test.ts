import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The device keychain, replaced by an in-memory map. The real
 * `tokenStorage.ts` runs on top of it, so these tests exercise the actual
 * save/read/clear logic rather than a stand-in for it.
 */
vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    getItemAsync: async (key: string) => store.get(key) ?? null,
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

// Mocked so importing the client does not pull in `expo-constants`.
vi.mock('../config', () => ({ config: { apiBaseUrl: 'https://api.test' } }));

const API = 'https://api.test';
const REFRESH_URL = `${API}/auth/refresh`;
const PROTECTED_URL = `${API}/profile`;

const ACCESS_1 = 'access-1';
const REFRESH_1 = 'refresh-1';
const ACCESS_2 = 'access-2';
const REFRESH_2 = 'refresh-2';

interface FetchCall {
  url: string;
  init: RequestInit;
}

/**
 * Fresh module registry per test: `httpClient` keeps the in-flight refresh in
 * module scope, and the fake keychain lives in the mock factory's closure, so
 * both have to be rebuilt to keep tests independent.
 */
async function loadClient() {
  vi.resetModules();
  const tokenStorage = await import('../auth/tokenStorage');
  await tokenStorage.saveTokens(ACCESS_1, REFRESH_1);
  const httpClient = await import('./httpClient');
  return { ...httpClient, ...tokenStorage };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const rotated = () => json(200, { accessToken: ACCESS_2, refreshToken: REFRESH_2 });
const apiError = (status: number, code: string) => json(status, { error: { code, message: code } });

/** Installs a `fetch` stub and records every call made through it. */
function stubFetch(handler: (url: string, init: RequestInit, calls: FetchCall[]) => unknown) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return handler(url, init, calls) as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const callsTo = (calls: FetchCall[], url: string) => calls.filter((call) => call.url === url);
const bearer = (call: FetchCall) =>
  (call.init.headers as Record<string, string> | undefined)?.Authorization;

/** 401 on the first attempt at the protected route, 200 on any later one. */
function expiredThenOk(url: string, init: RequestInit, calls: FetchCall[]): Response {
  if (url === REFRESH_URL) return rotated();
  return callsTo(calls, PROTECTED_URL).length === 1
    ? apiError(401, 'unauthorized')
    : json(200, { ok: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authedFetch — refresh on 401', () => {
  it('refreshes once and retries the request with the new access token', async () => {
    const { authedFetch } = await loadClient();
    const calls = stubFetch(expiredThenOk);

    const res = await authedFetch('/profile');

    expect(res.status).toBe(200);
    const attempts = callsTo(calls, PROTECTED_URL);
    expect(attempts).toHaveLength(2);
    expect(bearer(attempts[0])).toBe(`Bearer ${ACCESS_1}`);
    expect(bearer(attempts[1])).toBe(`Bearer ${ACCESS_2}`);
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(1);
  });

  it('presents the stored refresh token to the backend', async () => {
    const { authedFetch } = await loadClient();
    const calls = stubFetch(expiredThenOk);

    await authedFetch('/profile');

    const [refresh] = callsTo(calls, REFRESH_URL);
    expect(refresh.init.method).toBe('POST');
    expect(JSON.parse(refresh.init.body as string)).toEqual({ refreshToken: REFRESH_1 });
  });

  it('persists both rotated tokens, so the next refresh is not a replay', async () => {
    const { authedFetch, getAccessToken, getRefreshToken } = await loadClient();
    stubFetch(expiredThenOk);

    await authedFetch('/profile');

    await expect(getAccessToken()).resolves.toBe(ACCESS_2);
    await expect(getRefreshToken()).resolves.toBe(REFRESH_2);
  });

  it('replays the original method, body and headers on the retry', async () => {
    const { authedFetch } = await loadClient();
    const calls = stubFetch(expiredThenOk);

    await authedFetch('/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Ada Lovelace' }),
    });

    const retry = callsTo(calls, PROTECTED_URL)[1];
    expect(retry.init.method).toBe('PATCH');
    expect(retry.init.body).toBe(JSON.stringify({ fullName: 'Ada Lovelace' }));
    expect((retry.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('does not refresh a second time when the retry is also rejected', async () => {
    const { authedFetch } = await loadClient();
    const calls = stubFetch((url) =>
      url === REFRESH_URL ? rotated() : apiError(401, 'unauthorized'),
    );

    const res = await authedFetch('/profile');

    expect(res.status).toBe(401);
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(1);
    expect(callsTo(calls, PROTECTED_URL)).toHaveLength(2);
  });
});

describe('authedFetch — single-flight refresh', () => {
  it('refreshes once for several requests that expire together', async () => {
    const { authedFetch } = await loadClient();
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    const calls = stubFetch(async (url, _init, recorded) => {
      if (url === REFRESH_URL) {
        await refreshGate;
        return rotated();
      }
      return callsTo(recorded, url).length === 1
        ? apiError(401, 'unauthorized')
        : json(200, { ok: true });
    });

    const pending = Promise.all([
      authedFetch('/subjects'),
      authedFetch('/natal-chart'),
      authedFetch('/numerology'),
    ]);
    // A macrotask: every request has hit its 401 and is waiting on the refresh.
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRefresh();

    const responses = await pending;

    expect(responses.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(1);
  });

  it('retries without refreshing when the token was already rotated out', async () => {
    const { authedFetch, saveTokens } = await loadClient();
    const calls = stubFetch(async (url, _init, recorded) => {
      if (url === REFRESH_URL) return rotated();
      if (callsTo(recorded, PROTECTED_URL).length === 1) {
        // Another request refreshed while this one was in flight.
        await saveTokens(ACCESS_2, REFRESH_2);
        return apiError(401, 'unauthorized');
      }
      return json(200, { ok: true });
    });

    const res = await authedFetch('/profile');

    expect(res.status).toBe(200);
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(0);
    expect(bearer(callsTo(calls, PROTECTED_URL)[1])).toBe(`Bearer ${ACCESS_2}`);
  });
});

describe('authedFetch — refresh failure', () => {
  it('clears the session and reports unauthorized when the refresh token is rejected', async () => {
    const { authedFetch, ApiError, getAccessToken, getRefreshToken } = await loadClient();
    stubFetch((url) =>
      url === REFRESH_URL ? apiError(401, 'invalid_refresh_token') : apiError(401, 'unauthorized'),
    );

    await expect(authedFetch('/profile')).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(authedFetch('/profile')).rejects.toBeInstanceOf(ApiError);
    await expect(getAccessToken()).resolves.toBeNull();
    await expect(getRefreshToken()).resolves.toBeNull();
  });

  it('clears the session when there is no refresh token to present', async () => {
    const { authedFetch, saveTokens, getAccessToken } = await loadClient();
    await saveTokens(ACCESS_1, '');
    const calls = stubFetch(() => apiError(401, 'unauthorized'));

    await expect(authedFetch('/profile')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(0);
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('keeps the session when the refresh itself could not reach the server', async () => {
    const { authedFetch, getRefreshToken } = await loadClient();
    stubFetch((url) => {
      if (url === REFRESH_URL) throw new TypeError('Network request failed');
      return apiError(401, 'unauthorized');
    });

    // Offline is not a rejected session: signing the user out here would make a
    // tunnel ride cost them their login.
    await expect(authedFetch('/profile')).rejects.toMatchObject({ code: 'network_error' });
    await expect(getRefreshToken()).resolves.toBe(REFRESH_1);
  });

  it('keeps the session when the refresh endpoint returns a server error', async () => {
    const { authedFetch, getRefreshToken } = await loadClient();
    stubFetch((url) => (url === REFRESH_URL ? json(500, {}) : apiError(401, 'unauthorized')));

    await expect(authedFetch('/profile')).rejects.toMatchObject({ code: 'server_error' });
    await expect(getRefreshToken()).resolves.toBe(REFRESH_1);
  });
});

describe('authedFetch — responses that must pass through untouched', () => {
  it.each([
    ['403 forbidden', 403, 'forbidden'],
    ['422 incomplete profile', 422, 'incomplete_profile'],
    ['404 not found', 404, 'not_found'],
    ['500 server error', 500, 'internal_error'],
  ])('returns a %s to the caller without refreshing', async (_label, status, code) => {
    const { authedFetch } = await loadClient();
    const calls = stubFetch(() => apiError(status, code));

    const res = await authedFetch('/profile');

    expect(res.status).toBe(status);
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(0);
    expect(callsTo(calls, PROTECTED_URL)).toHaveLength(1);
  });

  it('returns a successful response without refreshing', async () => {
    const { authedFetch } = await loadClient();
    const calls = stubFetch(() => json(200, { ok: true }));

    await expect(authedFetch('/profile')).resolves.toMatchObject({ status: 200 });
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(0);
  });
});

describe('authedFetch — connectivity and missing session', () => {
  it('reports network_error and never refreshes when the request cannot be sent', async () => {
    const { authedFetch, isNetworkError } = await loadClient();
    const calls = stubFetch(() => {
      throw new TypeError('Network request failed');
    });

    const error = await authedFetch('/profile').catch((err: unknown) => err);

    // The offline layer keys on this to fall back to on-device calculation.
    expect(isNetworkError(error)).toBe(true);
    expect(callsTo(calls, REFRESH_URL)).toHaveLength(0);
  });

  it('reports network_error when the retry cannot be sent', async () => {
    const { authedFetch, isNetworkError } = await loadClient();
    stubFetch((url, _init, recorded) => {
      if (url === REFRESH_URL) return rotated();
      if (callsTo(recorded, PROTECTED_URL).length === 1) return apiError(401, 'unauthorized');
      throw new TypeError('Network request failed');
    });

    const error = await authedFetch('/profile').catch((err: unknown) => err);

    expect(isNetworkError(error)).toBe(true);
  });

  it('reports unauthorized without any request when no access token is stored', async () => {
    const { authedFetch, clearTokens } = await loadClient();
    await clearTokens();
    const calls = stubFetch(() => json(200, { ok: true }));

    await expect(authedFetch('/profile')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(calls).toHaveLength(0);
  });
});

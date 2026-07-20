import { afterEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../config', () => ({ config: { apiBaseUrl: 'https://api.test' } }));

const API = 'https://api.test';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The profile screens went through their own copy of `authedFetch`, which meant
 * they kept failing on an expired token after the shared client learned to
 * refresh (#86). These tests pin them to the shared behaviour.
 */
describe('profileApi — expired access token', () => {
  it('refreshes and retries instead of failing the profile fetch', async () => {
    vi.resetModules();
    const { saveTokens } = await import('../auth/tokenStorage');
    await saveTokens('access-1', 'refresh-1');
    const { getProfile } = await import('./profileApi');

    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url === `${API}/auth/refresh`) {
          return json(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });
        }
        return urls.filter((seen) => seen === `${API}/profile`).length === 1
          ? json(401, { error: { code: 'unauthorized', message: 'expired' } })
          : json(200, { userId: 'u1', displayName: 'Ada' });
      }),
    );

    await expect(getProfile()).resolves.toMatchObject({ userId: 'u1' });
    expect(urls).toContain(`${API}/auth/refresh`);
  });

  it('refreshes and retries a profile update, replaying the patch body', async () => {
    vi.resetModules();
    const { saveTokens } = await import('../auth/tokenStorage');
    await saveTokens('access-1', 'refresh-1');
    const { updateProfile } = await import('./profileApi');

    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        if (url === `${API}/auth/refresh`) {
          return json(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });
        }
        return calls.filter((call) => call.url === `${API}/profile`).length === 1
          ? json(401, { error: { code: 'unauthorized', message: 'expired' } })
          : json(200, { userId: 'u1', fullName: 'Ada Lovelace' });
      }),
    );

    await expect(updateProfile({ fullName: 'Ada Lovelace' })).resolves.toMatchObject({
      fullName: 'Ada Lovelace',
    });

    const retry = calls.filter((call) => call.url === `${API}/profile`)[1];
    expect(retry.init.method).toBe('PATCH');
    expect(retry.init.body).toBe(JSON.stringify({ fullName: 'Ada Lovelace' }));
    expect((retry.init.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
  });
});

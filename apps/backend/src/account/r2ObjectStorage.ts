import { createHash, createHmac } from 'node:crypto';
import type { ObjectStorage, StoredObject } from './objectStorage';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Full S3 endpoint override; defaults to the account's R2 S3 host. */
  endpoint?: string;
  /** Overridable for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable clock (epoch ms) for the request signature — defaults to `Date.now`. */
  now?: () => number;
}

const REGION = 'auto';
const SERVICE = 's3';
const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');

/**
 * {@link ObjectStorage} backed by Cloudflare R2 via its S3-compatible API,
 * signed with AWS Signature V4 (no SDK dependency). R2 uses region `auto`. The
 * export flow only needs authenticated PUT/GET/DELETE — the single-use, 24h
 * expiry semantics live in our own token store, not in a presigned URL.
 */
export class R2ObjectStorage implements ObjectStorage {
  private readonly host: string;
  private readonly origin: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly config: R2Config) {
    const endpoint = config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`;
    const url = new URL(endpoint);
    this.host = url.host;
    this.origin = `${url.protocol}//${url.host}`;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? Date.now;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.signedFetch('PUT', key, body, contentType);
    if (!res.ok) throw new Error(`R2 put failed: HTTP ${res.status}`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const res = await this.signedFetch('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 get failed: HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    return { body, contentType };
  }

  async delete(key: string): Promise<void> {
    const res = await this.signedFetch('DELETE', key);
    // 204 on success, 404 if already gone — both are fine.
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: HTTP ${res.status}`);
  }

  private async signedFetch(
    method: 'GET' | 'PUT' | 'DELETE',
    key: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<Response> {
    const canonicalUri = `/${this.config.bucket}/${encodeKey(key)}`;
    const payloadHash = body ? createHash('sha256').update(body).digest('hex') : EMPTY_SHA256;
    const { amzDate, dateStamp } = formatDate(this.now());

    const headers: Record<string, string> = {
      host: this.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');

    const canonicalRequest = [
      method,
      canonicalUri,
      '', // canonical query string (none)
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = deriveSigningKey(this.config.secretAccessKey, dateStamp);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return this.fetchImpl(`${this.origin}${canonicalUri}`, {
      method,
      headers: { ...headers, Authorization: authorization },
      body: body ?? undefined,
    });
  }
}

/** Encode each path segment per RFC 3986, preserving the `/` separators. */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

function formatDate(epochMs: number): { amzDate: string; dateStamp: string } {
  const iso = new Date(epochMs).toISOString(); // 2026-07-18T12:00:00.000Z
  const amzDate = iso.replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20260718T120000Z
  const dateStamp = amzDate.slice(0, 8); // 20260718
  return { amzDate, dateStamp };
}

function deriveSigningKey(secret: string, dateStamp: string): Buffer {
  const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(REGION).digest();
  const kService = createHmac('sha256', kRegion).update(SERVICE).digest();
  return createHmac('sha256', kService).update('aws4_request').digest();
}

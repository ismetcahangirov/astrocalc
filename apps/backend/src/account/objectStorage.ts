/** A stored object's bytes plus its content type. */
export interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Persistence boundary for the export bundle blob store. Kept as an interface so
 * the export flow can be unit-tested against an in-memory store while production
 * uses Cloudflare R2 (see `r2ObjectStorage.ts`).
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

/** In-memory {@link ObjectStorage} for tests and local dev without R2. */
export class InMemoryObjectStorage implements ObjectStorage {
  private objects = new Map<string, StoredObject>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body: Buffer.from(body), contentType });
  }

  async get(key: string): Promise<StoredObject | null> {
    const obj = this.objects.get(key);
    return obj ? { body: Buffer.from(obj.body), contentType: obj.contentType } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  // --- test helper ---
  size(): number {
    return this.objects.size;
  }
}

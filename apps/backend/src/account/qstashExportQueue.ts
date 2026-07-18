import type { ExportQueue } from './exportQueue';

export interface QStashConfig {
  /** Upstash QStash REST token. */
  token: string;
  /** Publicly reachable worker webhook QStash will POST the job to. */
  workerUrl: string;
  /** Secret forwarded to the worker so it can authenticate the callback. */
  workerSecret: string;
  /** Overridable for tests; defaults to the public QStash host. */
  baseUrl?: string;
  /** Overridable for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * {@link ExportQueue} backed by Upstash QStash. Publishing to
 * `POST /v2/publish/<workerUrl>` tells QStash to deliver `{ jobId }` to the
 * worker webhook (with at-least-once delivery + retries). The worker secret is
 * sent via `Upstash-Forward-Authorization`, which QStash relays to the
 * destination as a plain `Authorization` header.
 */
export class QStashExportQueue implements ExportQueue {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: QStashConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://qstash.upstash.io').replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async enqueue(jobId: string): Promise<void> {
    const url = `${this.baseUrl}/v2/publish/${this.config.workerUrl}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'Upstash-Forward-Authorization': `Bearer ${this.config.workerSecret}`,
      },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`QStash publish failed: HTTP ${res.status} ${detail}`.trim());
    }
  }
}

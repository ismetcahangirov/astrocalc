/**
 * Boundary for handing an export job off to be processed out-of-band. Production
 * publishes an Upstash QStash message (see `qstashExportQueue.ts`) which calls
 * the worker webhook back; local dev/tests use {@link InlineExportQueue} or a
 * fake.
 */
export interface ExportQueue {
  /** Schedule processing of the given export job. */
  enqueue(jobId: string): Promise<void>;
}

/** Runs the processor in-process. Used as the fallback when QStash is unset. */
export class InlineExportQueue implements ExportQueue {
  constructor(private readonly process: (jobId: string) => Promise<void>) {}

  async enqueue(jobId: string): Promise<void> {
    // Awaited so the fallback stays deterministic (fine for the small bundles a
    // single user produces). QStash is what provides true async + retries in
    // production.
    await this.process(jobId);
  }
}

/** Records enqueued job ids without processing them — for tests. */
export class FakeExportQueue implements ExportQueue {
  enqueued: string[] = [];

  async enqueue(jobId: string): Promise<void> {
    this.enqueued.push(jobId);
  }
}

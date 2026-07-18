import type { NatalChart } from '@astrocalc/calc-engine';
import type { KeyValueStore } from './keyValueStore';

/** Where a cached chart came from — the authoritative backend, or on-device compute. */
export type ChartSource = 'backend' | 'offline';

/** A chart persisted on the device, with the metadata the sync flow needs. */
export interface CachedChart {
  chart: NatalChart;
  /** Whether this was fetched from the backend or computed offline. */
  source: ChartSource;
  /**
   * `true` when this is an offline-computed chart that has not yet been pushed
   * up to the backend (issue #20, AC #3). Cleared once {@link syncNatalChart}
   * succeeds, or when the backend later returns its own authoritative chart.
   */
  pendingSync: boolean;
}

const STORAGE_KEY = 'astrocalc.natalChart';

/**
 * Persists the most-recently-known natal chart on the device and tracks whether
 * an offline-computed result still needs syncing up. Pure orchestration over an
 * injected {@link KeyValueStore}, so it is fully unit-testable without native
 * storage.
 */
export class OfflineChartCache {
  constructor(private readonly store: KeyValueStore) {}

  /** Overwrite the cached chart. */
  async save(entry: CachedChart): Promise<void> {
    await this.store.setItem(STORAGE_KEY, JSON.stringify(entry));
  }

  /** The cached chart, or `null` if none is stored or the stored value is corrupt. */
  async read(): Promise<CachedChart | null> {
    const raw = await this.store.getItem(STORAGE_KEY);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as CachedChart;
    } catch {
      // Corrupt/partial write — treat as absent rather than crashing the app.
      return null;
    }
  }

  /** The offline chart awaiting sync, or `null` if there's nothing pending. */
  async getPending(): Promise<NatalChart | null> {
    const entry = await this.read();
    return entry?.pendingSync ? entry.chart : null;
  }

  /** Mark the cached chart as synced (no-op when there's nothing pending). */
  async clearPending(): Promise<void> {
    const entry = await this.read();
    if (!entry || !entry.pendingSync) return;
    await this.save({ ...entry, pendingSync: false });
  }
}

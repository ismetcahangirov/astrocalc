import { describe, expect, it } from 'vitest';
import { describeExportStatus, isExportTerminal, type ExportJobStatus } from './exportStatus';

describe('describeExportStatus', () => {
  it('maps pending and processing to the same in-progress message', () => {
    expect(describeExportStatus('pending')).toBe('account.export.status.inProgress');
    expect(describeExportStatus('processing')).toBe('account.export.status.inProgress');
  });

  it('maps ready and failed to their own messages', () => {
    expect(describeExportStatus('ready')).toBe('account.export.status.ready');
    expect(describeExportStatus('failed')).toBe('account.export.status.failed');
  });
});

describe('isExportTerminal', () => {
  it('is false while pending or processing', () => {
    expect(isExportTerminal('pending')).toBe(false);
    expect(isExportTerminal('processing')).toBe(false);
  });

  it('is true once ready or failed', () => {
    expect(isExportTerminal('ready')).toBe(true);
    expect(isExportTerminal('failed')).toBe(true);
  });

  it('covers every ExportJobStatus', () => {
    const statuses: ExportJobStatus[] = ['pending', 'processing', 'ready', 'failed'];
    for (const status of statuses) {
      expect(typeof isExportTerminal(status)).toBe('boolean');
    }
  });
});

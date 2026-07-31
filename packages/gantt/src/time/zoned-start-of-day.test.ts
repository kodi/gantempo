import { describe, expect, it } from 'vite-plus/test';

import { zonedStartOfDay } from './zoned-start-of-day';

describe('zonedStartOfDay', () => {
  it('resolves explicit-zone day starts across spring and autumn DST changes', () => {
    const springStart = zonedStartOfDay('2026-03-29', 'Europe/Belgrade');
    const springEnd = zonedStartOfDay('2026-03-30', 'Europe/Belgrade');
    const autumnStart = zonedStartOfDay('2026-10-25', 'Europe/Belgrade');
    const autumnEnd = zonedStartOfDay('2026-10-26', 'Europe/Belgrade');

    expect(springStart).toBe(Date.UTC(2026, 2, 28, 23));
    expect(springEnd).toBe(Date.UTC(2026, 2, 29, 22));
    expect(springEnd! - springStart!).toBe(23 * 60 * 60 * 1_000);
    expect(autumnStart).toBe(Date.UTC(2026, 9, 24, 22));
    expect(autumnEnd).toBe(Date.UTC(2026, 9, 25, 23));
    expect(autumnEnd! - autumnStart!).toBe(25 * 60 * 60 * 1_000);
  });

  it('rejects malformed dates and dates skipped entirely by a zone transition', () => {
    expect(zonedStartOfDay('2026-02-30', 'UTC')).toBeUndefined();
    expect(zonedStartOfDay('2011-12-30', 'Pacific/Apia')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vite-plus/test';

import { generateFixedIntervalTicks } from './fixed-interval-ticks';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('generateFixedIntervalTicks', () => {
  it('aligns elapsed-time ticks to an explicit anchor and excludes the range end', () => {
    const anchor = Date.UTC(2026, 6, 29);
    const ticks = generateFixedIntervalTicks({
      anchor,
      interval: 7 * DAY,
      locale: 'en-US',
      range: { start: anchor + DAY, end: anchor + 22 * DAY },
      timeZone: 'UTC',
    });

    expect(ticks.map((tick) => tick.time)).toEqual([
      anchor + 7 * DAY,
      anchor + 14 * DAY,
      anchor + 21 * DAY,
    ]);
    expect(ticks.map((tick) => tick.label)).toEqual(['Aug 05', 'Aug 12', 'Aug 19']);
  });

  it('uses fixed elapsed durations rather than calendar-day arithmetic across DST', () => {
    const anchor = Date.UTC(2026, 2, 28, 12);
    const ticks = generateFixedIntervalTicks({
      anchor,
      interval: DAY,
      range: { start: anchor, end: anchor + 3 * DAY },
      timeZone: 'Europe/Belgrade',
    });

    expect(ticks).toHaveLength(3);
    expect(ticks[1]!.time - ticks[0]!.time).toBe(DAY);
    expect(ticks[2]!.time - ticks[1]!.time).toBe(DAY);
  });

  it('rejects invalid ranges, anchors, and intervals', () => {
    const base = {
      anchor: 0,
      interval: DAY,
      range: { start: 0, end: DAY },
      timeZone: 'UTC',
    };

    expect(() => generateFixedIntervalTicks({ ...base, interval: 0 })).toThrow(RangeError);
    expect(() => generateFixedIntervalTicks({ ...base, range: { start: DAY, end: DAY } })).toThrow(
      RangeError,
    );
    expect(() => generateFixedIntervalTicks({ ...base, anchor: Number.NaN })).toThrow(RangeError);
  });
});

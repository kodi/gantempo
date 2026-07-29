import { describe, expect, it } from 'vite-plus/test';

import { createLinearTimeScale } from './linear-time-scale';

describe('createLinearTimeScale', () => {
  it('maps boundaries, midpoints, and values outside the domain without clamping', () => {
    const scale = createLinearTimeScale({ start: -1000, end: 1000 }, { start: 0, end: 1 });

    expect(scale.timeToX(-1000)).toBe(0);
    expect(scale.timeToX(0)).toBe(0.5);
    expect(scale.timeToX(1000)).toBe(1);
    expect(scale.timeToX(2000)).toBe(1.5);
    expect(scale.xToTime(-0.5)).toBe(-2000);
  });

  it('round trips times before and after the Unix epoch', () => {
    const scale = createLinearTimeScale(
      { start: Date.UTC(1960, 0, 1), end: Date.UTC(1980, 0, 1) },
      { start: 100, end: 900 },
    );

    for (const time of [Date.UTC(1961, 6, 1), 0, Date.UTC(1979, 11, 31)]) {
      expect(scale.xToTime(scale.timeToX(time))).toBeCloseTo(time, 5);
    }
  });

  it('freezes metadata and rejects invalid inputs', () => {
    const scale = createLinearTimeScale({ start: 0, end: 10 }, { start: 0, end: 100 });

    expect(Object.isFrozen(scale)).toBe(true);
    expect(Object.isFrozen(scale.domain)).toBe(true);
    expect(() => createLinearTimeScale({ start: 1, end: 1 }, { start: 0, end: 1 })).toThrow(
      RangeError,
    );
    expect(() =>
      createLinearTimeScale({ start: 0, end: Number.POSITIVE_INFINITY }, { start: 0, end: 1 }),
    ).toThrow(RangeError);
    expect(() => scale.timeToX(Number.NaN)).toThrow(RangeError);
  });
});

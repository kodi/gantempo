import { describe, expect, it } from 'vite-plus/test';

import {
  normalizeNavigationDelta,
  pageTimeRange,
  pageVerticalViewport,
  shiftTimeRange,
  shiftTimeRangeByPixels,
  shiftVerticalViewport,
} from './viewport-navigation';

describe('viewport navigation math', () => {
  it('normalizes pixel, line, and page deltas and ignores unusable input', () => {
    const metrics = { lineSize: 18, pageSize: 600 };
    expect(normalizeNavigationDelta(5, 'pixel', metrics)).toBe(5);
    expect(normalizeNavigationDelta(-2, 'line', metrics)).toBe(-36);
    expect(normalizeNavigationDelta(0.5, 'page', metrics)).toBe(300);
    expect(normalizeNavigationDelta(Number.NaN, 'pixel', metrics)).toBe(0);
    expect(normalizeNavigationDelta(1, 'line', { lineSize: 0, pageSize: 600 })).toBe(0);
  });

  it('shifts semantic time without changing duration and rejects overflow', () => {
    expect(shiftTimeRange({ start: 100, end: 300 }, 50)).toEqual({
      start: 150,
      end: 350,
    });
    expect(shiftTimeRangeByPixels({ start: 100, end: 300 }, 250, 1_000)).toEqual({
      start: 150,
      end: 350,
    });
    expect(shiftTimeRangeByPixels({ start: 100, end: 300 }, 0, 1_000)).toBeUndefined();
    expect(shiftTimeRange({ start: Number.MAX_VALUE, end: Number.MAX_VALUE }, 1)).toBeUndefined();
    expect(shiftTimeRange({ start: 300, end: 100 }, 1)).toBeUndefined();
  });

  it('clamps direct and viewport-sized vertical navigation', () => {
    expect(shiftVerticalViewport(50, 80, 400, 100)).toBe(130);
    expect(shiftVerticalViewport(50, -80, 400, 100)).toBe(0);
    expect(shiftVerticalViewport(290, 80, 400, 100)).toBe(300);
    expect(pageVerticalViewport(0, 1, 400, 100, 20)).toBe(80);
    expect(pageVerticalViewport(80, -1, 400, 100, 20)).toBe(0);
    expect(pageVerticalViewport(0, 1, 400, 100, 100)).toBeUndefined();
  });

  it('pages time with a bounded overlap', () => {
    expect(pageTimeRange({ start: 0, end: 1_000 }, 1)).toEqual({
      start: 900,
      end: 1_900,
    });
    expect(pageTimeRange({ start: 0, end: 1_000 }, -1, 0.2)).toEqual({
      start: -800,
      end: 200,
    });
    expect(pageTimeRange({ start: 0, end: 1_000 }, 1, 1)).toBeUndefined();
  });
});

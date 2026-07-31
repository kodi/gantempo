import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import {
  TIME_SCALE_LEVELS,
  adjacentTimeScaleLevel,
  fitTimeRange,
  normalizeAdaptiveBounds,
  resolveAdaptiveScaleLevel,
  timeScaleLevelSpan,
  zoomRangeToLevel,
} from './adaptive-scale';
import { generateAdaptiveTimeTicks } from './adaptive-ticks';

describe('adaptive time scale', () => {
  it('orders semantic levels monotonically and clamps configured bounds', () => {
    expect(TIME_SCALE_LEVELS.map(timeScaleLevelSpan)).toEqual(
      TIME_SCALE_LEVELS.map(timeScaleLevelSpan).sort((left, right) => left - right),
    );
    expect(
      adjacentTimeScaleLevel('day', 'in', {
        kind: 'adaptive',
        maxLevel: 'month',
        minLevel: 'day',
      }),
    ).toBe('day');
    expect(
      resolveAdaptiveScaleLevel({ end: 1_000 * 60 * 60 * 24 * 365, start: 0 }, 960, {
        kind: 'adaptive',
        maxLevel: 'month',
      }),
    ).toBe('month');
    expect(
      normalizeAdaptiveBounds({ kind: 'adaptive', maxLevel: 'hour', minLevel: 'day' }),
    ).toEqual({ maxIndex: 2, minIndex: 2 });
  });

  it('preserves the exact anchor ratio across every level and repeated round trips', () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 6, min: 0 }),
        fc.double({ max: 1, min: 0, noDefaultInfinity: true, noNaN: true }),
        fc.double({ max: 1e14, min: -1e14, noDefaultInfinity: true, noNaN: true }),
        (levelIndex, ratio, anchor) => {
          const level = TIME_SCALE_LEVELS[levelIndex]!;
          const range = zoomRangeToLevel(
            { end: anchor + 1_000_000, start: anchor - 1_000_000 },
            level,
            { anchorRatio: ratio, anchorTime: anchor },
          )!;
          const resolvedAnchor = range.start + (range.end - range.start) * ratio;
          expect(Math.abs(resolvedAnchor - anchor)).toBeLessThanOrEqual(
            Math.max(0.000_1, Math.abs(anchor) * Number.EPSILON * 4),
          );
          const repeated = zoomRangeToLevel(range, level, {
            anchorRatio: ratio,
            anchorTime: anchor,
          });
          expect(repeated).toEqual(range);
        },
      ),
      { numRuns: 100, seed: 20_260_732 },
    );
  });

  it('fits interval and milestone bounds with symmetric pixel padding', () => {
    expect(fitTimeRange({ end: 900, start: 100 }, 1_000, { padding: 100 })).toEqual({
      end: 1_000,
      start: 0,
    });
    const milestone = fitTimeRange({ end: 500, start: 500 }, 1_000)!;
    expect(milestone.start).toBeLessThan(500);
    expect(milestone.end).toBeGreaterThan(500);
    expect(fitTimeRange(undefined, 1_000)).toBeUndefined();
    expect(fitTimeRange({ end: 1, start: 0 }, 40, { padding: 20 })).toBeUndefined();
  });

  it('keeps extreme epoch zoom outputs finite and bounded', () => {
    const range = zoomRangeToLevel(
      { end: 8.64e15, start: 8.64e15 - timeScaleLevelSpan('year') },
      'year',
      { anchorRatio: 1, anchorTime: 8.64e15 },
    );
    expect(range).toEqual({
      end: 8.64e15,
      start: 8.64e15 - timeScaleLevelSpan('year'),
    });
    expect(zoomRangeToLevel({ end: 1, start: 0 }, 'day', { anchorRatio: -0.1 })).toBeUndefined();
  });

  it('generates deterministic major and minor calendar ticks from explicit inputs', () => {
    const range = { end: Date.UTC(2027, 0, 1), start: Date.UTC(2026, 0, 1) };
    const ticks = generateAdaptiveTimeTicks(range, 'quarter', 'en-US', 'UTC');
    expect(ticks.filter((tick) => tick.kind === 'major').map((tick) => tick.label)).toEqual([
      'Jan 2026',
      'Apr 2026',
      'Jul 2026',
      'Oct 2026',
    ]);
    expect(ticks.filter((tick) => tick.kind === 'minor')).toHaveLength(3);
    expect(generateAdaptiveTimeTicks(range, 'month', 'en-US', 'UTC', 180)).toHaveLength(3);
  });
});

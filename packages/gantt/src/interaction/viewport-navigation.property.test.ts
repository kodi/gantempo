import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { shiftTimeRangeByPixels } from './viewport-navigation';

const PROPERTY_SEED = 20_260_731;
const PROPERTY_RUNS = 200;

describe(`viewport navigation properties seed=${PROPERTY_SEED}`, () => {
  it('preserves finite positive duration for accepted pixel shifts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: -1_000_000, max: 1_000_000 }).filter((value) => value !== 0),
        fc.integer({ min: 1, max: 100_000 }),
        (start, duration, pixels, width) => {
          const shifted = shiftTimeRangeByPixels({ start, end: start + duration }, pixels, width);
          if (shifted === undefined) {
            return;
          }
          expect(Number.isFinite(shifted.start)).toBe(true);
          expect(Number.isFinite(shifted.end)).toBe(true);
          expect(shifted.end).toBeGreaterThan(shifted.start);
          expect(shifted.end - shifted.start).toBeCloseTo(duration, 8);
        },
      ),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
        verbose: true,
      },
    );
  });
});

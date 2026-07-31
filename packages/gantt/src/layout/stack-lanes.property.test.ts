import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedViewLane, ViewLaneKey, ViewPlacementKey } from '../view/types';
import type { ResolvedIntervalPlacement } from './resolve-placement-intervals';
import { stackLanes } from './stack-lanes';

const PROPERTY_SEED = 20_260_736;
const PROPERTY_RUNS = 200;

function maximumConcurrency(placements: readonly ResolvedIntervalPlacement[]): number {
  const events = placements.flatMap((placement) => [
    { time: placement.start, delta: 1 },
    { time: placement.end, delta: -1 },
  ]);
  events.sort((left, right) => left.time - right.time || left.delta - right.delta);
  let concurrent = 0;
  let maximum = 0;
  for (const event of events) {
    concurrent += event.delta;
    maximum = Math.max(maximum, concurrent);
  }
  return maximum;
}

describe('stack layout properties', () => {
  it('matches concurrency, prevents track overlap, and preserves contiguous geometry', () => {
    const laneIntervals = fc.array(
      fc.record({
        minimumHeight: fc.integer({ min: 1, max: 150 }),
        intervals: fc.array(
          fc.record({
            start: fc.integer({ min: -100, max: 100 }),
            duration: fc.integer({ min: 1, max: 50 }),
          }),
          { maxLength: 20 },
        ),
      }),
      { maxLength: 10 },
    );

    fc.assert(
      fc.property(laneIntervals, (specifications) => {
        const lanes: ResolvedViewLane[] = specifications.map((specification, laneIndex) => ({
          key: `lane-${laneIndex}` as ViewLaneKey,
          title: `Lane ${laneIndex}`,
          sourceOrder: laneIndex,
          minimumHeight: specification.minimumHeight,
          source: {
            kind: 'custom',
            viewId: 'property',
            customLaneKey: `lane-${laneIndex}`,
          },
        }));
        const placements: ResolvedIntervalPlacement[] = specifications.flatMap(
          (specification, laneIndex) =>
            specification.intervals.map((item, itemIndex) => ({
              intervalSource: 'canonical' as const,
              kind: 'task' as const,
              key: `placement-${laneIndex}-${itemIndex}` as ViewPlacementKey,
              laneKey: `lane-${laneIndex}` as ViewLaneKey,
              taskId: `task-${laneIndex}-${itemIndex}`,
              sourceOrder: itemIndex,
              source: {
                kind: 'project-task',
                taskId: `task-${laneIndex}-${itemIndex}`,
              },
              start: item.start,
              end: item.start + item.duration,
            })),
        );
        const laneSnapshot = structuredClone(lanes);
        const placementSnapshot = structuredClone(placements);

        const first = stackLanes(lanes, placements);
        const second = stackLanes(lanes, placements);

        expect(first).toEqual(second);
        expect(lanes).toEqual(laneSnapshot);
        expect(placements).toEqual(placementSnapshot);
        first.lanes.forEach((laidOutLane, laneIndex) => {
          expect(laidOutLane.stackCount).toBe(maximumConcurrency(laidOutLane.placements));
          for (let left = 0; left < laidOutLane.placements.length; left += 1) {
            for (let right = left + 1; right < laidOutLane.placements.length; right += 1) {
              const a = laidOutLane.placements[left]!;
              const b = laidOutLane.placements[right]!;
              const overlaps = a.start < b.end && b.start < a.end;
              if (overlaps) {
                expect(a.track).not.toBe(b.track);
              }
            }
          }
          expect(laidOutLane.y).toBe(
            first.lanes
              .slice(0, laneIndex)
              .reduce((height, previous) => height + previous.height, 0),
          );
        });
        expect(first.totalHeight).toBe(
          first.lanes.reduce((height, laidOutLane) => height + laidOutLane.height, 0),
        );
      }),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});

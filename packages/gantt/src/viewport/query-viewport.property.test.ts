import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedViewLane, ViewLaneKey, ViewPlacementKey } from '../view/types';
import type { ResolvedIntervalPlacement } from '../layout/resolve-placement-intervals';
import { stackLanes } from '../layout/stack-lanes';
import { createViewportKernel } from './create-viewport-kernel';
import { queryViewport } from './query-viewport';
import { queryViewportBruteForce } from './test-oracle';

const PROPERTY_SEED = 20_260_737;
const PROPERTY_RUNS = 200;

describe('viewport query properties', () => {
  it('matches the two-dimensional brute-force oracle without mutating inputs or kernel', () => {
    const scenario = fc.record({
      lanes: fc.array(
        fc.record({
          height: fc.integer({ min: 1, max: 100 }),
          intervals: fc.array(
            fc.record({
              start: fc.integer({ min: -200, max: 200 }),
              duration: fc.integer({ min: 1, max: 100 }),
            }),
            { maxLength: 20 },
          ),
        }),
        { maxLength: 12 },
      ),
      timeStart: fc.integer({ min: -250, max: 250 }),
      timeExtent: fc.integer({ min: 1, max: 150 }),
      verticalStart: fc.integer({ min: 0, max: 1_500 }),
      verticalExtent: fc.integer({ min: 1, max: 500 }),
    });

    fc.assert(
      fc.property(scenario, (input) => {
        const lanes: ResolvedViewLane[] = input.lanes.map((specification, laneIndex) => ({
          key: `lane-${laneIndex}` as ViewLaneKey,
          title: `Lane ${laneIndex}`,
          sourceOrder: laneIndex,
          minimumHeight: specification.height,
          source: {
            kind: 'custom',
            viewId: 'viewport-property',
            customLaneKey: `lane-${laneIndex}`,
          },
        }));
        const placements: ResolvedIntervalPlacement[] = input.lanes.flatMap(
          (specification, laneIndex) =>
            specification.intervals.map((item, intervalIndex) => ({
              key: `placement-${laneIndex}-${intervalIndex}` as ViewPlacementKey,
              laneKey: `lane-${laneIndex}` as ViewLaneKey,
              taskId: `task-${laneIndex}-${intervalIndex}`,
              sourceOrder: intervalIndex,
              source: {
                kind: 'project-task',
                taskId: `task-${laneIndex}-${intervalIndex}`,
              },
              start: item.start,
              end: item.start + item.duration,
            })),
        );
        const layout = stackLanes(lanes, placements);
        const kernel = createViewportKernel(layout);
        const query = {
          timeRange: {
            start: input.timeStart,
            end: input.timeStart + input.timeExtent,
          },
          verticalStart: input.verticalStart,
          verticalExtent: input.verticalExtent,
        };
        const kernelSnapshot = structuredClone(kernel);

        const indexed = queryViewport(kernel, query);
        const bruteForce = queryViewportBruteForce(kernel, query);

        expect(indexed).toEqual(bruteForce);
        expect(kernel).toEqual(kernelSnapshot);
        expect(
          indexed.lanes.every(
            (lane) =>
              lane.y < query.verticalStart + query.verticalExtent &&
              lane.y + lane.height > query.verticalStart,
          ),
        ).toBe(true);
        expect(
          indexed.placements.every(
            (placement) =>
              placement.start < query.timeRange.end && placement.end > query.timeRange.start,
          ),
        ).toBe(true);
      }),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});

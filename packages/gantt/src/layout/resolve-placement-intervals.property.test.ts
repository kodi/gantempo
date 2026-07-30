import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { ResolvedViewPlacement, ViewLaneKey, ViewPlacementKey } from '../view/types';
import { resolvePlacementIntervals } from './resolve-placement-intervals';

const PROPERTY_SEED = 20_260_735;
const PROPERTY_RUNS = 200;

describe('placement interval resolution properties', () => {
  it('is deterministic, immutable, and emits only valid half-open intervals', () => {
    const schedules = fc.array(
      fc.record({
        start: fc.integer({ min: -10_000, max: 10_000 }),
        duration: fc.integer({ min: -20, max: 100 }),
        useSegment: fc.boolean(),
      }),
      { maxLength: 50 },
    );

    fc.assert(
      fc.property(schedules, (items) => {
        const tasks = items.map((item, index) => ({
          id: `task-${index}`,
          title: `Task ${index}`,
          kind: 'task' as const,
          schedule: {
            mode: 'instant' as const,
            start: item.start,
            end: item.start + item.duration,
          },
          segments: [
            {
              id: `segment-${index}`,
              schedule: {
                mode: 'instant' as const,
                start: item.start + 1,
                end: item.start + item.duration - 1,
              },
            },
          ],
        }));
        const document: GanttDocument = {
          schemaVersion: 1,
          tasks,
          resources: [],
          lanes: [],
          assignments: [],
          placements: [],
          dependencies: [],
        };
        const placements: readonly ResolvedViewPlacement[] = items.map((item, index) => ({
          key: `placement-${index}` as ViewPlacementKey,
          laneKey: 'lane' as ViewLaneKey,
          taskId: `task-${index}`,
          ...(item.useSegment ? { segmentId: `segment-${index}` } : {}),
          sourceOrder: index,
          source: { kind: 'project-task', taskId: `task-${index}` },
        }));
        const documentSnapshot = structuredClone(document);
        const placementsSnapshot = structuredClone(placements);

        const first = resolvePlacementIntervals(document, placements);
        const second = resolvePlacementIntervals(document, placements);

        expect(first).toEqual(second);
        expect(document).toEqual(documentSnapshot);
        expect(placements).toEqual(placementsSnapshot);
        expect(
          first.placements.every(
            (resolved) =>
              Number.isFinite(resolved.start) &&
              Number.isFinite(resolved.end) &&
              resolved.start < resolved.end,
          ),
        ).toBe(true);
        expect(first.placements.length + first.diagnostics.length).toBe(items.length);
      }),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import type { GanttCommand } from '../commands/types';
import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';
import { createChartScenePipeline } from './scene-pipeline';

const PROPERTY_SEED = 20_260_730;
const PROPERTY_RUNS = 80;
const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function fixture(): GanttDocument {
  return {
    schemaVersion: 1,
    tasks: Array.from({ length: 6 }, (_, index) => ({
      id: `task-${index}`,
      kind: 'task' as const,
      title: `Task ${index}`,
      segments: [],
      schedule: {
        mode: 'instant' as const,
        start: START + index * DAY,
        end: START + (index + 1) * DAY,
      },
    })),
    resources: [],
    lanes: [
      { id: 'lane-0', title: 'Lane 0' },
      { id: 'lane-1', title: 'Lane 1', height: 70 },
    ],
    assignments: [],
    placements: Array.from({ length: 6 }, (_, index) => ({
      id: `placement-${index}`,
      taskId: `task-${index}`,
      laneId: `lane-${index % 2}`,
    })),
    dependencies: [],
  };
}

function commandFor(kind: 'label' | 'move' | 'placement', step: number): GanttCommand {
  const index = Math.abs(step) % 6;
  if (kind === 'label') {
    return {
      type: 'task.update',
      id: `task-${index}`,
      changes: { title: `Renamed ${step}` },
    };
  }
  if (kind === 'move') {
    return {
      type: 'task.move',
      id: `task-${index}`,
      delta: (Math.abs(step) % 3) * DAY,
    };
  }
  return {
    type: 'placement.move',
    id: `placement-${index}`,
    laneId: `lane-${(index + 1) % 2}`,
  };
}

describe(`scene pipeline cached/cold parity seed=${PROPERTY_SEED}`, () => {
  it('matches a cold composer across fixed-seed affected-reference sequences', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom('label' as const, 'move' as const, 'placement' as const),
            step: fc.integer({ min: 0, max: 1_000 }),
            verticalStart: fc.integer({ min: 0, max: 400 }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (operations) => {
          let document = fixture();
          const pipeline = createChartScenePipeline();
          const baseOptions = {
            range: { start: START, end: START + 10 * DAY },
            tickAnchor: START,
            tickInterval: DAY,
            timeZone: 'UTC',
          } as const;
          pipeline.build({ ...baseOptions, document });

          for (const operation of operations) {
            const outcome = applyGanttCommand(document, commandFor(operation.kind, operation.step));
            expect(outcome.status).toBe('committed');
            document = outcome.document;
            const options = {
              ...baseOptions,
              document,
              viewport: {
                verticalStart: operation.verticalStart,
                verticalExtent: 90,
              },
            };
            const cached = pipeline.build(options, {
              kind: 'affected',
              affected: outcome.affected,
            }).scene;
            expect(cached).toEqual(buildChartScene(options));
          }
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

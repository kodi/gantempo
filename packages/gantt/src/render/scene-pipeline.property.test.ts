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
const PROJECT_PROPERTY_SEED = 20_260_731;

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

function projectFixture(): GanttDocument {
  const summaries = Array.from({ length: 6 }, (_, index) => ({
    id: `summary-${index}`,
    kind: 'summary' as const,
    segments: [],
    title: `Summary ${index}`,
  }));
  const tasks = summaries.flatMap((summary, summaryIndex) => [
    summary,
    ...Array.from({ length: 3 }, (_, childIndex) => {
      const index = summaryIndex * 3 + childIndex;
      return {
        id: `project-task-${index}`,
        kind: 'task' as const,
        parentId: summary.id,
        progress: (index % 5) / 4,
        schedule: {
          end: START + (index + 2) * DAY,
          mode: 'instant' as const,
          start: START + index * DAY,
        },
        segments: [],
        title: `Project task ${index}`,
      };
    }),
  ]);
  return {
    assignments: [],
    dependencies: Array.from({ length: 17 }, (_, index) => ({
      fromTaskId: `project-task-${index}`,
      id: `dependency-${index}`,
      toTaskId: `project-task-${index + 1}`,
      type: 'finish-to-start' as const,
    })),
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks,
  };
}

function commandFor(
  kind: 'appearance' | 'label' | 'lane-appearance' | 'move' | 'placement' | 'progress',
  step: number,
): GanttCommand {
  const index = Math.abs(step) % 6;
  if (kind === 'appearance') {
    return {
      changes: { appearance: { variant: step % 2 === 0 ? 'blocked' : 'lane-blue' } },
      id: `task-${index}`,
      type: 'task.update',
    };
  }
  if (kind === 'lane-appearance') {
    return {
      changes: { appearance: { variant: step % 2 === 0 ? 'blocked' : 'lane-blue' } },
      id: `lane-${index % 2}`,
      type: 'lane.update',
    };
  }
  if (kind === 'progress') {
    return {
      changes: { progress: (Math.abs(step) % 101) / 100 },
      id: `task-${index}`,
      type: 'task.update',
    };
  }
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
            kind: fc.constantFrom(
              'appearance' as const,
              'label' as const,
              'lane-appearance' as const,
              'move' as const,
              'placement' as const,
              'progress' as const,
            ),
            step: fc.integer({ min: 0, max: 1_000 }),
            verticalStart: fc.integer({ min: 0, max: 400 }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (operations) => {
          let document = fixture();
          const pipeline = createChartScenePipeline();
          const baseOptions = {
            appearanceVariants: [
              { id: 'blocked', label: 'Blocked', tokens: { 'task.fill': '#f00' } },
              { id: 'lane-blue', label: 'Lane blue', tokens: { 'task.fill': '#00f' } },
            ],
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
            });
            const cold = createChartScenePipeline().build(options);
            expect(cached.scene).toEqual(buildChartScene(options));
            expect(cached.occurrences).toEqual(cold.occurrences);
            for (const visible of cached.scene.taskBars) {
              expect(
                cached.occurrences.some(
                  (occurrence) =>
                    occurrence.viewKey === visible.viewKey &&
                    occurrence.taskId === visible.taskId &&
                    occurrence.laneViewKey === visible.laneViewKey,
                ),
              ).toBe(true);
            }
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

  it(`matches cold project composition across M5 input sequences seed=${PROJECT_PROPERTY_SEED}`, () => {
    const filterEven = (task: GanttDocument['tasks'][number]) =>
      task.kind === 'summary' || Number(task.id.split('-').at(-1)) % 2 === 0;
    const sortDescending = (
      left: GanttDocument['tasks'][number],
      right: GanttDocument['tasks'][number],
    ) => right.title.localeCompare(left.title);
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom(
              'collapse' as const,
              'dependency' as const,
              'direction' as const,
              'filter' as const,
              'locale' as const,
              'move' as const,
              'range' as const,
              'title' as const,
            ),
            step: fc.integer({ min: 0, max: 10_000 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (operations) => {
          let document = projectFixture();
          let direction = 'ltr' as 'ltr' | 'rtl';
          let locale = 'en-US';
          let collapsedTaskIds: readonly string[] = [];
          let filter: typeof filterEven | undefined;
          let sort: typeof sortDescending | undefined;
          let range = { end: START + 24 * DAY, start: START };
          const pipeline = createChartScenePipeline();
          const currentOptions = () => ({
            direction,
            document,
            locale,
            projectQuery: { collapsedTaskIds },
            range,
            tickAnchor: START,
            tickInterval: DAY,
            timeZone: 'UTC',
            view: {
              ...(filter === undefined ? {} : { filter }),
              kind: 'project' as const,
              ...(sort === undefined ? {} : { sort }),
            },
          });
          pipeline.build(currentOptions());

          for (const operation of operations) {
            let affected: readonly import('../commands/types').EntityReference[] | undefined;
            if (operation.kind === 'collapse') {
              collapsedTaskIds = operation.step % 3 === 0 ? [] : [`summary-${operation.step % 6}`];
            } else if (operation.kind === 'direction') {
              direction = operation.step % 2 === 0 ? 'ltr' : 'rtl';
            } else if (operation.kind === 'locale') {
              locale = operation.step % 2 === 0 ? 'en-US' : 'sr-Latn-RS';
            } else if (operation.kind === 'filter') {
              filter = operation.step % 2 === 0 ? undefined : filterEven;
              sort = operation.step % 3 === 0 ? sortDescending : undefined;
            } else if (operation.kind === 'range') {
              const shift = (operation.step % 4) * DAY;
              range = { end: START + 24 * DAY + shift, start: START + shift };
            } else {
              const command: GanttCommand =
                operation.kind === 'dependency'
                  ? {
                      changes: {
                        type: operation.step % 2 === 0 ? 'finish-to-start' : 'start-to-start',
                      },
                      id: `dependency-${operation.step % 17}`,
                      type: 'dependency.update',
                    }
                  : operation.kind === 'move'
                    ? {
                        delta: operation.step % 2 === 0 ? DAY : -DAY,
                        id: `project-task-${operation.step % 18}`,
                        type: 'task.move',
                      }
                    : {
                        changes: { title: `Renamed ${operation.step}` },
                        id: `project-task-${operation.step % 18}`,
                        type: 'task.update',
                      };
              const outcome = applyGanttCommand(document, command);
              expect(outcome.status).toBe('committed');
              if (outcome.status !== 'committed') return;
              document = outcome.document;
              affected = outcome.affected;
            }

            const options = currentOptions();
            const cached = pipeline.build(
              options,
              affected === undefined ? undefined : { affected, kind: 'affected' },
            );
            const cold = createChartScenePipeline().build(options);
            expect(cached.scene).toEqual(cold.scene);
            expect(cached.occurrences).toEqual(cold.occurrences);
          }
        },
      ),
      {
        endOnFailure: true,
        numRuns: 50,
        seed: PROJECT_PROPERTY_SEED,
        verbose: true,
      },
    );
  });
});

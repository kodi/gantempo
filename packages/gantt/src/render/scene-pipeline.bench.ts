import { bench, describe } from 'vite-plus/test';

import type { EntityReference } from '../commands/types';
import type { GanttDocument } from '../model/types';
import { createChartScenePipeline } from './scene-pipeline';

const GENERATOR_VERSION = 'm4-scene-v1';
const BENCHMARK_SEED = 20_260_730;
const TASK_COUNT = 2_000;
const LANE_COUNT = 400;
const DAY = 24 * 60 * 60 * 1_000;
const RANGE = { start: 0, end: 365 * DAY };
const TASK_AFFECTED = Object.freeze([
  Object.freeze({ collection: 'tasks', id: 'task-0' }),
]) satisfies readonly EntityReference[];

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createFixture(): GanttDocument {
  const random = createRandom(BENCHMARK_SEED);
  const lanes = Array.from({ length: LANE_COUNT }, (_, index) => ({
    id: `lane-${index}`,
    title: `Lane ${index}`,
    ...(index % 13 === 0 ? { height: 72 } : {}),
  }));
  const tasks = Array.from({ length: TASK_COUNT }, (_, index) => {
    const start = Math.floor(random() * 360) * DAY;
    return {
      id: `task-${index}`,
      kind: 'task' as const,
      title: `Task ${index}`,
      segments: [],
      schedule: {
        mode: 'instant' as const,
        start,
        end: start + (1 + Math.floor(random() * 5)) * DAY,
      },
    };
  });
  return Object.freeze({
    schemaVersion: 1,
    tasks: Object.freeze(tasks),
    resources: Object.freeze([]),
    lanes: Object.freeze(lanes),
    assignments: Object.freeze([]),
    placements: Object.freeze(
      tasks.map((task, index) =>
        Object.freeze({
          id: `placement-${index}`,
          taskId: task.id,
          laneId: lanes[index % LANE_COUNT]!.id,
        }),
      ),
    ),
    dependencies: Object.freeze([]),
  });
}

const document = createFixture();
const renamedDocument = Object.freeze({
  ...document,
  tasks: Object.freeze(
    document.tasks.map((task, index) =>
      index === 0 ? Object.freeze({ ...task, title: 'Renamed task 0' }) : task,
    ),
  ),
});
const baseOptions = {
  document,
  range: RANGE,
  tickAnchor: 0,
  tickInterval: 30 * DAY,
  timeZone: 'UTC',
} as const;
const pipeline = createChartScenePipeline();
const initial = pipeline.build(baseOptions);
const visiblePipeline = createChartScenePipeline();
const visibleA = visiblePipeline.build({
  ...baseOptions,
  viewport: { verticalStart: 10_000, verticalExtent: 480 },
});
const visibleB = visiblePipeline.build({
  ...baseOptions,
  viewport: { verticalStart: 20_000, verticalExtent: 480 },
});
let labelToggle = false;
let scrollToggle = false;

if (
  initial.scene.taskBars.length !== TASK_COUNT ||
  visibleA.work.viewportQueries !== 1 ||
  visibleB.work.viewportQueries !== 1
) {
  throw new Error('Scene benchmark fixture did not produce the expected work profile.');
}

describe(`${GENERATOR_VERSION} seed=${BENCHMARK_SEED} tasks=${TASK_COUNT} lanes=${LANE_COUNT} distribution=sparse visible=${visibleA.scene.taskBars.length}/${visibleB.scene.taskBars.length}`, () => {
  bench('cold validation-view-layout-index-primitives', () => {
    createChartScenePipeline().build(baseOptions);
  });

  bench('warm affected task label', () => {
    labelToggle = !labelToggle;
    pipeline.build(
      {
        ...baseOptions,
        document: labelToggle ? renamedDocument : document,
      },
      { kind: 'affected', affected: TASK_AFFECTED },
    );
  });

  bench('warm vertical viewport query', () => {
    scrollToggle = !scrollToggle;
    visiblePipeline.build({
      ...baseOptions,
      viewport: {
        verticalStart: scrollToggle ? 10_000 : 20_000,
        verticalExtent: 480,
      },
    });
  });
});

import { bench, describe } from 'vite-plus/test';

import type { EntityReference } from '../commands/types';
import type { GanttDocument } from '../model/types';
import { createChartScenePipeline } from './scene-pipeline';

const GENERATOR_VERSION = 'm5-project-v1';
const BENCHMARK_SEED = 20_260_731;
const SUMMARY_COUNT = 400;
const CHILDREN_PER_SUMMARY = 4;
const TASK_COUNT = SUMMARY_COUNT * (CHILDREN_PER_SUMMARY + 1);
const DEPENDENCY_COUNT = SUMMARY_COUNT * CHILDREN_PER_SUMMARY - 1;
const DAY = 24 * 60 * 60 * 1_000;
const RANGE = { end: 365 * DAY, start: 0 };

function createFixture(): GanttDocument {
  const tasks: GanttDocument['tasks'][number][] = [];
  for (let summaryIndex = 0; summaryIndex < SUMMARY_COUNT; summaryIndex += 1) {
    const summaryId = `summary-${summaryIndex}`;
    tasks.push({ id: summaryId, kind: 'summary', segments: [], title: `Summary ${summaryIndex}` });
    for (let childIndex = 0; childIndex < CHILDREN_PER_SUMMARY; childIndex += 1) {
      const index = summaryIndex * CHILDREN_PER_SUMMARY + childIndex;
      const start = ((index * 37 + BENCHMARK_SEED) % 350) * DAY;
      tasks.push({
        id: `task-${index}`,
        kind: childIndex === CHILDREN_PER_SUMMARY - 1 ? 'milestone' : 'task',
        parentId: summaryId,
        schedule:
          childIndex === CHILDREN_PER_SUMMARY - 1
            ? { end: start, mode: 'instant', start }
            : { end: start + (1 + (index % 5)) * DAY, mode: 'instant', start },
        segments: [],
        title: `Task ${index}`,
      });
    }
  }
  return Object.freeze({
    assignments: Object.freeze([]),
    dependencies: Object.freeze(
      Array.from({ length: DEPENDENCY_COUNT }, (_, index) =>
        Object.freeze({
          fromTaskId: `task-${index}`,
          id: `dependency-${index}`,
          toTaskId: `task-${index + 1}`,
          type: 'finish-to-start' as const,
        }),
      ),
    ),
    lanes: Object.freeze([]),
    placements: Object.freeze([]),
    resources: Object.freeze([]),
    schemaVersion: 1,
    tasks: Object.freeze(tasks),
  });
}

const document = createFixture();
const dependencyDocument = Object.freeze({
  ...document,
  dependencies: Object.freeze(
    document.dependencies.map((dependency, index) =>
      index === 0 ? Object.freeze({ ...dependency, type: 'start-to-start' as const }) : dependency,
    ),
  ),
});
const dependencyAffected = Object.freeze([
  Object.freeze({ collection: 'dependencies', id: 'dependency-0' }),
]) satisfies readonly EntityReference[];
const collapsedTaskIds = Object.freeze(
  Array.from({ length: SUMMARY_COUNT / 5 }, (_, index) => `summary-${index * 5}`),
);
const filterEven = (task: GanttDocument['tasks'][number]) =>
  task.kind === 'summary' || Number(task.id.slice('task-'.length)) % 2 === 0;
const baseOptions = {
  document,
  range: RANGE,
  tickAnchor: 0,
  tickInterval: 30 * DAY,
  timeZone: 'UTC',
  view: { kind: 'project' as const },
};
const collapsedOptions = { ...baseOptions, projectQuery: { collapsedTaskIds } };
const filteredOptions = {
  ...baseOptions,
  view: { filter: filterEven, kind: 'project' as const },
};
const zoomOptions = {
  ...baseOptions,
  range: { end: 270 * DAY, start: 90 * DAY },
};

const observationPipeline = createChartScenePipeline();
const coldObservation = observationPipeline.build(baseOptions);
const collapsedObservation = observationPipeline.build(collapsedOptions);
const filteredObservation = observationPipeline.build(filteredOptions);
const dependencyObservationPipeline = createChartScenePipeline();
dependencyObservationPipeline.build(baseOptions);
const dependencyObservation = dependencyObservationPipeline.build(
  { ...baseOptions, document: dependencyDocument },
  { affected: dependencyAffected, kind: 'affected' },
);
const zoomObservationPipeline = createChartScenePipeline();
zoomObservationPipeline.build({ ...baseOptions, document: dependencyDocument });
const zoomObservation = zoomObservationPipeline.build({
  ...zoomOptions,
  document: dependencyDocument,
});

if (
  coldObservation.scene.taskBars.length !== TASK_COUNT ||
  collapsedObservation.scene.taskBars.length !== TASK_COUNT - collapsedTaskIds.length * 4 ||
  filteredObservation.scene.taskBars.length !== SUMMARY_COUNT + DEPENDENCY_COUNT / 2 + 0.5 ||
  dependencyObservation.work.topologyBuilds !== 0 ||
  dependencyObservation.work.dependencyPrimitiveBuilds !== 1 ||
  zoomObservation.work.topologyBuilds !== 0 ||
  zoomObservation.work.intervalBuilds !== 0 ||
  zoomObservation.work.occurrenceCatalogBuilds !== 0 ||
  zoomObservation.work.dependencyPrimitiveBuilds !== 1 ||
  zoomObservation.work.tickBuilds !== 1 ||
  zoomObservation.work.viewportQueries !== 1
) {
  throw new Error('M5 project benchmark fixture did not produce the expected work profile.');
}

const collapsePipeline = createChartScenePipeline();
collapsePipeline.build(baseOptions);
const filterPipeline = createChartScenePipeline();
filterPipeline.build(baseOptions);
const dependencyPipeline = createChartScenePipeline();
dependencyPipeline.build(baseOptions);
const zoomPipeline = createChartScenePipeline();
zoomPipeline.build(baseOptions);
let collapsed = false;
let filtered = false;
let dependencyChanged = false;
let zoomed = false;

describe(`${GENERATOR_VERSION} seed=${BENCHMARK_SEED} tasks=${TASK_COUNT} summaries=${SUMMARY_COUNT} dependencies=${DEPENDENCY_COUNT} collapse=${collapsedObservation.scene.taskBars.length} filter=${filteredObservation.scene.taskBars.length}`, () => {
  bench('cold project tree, graph, layout, and routes', () => {
    createChartScenePipeline().build(baseOptions);
  });

  bench('warm project collapse query', () => {
    collapsed = !collapsed;
    collapsePipeline.build(collapsed ? collapsedOptions : baseOptions);
  });

  bench('warm project filter topology', () => {
    filtered = !filtered;
    filterPipeline.build(filtered ? filteredOptions : baseOptions);
  });

  bench('warm dependency-only update', () => {
    dependencyChanged = !dependencyChanged;
    dependencyPipeline.build(
      dependencyChanged ? { ...baseOptions, document: dependencyDocument } : baseOptions,
      { affected: dependencyAffected, kind: 'affected' },
    );
  });

  bench('warm zoom range', () => {
    zoomed = !zoomed;
    zoomPipeline.build(zoomed ? zoomOptions : baseOptions);
  });
});

import { bench, describe } from 'vite-plus/test';

import type { EntityReference } from '../commands/types';
import { createInteractionHitTestIndex, hitTestInteraction } from '../interaction/hit-test';
import type { GanttDocument } from '../model/types';
import { createChartScenePipeline } from '../render/scene-pipeline';
import { createGanttReactRuntime } from './runtime';
import type { GanttProps } from './types';

const GENERATOR_VERSION = 'm4-runtime-v1';
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
    const start = Math.floor(random() * 330) * DAY;
    return {
      id: `task-${index}`,
      kind: 'task' as const,
      title: `Task ${index}`,
      segments: [],
      schedule: {
        mode: 'instant' as const,
        start,
        end: start + (index === 0 ? 30 : 1 + Math.floor(random() * 5)) * DAY,
      },
    };
  });
  return Object.freeze({
    assignments: Object.freeze([]),
    dependencies: Object.freeze([]),
    lanes: Object.freeze(lanes),
    placements: Object.freeze(
      tasks.map((task, index) =>
        Object.freeze({
          id: `placement-${index}`,
          laneId: lanes[index % LANE_COUNT]!.id,
          taskId: task.id,
        }),
      ),
    ),
    resources: Object.freeze([]),
    schemaVersion: 1,
    tasks: Object.freeze(tasks),
  });
}

const document = createFixture();
const revisionA = Object.freeze({ ...document, revision: 'server-r1' });
const revisionB = Object.freeze({ ...document, revision: 'server-r2' });
const baseProps = {
  historyCapacity: 0,
  range: RANGE,
  tickAnchor: 0,
  tickInterval: 30 * DAY,
  timeZone: 'UTC',
} as const;
const uncontrolledProps = {
  ...baseProps,
  defaultDocument: document,
} satisfies GanttProps;
const controlledPropsA = {
  ...baseProps,
  document: revisionA,
  onDocumentChange() {},
} satisfies GanttProps;
const controlledPropsB = {
  ...controlledPropsA,
  document: revisionB,
} satisfies GanttProps;

const pipeline = createChartScenePipeline();
const coldObservation = pipeline.build({ ...baseProps, document });
const renamedDocument = Object.freeze({
  ...document,
  tasks: Object.freeze(
    document.tasks.map((task, index) =>
      index === 0 ? Object.freeze({ ...task, title: 'Renamed task 0' }) : task,
    ),
  ),
});
const selectiveObservation = pipeline.build(
  { ...baseProps, document: renamedDocument },
  { affected: TASK_AFFECTED, kind: 'affected' },
);

const controlledRuntime = createGanttReactRuntime(controlledPropsA);
let controlledToggle = false;
const focusRuntime = createGanttReactRuntime(uncontrolledProps);
const focusTargets = focusRuntime.getSnapshot().selector.occurrences.slice(0, 2);
let focusToggle = false;
const scrollRuntime = createGanttReactRuntime(uncontrolledProps);
let scrollToggle = false;
const pointerRuntime = createGanttReactRuntime(uncontrolledProps);
const pointerTask = pointerRuntime
  .getSnapshot()
  .scene.taskBars.find((task) => task.taskId === 'task-0')!;
const pointerGeometry = {
  height: pointerRuntime.getSnapshot().scene.bounds.timelineHeight,
  verticalStart: 0,
  width: 1_200,
  x: 0,
  y: 0,
} as const;
const pointerPoint = {
  x: (pointerTask.x + pointerTask.width / 2) * pointerGeometry.width,
  y: pointerTask.y + pointerTask.height / 2,
};
const commandRuntime = createGanttReactRuntime(uncontrolledProps);
let commandToggle = false;
const hitIndex = createInteractionHitTestIndex(coldObservation.scene, {
  height: coldObservation.scene.bounds.timelineHeight,
  verticalStart: 0,
  width: 1_200,
  x: 0,
  y: 0,
});
const hitPoints = coldObservation.scene.taskBars.slice(0, 32).map((task) => ({
  candidateViewKey: task.viewKey,
  point: {
    x: (task.x + task.width / 2) * 1_200,
    y: task.y + task.height / 2,
  },
}));
let hitCursor = 0;

if (
  coldObservation.scene.taskBars.length !== TASK_COUNT ||
  selectiveObservation.work.mode !== 'selective' ||
  selectiveObservation.work.affectedLaneKeys.length !== 1 ||
  focusTargets.length !== 2 ||
  hitPoints.length !== 32
) {
  throw new Error('Runtime benchmark fixture did not produce the expected work profile.');
}

describe(`${GENERATOR_VERSION} seed=${BENCHMARK_SEED} tasks=${TASK_COUNT} lanes=${LANE_COUNT} visible=${coldObservation.scene.taskBars.length} cache=${selectiveObservation.work.mode}/${selectiveObservation.work.affectedLaneKeys.length}-lane hitIndex=${hitIndex.tasks.length}-tasks/${hitIndex.lanes.length}-lanes`, () => {
  bench('cold runtime construction', () => {
    const runtime = createGanttReactRuntime(uncontrolledProps);
    runtime.dispose();
  });

  bench('controlled revision-only prop adoption', () => {
    controlledToggle = !controlledToggle;
    const props = controlledToggle ? controlledPropsB : controlledPropsA;
    controlledRuntime.updateCallbacks(props);
    controlledRuntime.reconcile(props);
  });

  bench('steady measured scroll query', () => {
    scrollToggle = !scrollToggle;
    scrollRuntime.measure({
      clientHeight: 480,
      clientWidth: 1_200,
      verticalStart: scrollToggle ? 10_000 : 20_000,
    });
  });

  bench('selection and focus update', () => {
    focusToggle = !focusToggle;
    focusRuntime.getHandle().focusTask(focusTargets[focusToggle ? 0 : 1]!.target);
  });

  bench('pointer preview update', () => {
    const pointerId = 1;
    pointerRuntime.pointerDown({
      candidateViewKey: pointerTask.viewKey,
      geometry: pointerGeometry,
      point: pointerPoint,
      pointerId,
      pointerType: 'mouse',
    });
    pointerRuntime.pointerMove({
      candidateViewKey: pointerTask.viewKey,
      geometry: pointerGeometry,
      point: { x: pointerPoint.x + 40, y: pointerPoint.y },
      pointerId,
    });
    pointerRuntime.pointerCancel(pointerId);
  });

  bench('committed task move', async () => {
    commandToggle = !commandToggle;
    await commandRuntime.getHandle().dispatch({
      delta: commandToggle ? 1 : -1,
      id: 'task-0',
      type: 'task.move',
    });
  });

  bench('indexed mouse hit test', () => {
    const input = hitPoints[hitCursor % hitPoints.length]!;
    hitCursor += 1;
    hitTestInteraction(hitIndex, input.point, 'mouse', input.candidateViewKey);
  });
});

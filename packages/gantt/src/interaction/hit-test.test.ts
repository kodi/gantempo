import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { buildChartScene } from '../render/build-chart-scene';
import type { ChartScene, TaskBarPrimitive } from '../render/primitives';
import {
  coordinateToTime,
  createInteractionHitTestIndex,
  hitTestInteraction,
  snapInteractionTime,
} from './hit-test';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const RANGE = { start: START, end: START + 10 * DAY };

function sceneFixture(direction: 'ltr' | 'rtl' = 'ltr'): ChartScene {
  const document: GanttDocument = {
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        progress: 0.5,
        title: 'A',
        segments: [],
        schedule: { mode: 'instant', start: START + DAY, end: START + 3 * DAY },
      },
      {
        id: 'task-b',
        kind: 'task',
        title: 'B',
        segments: [],
        schedule: { mode: 'instant', start: START + DAY, end: START + 3 * DAY },
      },
      {
        id: 'task-c',
        kind: 'task',
        title: 'C',
        segments: [],
        schedule: { mode: 'instant', start: START + 6 * DAY, end: START + 8 * DAY },
      },
      {
        id: 'task-clipped',
        kind: 'task',
        title: 'Clipped',
        segments: [],
        schedule: { mode: 'instant', start: START - DAY, end: START + DAY },
      },
    ],
    resources: [],
    lanes: [
      { id: 'lane-a', title: 'Lane A' },
      { id: 'lane-b', title: 'Lane B', height: 80 },
    ],
    assignments: [],
    placements: [
      { id: 'placement-a', taskId: 'task-a', laneId: 'lane-a' },
      { id: 'placement-b', taskId: 'task-b', laneId: 'lane-a' },
      { id: 'placement-c', taskId: 'task-c', laneId: 'lane-b' },
      { id: 'placement-clipped', taskId: 'task-clipped', laneId: 'lane-a' },
    ],
    dependencies: [],
  };
  return buildChartScene({
    direction,
    document,
    range: RANGE,
    tickAnchor: START,
    tickInterval: DAY,
    timeZone: 'UTC',
  });
}

function indexFor(scene = sceneFixture(), verticalStart = 0, height?: number) {
  return createInteractionHitTestIndex(scene, {
    x: 100,
    y: 50,
    width: 1_000,
    height: height ?? scene.bounds.timelineHeight,
    verticalStart,
  });
}

describe('interaction hit testing', () => {
  it('gives milestone points a centered pointer hit target without resize edges', () => {
    const scene = buildChartScene({
      document: {
        assignments: [],
        dependencies: [],
        lanes: [],
        placements: [],
        resources: [],
        schemaVersion: 1,
        tasks: [
          {
            id: 'milestone',
            kind: 'milestone',
            schedule: { end: START + 5 * DAY, mode: 'instant', start: START + 5 * DAY },
            segments: [],
            title: 'Milestone',
          },
        ],
      },
      range: RANGE,
      tickAnchor: START,
      tickInterval: DAY,
      timeZone: 'UTC',
      view: { kind: 'project' },
    });
    const index = indexFor(scene);
    const milestone = index.tasks[0]!;
    const hit = hitTestInteraction(
      index,
      {
        x: milestone.rect.x + milestone.rect.width / 2,
        y: milestone.rect.y + milestone.rect.height / 2,
      },
      'mouse',
    );

    expect(milestone.rect.width).toBe(24);
    expect(hit).toMatchObject({ kind: 'task-body', task: { target: { taskId: 'milestone' } } });
  });

  it('resolves task edges, bodies, empty lane positions, and canonical targets', () => {
    const index = indexFor();
    const task = index.tasks.find((node) => node.target.taskId === 'task-a')!;
    const edge = hitTestInteraction(
      index,
      { x: task.rect.x, y: task.rect.y + task.rect.height / 2 },
      'mouse',
      task.target.viewKey,
    );
    const body = hitTestInteraction(
      index,
      {
        x: task.rect.x + task.rect.width / 2,
        y: task.rect.y + task.rect.height / 2,
      },
      'mouse',
    );
    const lane = index.lanes[1]!;
    const empty = hitTestInteraction(
      index,
      { x: 1_050, y: lane.rect.y + lane.rect.height / 2 },
      'mouse',
    );

    expect(edge).toMatchObject({
      kind: 'task-edge',
      edge: 'start',
      task: { target: { taskId: 'task-a', placementId: 'placement-a' } },
    });
    expect(body).toMatchObject({
      kind: 'task-body',
      task: { target: { taskId: 'task-a', laneId: 'lane-a' } },
    });
    expect(empty).toMatchObject({
      kind: 'timeline-position',
      lane: { target: { kind: 'lane', laneId: 'lane-b' } },
    });
  });

  it('keeps semantic start and end edge hits correct after RTL mirroring', () => {
    const index = indexFor(sceneFixture('rtl'));
    const task = index.tasks.find((node) => node.target.taskId === 'task-a')!;
    const y = task.rect.y + task.rect.height / 2;

    expect(
      hitTestInteraction(
        index,
        { x: task.rect.x + task.rect.width, y },
        'mouse',
        task.target.viewKey,
      ),
    ).toMatchObject({ edge: 'start', kind: 'task-edge' });
    expect(
      hitTestInteraction(index, { x: task.rect.x, y }, 'mouse', task.target.viewKey),
    ).toMatchObject({ edge: 'end', kind: 'task-edge' });
  });

  it('expands touch edges without making clipped boundaries resizable', () => {
    const index = indexFor();
    const task = index.tasks.find((node) => node.target.taskId === 'task-a')!;
    const touchPoint = {
      x: task.rect.x + task.rect.width + 15,
      y: task.rect.y + task.rect.height / 2,
    };
    expect(hitTestInteraction(index, touchPoint, 'mouse')?.kind).toBe('timeline-position');
    expect(hitTestInteraction(index, touchPoint, 'touch')).toMatchObject({
      kind: 'task-edge',
      edge: 'end',
    });

    const clipped = index.tasks.find((node) => node.target.taskId === 'task-clipped')!;
    expect(
      hitTestInteraction(
        index,
        { x: clipped.rect.x, y: clipped.rect.y + clipped.rect.height / 2 },
        'touch',
      ),
    ).toMatchObject({ kind: 'task-body' });
  });

  it('uses deterministic tie, paint-order, and delegated-candidate priority', () => {
    const base = sceneFixture();
    const source = base.taskBars.find((task) => task.taskId === 'task-a')!;
    const narrow = Object.freeze({
      ...source,
      x: 0.4,
      width: 0.012,
      clippedStart: false,
      clippedEnd: false,
    }) satisfies TaskBarPrimitive;
    const narrowScene = Object.freeze({
      ...base,
      taskBars: Object.freeze([narrow]),
    });
    const narrowIndex = indexFor(narrowScene);
    expect(
      hitTestInteraction(
        narrowIndex,
        {
          x: narrowIndex.tasks[0]!.rect.x + narrowIndex.tasks[0]!.rect.width / 2,
          y: narrowIndex.tasks[0]!.rect.y + narrowIndex.tasks[0]!.rect.height / 2,
        },
        'mouse',
      ),
    ).toMatchObject({ kind: 'task-edge', edge: 'start' });

    const first = Object.freeze({ ...source, viewKey: 'overlap-first' });
    const second = Object.freeze({ ...source, viewKey: 'overlap-second' });
    const overlapScene = Object.freeze({
      ...base,
      taskBars: Object.freeze([first, second]),
    });
    const overlapIndex = indexFor(overlapScene);
    const point = {
      x: overlapIndex.tasks[0]!.rect.x + overlapIndex.tasks[0]!.rect.width / 2,
      y: overlapIndex.tasks[0]!.rect.y + overlapIndex.tasks[0]!.rect.height / 2,
    };
    expect(hitTestInteraction(overlapIndex, point, 'mouse')).toMatchObject({
      kind: 'task-body',
      task: { target: { viewKey: 'overlap-second' } },
    });
    expect(hitTestInteraction(overlapIndex, point, 'mouse', 'overlap-first')).toMatchObject({
      kind: 'task-body',
      task: { target: { viewKey: 'overlap-first' } },
    });
  });

  it('targets editable progress while preserving resize-edge precedence', () => {
    const scene = sceneFixture();
    const index = createInteractionHitTestIndex(
      scene,
      {
        x: 100,
        y: 50,
        width: 1_000,
        height: scene.bounds.timelineHeight,
        verticalStart: 0,
      },
      { progressTaskIds: ['task-a'] },
    );
    const task = index.tasks.find((node) => node.target.taskId === 'task-a')!;
    expect(
      hitTestInteraction(
        index,
        {
          x: task.rect.x + task.rect.width * 0.5,
          y: task.rect.y + task.rect.height / 2,
        },
        'mouse',
      ),
    ).toMatchObject({ kind: 'task-progress', task: { progressEditable: true } });

    const source = scene.taskBars.find((candidate) => candidate.taskId === 'task-a')!;
    const full = Object.freeze({
      ...source,
      progress: Object.freeze({ value: 1, width: source.width, x: source.x }),
    });
    const fullScene = Object.freeze({ ...scene, taskBars: Object.freeze([full]) });
    const fullIndex = createInteractionHitTestIndex(
      fullScene,
      {
        x: 100,
        y: 50,
        width: 1_000,
        height: scene.bounds.timelineHeight,
        verticalStart: 0,
      },
      { progressTaskIds: ['task-a'] },
    );
    const fullTask = fullIndex.tasks[0]!;
    const point = {
      x: fullTask.rect.x + fullTask.rect.width,
      y: fullTask.rect.y + fullTask.rect.height / 2,
    };
    expect(hitTestInteraction(fullIndex, point, 'touch')).toMatchObject({
      edge: 'end',
      kind: 'task-edge',
    });
    expect(
      hitTestInteraction(
        fullIndex,
        point,
        'touch',
        fullTask.target.viewKey,
        fullTask.target.viewKey,
      ),
    ).toMatchObject({ kind: 'task-progress' });
  });

  it('preserves absolute variable-lane geometry under a non-zero vertical start', () => {
    const scene = sceneFixture();
    const secondLane = scene.lanes[1]!;
    const index = indexFor(scene, secondLane.y, secondLane.height);
    const node = index.tasks.find((task) => task.target.taskId === 'task-c')!;
    const hit = hitTestInteraction(
      index,
      { x: node.rect.x + node.rect.width / 2, y: node.rect.y + node.rect.height / 2 },
      'mouse',
    );

    expect(index.lanes[1]?.rect.y).toBe(50);
    expect(hit).toMatchObject({ kind: 'task-body', task: { target: { taskId: 'task-c' } } });
  });

  it('maps coordinates and snap ties without locale, time-zone, or sign ambiguity', () => {
    expect(coordinateToTime({ x: 100, width: 1_000 }, RANGE, 600)).toBe(START + 5 * DAY);
    expect(coordinateToTime({ x: 100, width: 1_000 }, RANGE, 600, true, 'rtl')).toBe(
      START + 5 * DAY,
    );
    expect(coordinateToTime({ x: 100, width: 1_000 }, RANGE, 100, true, 'rtl')).toBe(
      START + 10 * DAY,
    );
    expect(coordinateToTime({ x: 100, width: 1_000 }, RANGE, 1_100, true, 'rtl')).toBe(START);
    expect(coordinateToTime({ x: 100, width: 1_000 }, RANGE, -500)).toBe(START);
    expect(snapInteractionTime(START + DAY / 2, { anchor: START, step: DAY })).toBe(START + DAY);
    expect(snapInteractionTime(START - DAY / 2, { anchor: START, step: DAY })).toBe(START);
    expect(() => snapInteractionTime(START, { anchor: START, step: 0 })).toThrow('positive');
  });
});

import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';
import { createChartScenePipeline } from './scene-pipeline';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const RANGE = { start: START, end: START + 10 * DAY };
const APPEARANCE_VARIANTS = [
  {
    id: 'lane-blue',
    label: 'Lane blue',
    tokens: {
      'lane.accent': '#2563eb',
      'lane.surface': '#eff6ff',
      'task.fill': '#dbeafe',
      'task.progressFill': '#60a5fa',
    },
  },
  {
    id: 'blocked',
    label: 'Blocked',
    tokens: {
      'task.border': '#7f1d1d',
      'task.fill': '#fecaca',
      'task.progressFill': '#dc2626',
      'task.text': '#450a0a',
    },
  },
] as const;

function repeatedTaskDocument(): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [
      { appearance: { variant: 'lane-blue' }, id: 'lane-a', title: 'Lane A' },
      { appearance: { variant: 'customer:unknown' }, id: 'lane-b', title: 'Lane B' },
    ],
    placements: [
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' },
      { id: 'placement-b', laneId: 'lane-b', taskId: 'task-a' },
    ],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        progress: 0.5,
        schedule: { end: START + 8 * DAY, mode: 'instant', start: START + 2 * DAY },
        segments: [],
        title: 'Repeated task',
      },
    ],
  };
}

function options(document: GanttDocument) {
  return {
    appearanceVariants: APPEARANCE_VARIANTS,
    document,
    range: RANGE,
    tickAnchor: START,
    tickInterval: DAY,
    timeZone: 'UTC',
  } as const;
}

describe('appearance and progress scene primitives', () => {
  it('resolves lane inheritance independently for repeated task occurrences', () => {
    const scene = buildChartScene(options(repeatedTaskDocument()));

    expect(scene.lanes.map((lane) => lane.appearance)).toMatchObject([
      { resolution: 'resolved', source: 'lane', variant: 'lane-blue' },
      { resolution: 'unresolved', source: 'lane', variant: 'customer:unknown' },
    ]);
    expect(scene.taskBars.map((task) => task.appearance)).toMatchObject([
      { resolution: 'resolved', source: 'lane', variant: 'lane-blue' },
      { resolution: 'unresolved', source: 'lane', variant: 'customer:unknown' },
    ]);
    expect(
      scene.diagnostics.filter(({ code }) => code === 'appearance.variant.unresolved'),
    ).toEqual([
      expect.objectContaining({
        code: 'appearance.variant.unresolved',
        details: { variant: 'customer:unknown' },
      }),
    ]);

    const virtualized = buildChartScene({
      ...options(repeatedTaskDocument()),
      viewport: { verticalExtent: 58, verticalStart: 58 },
    });
    expect(virtualized.lanes.map((lane) => lane.laneId)).toEqual(['lane-b']);
    expect(virtualized.taskBars).toHaveLength(1);
    expect(virtualized.taskBars[0]?.progress).toMatchObject({
      value: 0.5,
      width: 0.3,
      x: 0.2,
    });
  });

  it('makes explicit task appearance override every lane and legacy task fallback', () => {
    const document = repeatedTaskDocument();
    const task = document.tasks[0]!;
    const scene = buildChartScene({
      ...options({
        ...document,
        tasks: [{ ...task, appearance: { variant: 'blocked' } }],
      }),
      taskVariants: { 'task-a': 'legacy-css-hook' },
    });

    expect(scene.taskBars.map((bar) => bar.appearance)).toMatchObject([
      { resolution: 'resolved', source: 'task', variant: 'blocked' },
      { resolution: 'resolved', source: 'task', variant: 'blocked' },
    ]);
    expect(scene.taskBars[0]?.appearance?.tokens).toMatchObject({
      'task.fill': '#fecaca',
      'task.progressFill': '#dc2626',
    });
  });

  it('projects 0, partial, full, clipped, and unsupported progress deterministically', () => {
    const baseTask = repeatedTaskDocument().tasks[0]!;
    const document: GanttDocument = {
      ...repeatedTaskDocument(),
      lanes: [{ id: 'lane-a', title: 'Lane A' }],
      placements: [
        { id: 'zero', laneId: 'lane-a', taskId: 'zero' },
        { id: 'partial', laneId: 'lane-a', taskId: 'partial' },
        { id: 'full', laneId: 'lane-a', taskId: 'full' },
        { id: 'left-clipped', laneId: 'lane-a', taskId: 'left-clipped' },
        { id: 'summary', laneId: 'lane-a', taskId: 'summary' },
        { id: 'milestone', laneId: 'lane-a', taskId: 'milestone' },
      ],
      tasks: [
        { ...baseTask, id: 'zero', progress: 0 },
        { ...baseTask, id: 'partial', progress: 0.5 },
        { ...baseTask, id: 'full', progress: 1 },
        {
          ...baseTask,
          id: 'left-clipped',
          progress: 0.75,
          schedule: { end: START + 4 * DAY, mode: 'instant', start: START - 4 * DAY },
        },
        { ...baseTask, id: 'summary', kind: 'summary', progress: 0.5 },
        { ...baseTask, id: 'milestone', kind: 'milestone', progress: 0.5 },
      ],
    };
    const scene = buildChartScene(options(document));
    const byId = new Map(scene.taskBars.map((bar) => [bar.taskId, bar]));

    expect(byId.get('zero')?.progress).toMatchObject({ value: 0, width: 0 });
    expect(byId.get('partial')?.progress).toMatchObject({ value: 0.5, x: 0.2, width: 0.3 });
    expect(byId.get('full')?.progress).toMatchObject({ value: 1, x: 0.2 });
    expect(byId.get('full')?.progress?.width).toBeCloseTo(0.6, 10);
    expect(byId.get('left-clipped')?.progress).toMatchObject({
      value: 0.75,
      x: 0,
      width: 0.2,
    });
    expect(byId.get('summary')?.progress).toMatchObject({ value: 0.5, width: 0.3, x: 0.2 });
    expect(byId.get('milestone')?.progress).toBeUndefined();
  });

  it('rebuilds paint/progress primitives without rebuilding geometry or duplicating diagnostics', () => {
    const pipeline = createChartScenePipeline();
    const document = repeatedTaskDocument();
    const first = pipeline.build(options(document));
    const progress = applyGanttCommand(document, {
      changes: { progress: 1 },
      id: 'task-a',
      type: 'task.update',
    });
    expect(progress.status).toBe('committed');
    const second = pipeline.build(options(progress.document), {
      affected: progress.affected,
      kind: 'affected',
    });

    expect(second.work).toMatchObject({
      intervalBuilds: 0,
      lanePositionBuilds: 0,
      laneStackBuilds: 0,
      occurrenceCatalogBuilds: 0,
      taskPrimitiveBuilds: 2,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });
    expect(second.scene.taskBars.every((bar) => bar.progress?.value === 1)).toBe(true);
    expect(
      second.scene.diagnostics.filter(({ code }) => code === 'appearance.variant.unresolved'),
    ).toHaveLength(1);
    expect(second.scene).toEqual(buildChartScene(options(progress.document)));

    const registry = pipeline.build({
      ...options(progress.document),
      appearanceVariants: [
        ...APPEARANCE_VARIANTS,
        {
          id: 'customer:unknown',
          label: 'Late registry value',
          tokens: { 'task.fill': '#fafafa' },
        },
      ],
    });
    expect(registry.work).toMatchObject({
      appearanceRegistryBuilds: 1,
      intervalBuilds: 0,
      lanePositionBuilds: 0,
      laneStackBuilds: 0,
      occurrenceCatalogBuilds: 0,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });
    expect(registry.scene.taskBars[1]?.appearance).toMatchObject({
      resolution: 'resolved',
      variant: 'customer:unknown',
    });
    expect(first.scene.taskBars[1]?.appearance).toMatchObject({
      resolution: 'unresolved',
      variant: 'customer:unknown',
    });
  });

  it('selectively rebuilds one lane inheritance set or every occurrence of one task', () => {
    const pipeline = createChartScenePipeline();
    const document = repeatedTaskDocument();
    pipeline.build(options(document));

    const lane = applyGanttCommand(document, {
      changes: { appearance: { variant: 'blocked' } },
      id: 'lane-a',
      type: 'lane.update',
    });
    expect(lane.status).toBe('committed');
    const laneResult = pipeline.build(options(lane.document), {
      affected: lane.affected,
      kind: 'affected',
    });
    expect(laneResult.work).toMatchObject({
      intervalBuilds: 0,
      lanePositionBuilds: 0,
      lanePrimitiveBuilds: 1,
      laneStackBuilds: 0,
      taskPrimitiveBuilds: 1,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });
    expect(laneResult.scene.taskBars[0]?.appearance).toMatchObject({
      source: 'lane',
      variant: 'blocked',
    });
    expect(laneResult.scene.taskBars[1]?.appearance).toMatchObject({
      source: 'lane',
      variant: 'customer:unknown',
    });

    const task = applyGanttCommand(lane.document, {
      changes: { appearance: { variant: 'blocked' } },
      id: 'task-a',
      type: 'task.update',
    });
    expect(task.status).toBe('committed');
    const taskResult = pipeline.build(options(task.document), {
      affected: task.affected,
      kind: 'affected',
    });
    expect(taskResult.work).toMatchObject({
      intervalBuilds: 0,
      lanePositionBuilds: 0,
      lanePrimitiveBuilds: 0,
      laneStackBuilds: 0,
      taskPrimitiveBuilds: 2,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });
    expect(
      taskResult.scene.taskBars.every(
        (bar) => bar.appearance?.source === 'task' && bar.appearance.variant === 'blocked',
      ),
    ).toBe(true);
  });
});

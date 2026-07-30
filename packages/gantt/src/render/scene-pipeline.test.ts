import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import type { GanttCommand } from '../commands/types';
import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';
import { createChartScenePipeline } from './scene-pipeline';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const RANGE = { start: START, end: START + 10 * DAY };

function fixture(): GanttDocument {
  return {
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        title: 'Task A',
        segments: [],
        schedule: { mode: 'instant', start: START + DAY, end: START + 3 * DAY },
      },
      {
        id: 'task-b',
        kind: 'task',
        title: 'Task B',
        segments: [],
        schedule: { mode: 'instant', start: START + 4 * DAY, end: START + 6 * DAY },
      },
    ],
    resources: [
      { id: 'resource-a', title: 'Ada' },
      { id: 'resource-b', title: 'Grace' },
    ],
    lanes: [
      { id: 'lane-a', title: 'Lane A', resourceId: 'resource-a' },
      { id: 'lane-b', title: 'Lane B', resourceId: 'resource-b', height: 72 },
    ],
    assignments: [
      { id: 'assignment-a', taskId: 'task-a', resourceId: 'resource-a' },
      { id: 'assignment-b', taskId: 'task-b', resourceId: 'resource-b' },
    ],
    placements: [
      {
        id: 'placement-a',
        taskId: 'task-a',
        laneId: 'lane-a',
        assignmentId: 'assignment-a',
      },
      {
        id: 'placement-b',
        taskId: 'task-b',
        laneId: 'lane-b',
        assignmentId: 'assignment-b',
      },
    ],
    dependencies: [],
  };
}

function options(document: GanttDocument) {
  return {
    document,
    range: RANGE,
    tickAnchor: START,
    tickInterval: DAY,
    timeZone: 'UTC',
  } as const;
}

function commit(document: GanttDocument, command: GanttCommand) {
  const outcome = applyGanttCommand(document, command);
  expect(outcome.status).toBe('committed');
  return outcome;
}

describe('staged chart scene pipeline', () => {
  it('keeps the compatibility composer in exact parity and reuses an unchanged scene', () => {
    const document = fixture();
    const pipeline = createChartScenePipeline();
    const first = pipeline.build(options(document));
    const second = pipeline.build(options(document));

    expect(first.scene).toEqual(buildChartScene(options(document)));
    expect(first.work).toMatchObject({
      mode: 'cold',
      validationBuilds: 1,
      topologyBuilds: 1,
      intervalBuilds: 1,
      laneStackBuilds: 2,
      viewportQueries: 1,
    });
    expect(second.scene).toBe(first.scene);
    expect(second.work).toMatchObject({
      mode: 'reused',
      validationBuilds: 0,
      topologyBuilds: 0,
      intervalBuilds: 0,
      laneStackBuilds: 0,
      viewportQueries: 0,
    });
  });

  it('rebuilds only task primitives for a document-view label change', () => {
    const pipeline = createChartScenePipeline();
    const document = fixture();
    pipeline.build(options(document));
    const outcome = commit(document, {
      type: 'task.update',
      id: 'task-a',
      changes: { title: 'Renamed' },
    });
    const result = pipeline.build(options(outcome.document), {
      kind: 'affected',
      affected: outcome.affected,
    });

    expect(result.scene).toEqual(buildChartScene(options(outcome.document)));
    expect(result.work).toMatchObject({
      mode: 'selective',
      validationBuilds: 1,
      indexBuilds: 1,
      topologyBuilds: 0,
      intervalBuilds: 0,
      laneStackBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
      lanePrimitiveBuilds: 0,
      taskPrimitiveBuilds: 1,
    });
    expect(result.work.affectedLaneKeys).toHaveLength(1);
  });

  it('rebuilds the changed interval lane while retaining unaffected geometry and indexes', () => {
    const pipeline = createChartScenePipeline();
    const document = fixture();
    pipeline.build(options(document));
    const outcome = commit(document, {
      type: 'task.move',
      id: 'task-a',
      delta: DAY,
    });
    const result = pipeline.build(options(outcome.document), {
      kind: 'affected',
      affected: outcome.affected,
    });

    expect(result.scene).toEqual(buildChartScene(options(outcome.document)));
    expect(result.work).toMatchObject({
      topologyBuilds: 0,
      intervalBuilds: 1,
      laneStackBuilds: 1,
      lanePositionBuilds: 1,
      viewportKernelBuilds: 1,
      viewportIntervalIndexBuilds: 1,
      viewportQueries: 1,
      lanePrimitiveBuilds: 0,
      taskPrimitiveBuilds: 1,
    });
  });

  it('tracks old and new dependency lanes for placement and resource topology changes', () => {
    const document = fixture();
    const documentPipeline = createChartScenePipeline();
    documentPipeline.build(options(document));
    const placement = commit(document, {
      type: 'placement.move',
      id: 'placement-a',
      laneId: 'lane-b',
      assignmentId: null,
    });
    const moved = documentPipeline.build(options(placement.document), {
      kind: 'affected',
      affected: placement.affected,
    });

    expect(moved.scene).toEqual(buildChartScene(options(placement.document)));
    expect(moved.work.topologyBuilds).toBe(1);
    expect(moved.work.affectedLaneKeys).toHaveLength(2);
    expect(
      documentPipeline
        .getDependencies()
        ?.occurrenceKeysByReference.get('placements\u0000placement-a'),
    ).toHaveLength(1);

    const resourcePipeline = createChartScenePipeline();
    const resourceOptions = { ...options(document), view: { kind: 'resource' as const } };
    resourcePipeline.build(resourceOptions);
    const assignment = commit(document, {
      type: 'assignment.set',
      value: {
        id: 'assignment-a',
        taskId: 'task-a',
        resourceId: 'resource-b',
      },
    });
    const reassigned = resourcePipeline.build(
      { ...resourceOptions, document: assignment.document },
      { kind: 'affected', affected: assignment.affected },
    );

    expect(reassigned.scene).toEqual(
      buildChartScene({ ...resourceOptions, document: assignment.document }),
    );
    expect(reassigned.work.topologyBuilds).toBe(1);
    expect(reassigned.work.affectedLaneKeys).toHaveLength(2);

    const resourceTitle = commit(assignment.document, {
      type: 'resource.update',
      id: 'resource-b',
      changes: { title: 'Grace Hopper' },
    });
    const retitled = resourcePipeline.build(
      { ...resourceOptions, document: resourceTitle.document },
      { kind: 'affected', affected: resourceTitle.affected },
    );
    expect(retitled.scene).toEqual(
      buildChartScene({ ...resourceOptions, document: resourceTitle.document }),
    );
    expect(retitled.work.topologyBuilds).toBe(1);
    expect(retitled.work.affectedLaneKeys).toHaveLength(1);
  });

  it('applies the invalidation matrix for metrics, view, horizontal range, and scroll', () => {
    const pipeline = createChartScenePipeline();
    const document = fixture();
    pipeline.build(options(document));

    const metric = pipeline.build({ ...options(document), metrics: { rowHeight: 64 } });
    expect(metric.work).toMatchObject({
      topologyBuilds: 0,
      intervalBuilds: 0,
      laneStackBuilds: 2,
      viewportKernelBuilds: 1,
    });

    const project = pipeline.build({
      ...options(document),
      metrics: { rowHeight: 64 },
      view: { kind: 'project' },
    });
    expect(project.work.topologyBuilds).toBe(1);
    expect(project.scene).toEqual(
      buildChartScene({
        ...options(document),
        metrics: { rowHeight: 64 },
        view: { kind: 'project' },
      }),
    );

    const horizontal = pipeline.build({
      ...options(document),
      metrics: { rowHeight: 64 },
      view: { kind: 'project' },
      range: { start: START + DAY, end: RANGE.end + DAY },
    });
    expect(horizontal.work).toMatchObject({
      topologyBuilds: 0,
      intervalBuilds: 0,
      laneStackBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 1,
      tickBuilds: 1,
    });

    const verticalOptions = {
      ...options(document),
      metrics: { rowHeight: 64 },
      view: { kind: 'project' as const },
      range: { start: START + DAY, end: RANGE.end + DAY },
      viewport: { verticalStart: 64, verticalExtent: 64 },
    };
    const vertical = pipeline.build(verticalOptions);
    expect(vertical.scene).toEqual(buildChartScene(verticalOptions));
    expect(vertical.work).toMatchObject({
      topologyBuilds: 0,
      intervalBuilds: 0,
      laneStackBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 1,
      tickBuilds: 0,
    });
    expect(vertical.scene.lanes.every((lane) => lane.y >= 64)).toBe(true);
  });

  it('keeps a frozen full occurrence catalog across horizontal and vertical viewport queries', () => {
    const pipeline = createChartScenePipeline();
    const document = fixture();
    const first = pipeline.build({
      ...options(document),
      range: { start: START, end: START + 3 * DAY },
      viewport: { verticalStart: 0, verticalExtent: 58 },
    });

    expect(first.scene.taskBars.map((task) => task.taskId)).toEqual(['task-a']);
    expect(first.occurrences).toHaveLength(2);
    expect(first.occurrences.map((occurrence) => occurrence.taskId)).toEqual(['task-a', 'task-b']);
    expect(first.occurrences[1]).toMatchObject({
      laneId: 'lane-b',
      laneIndex: 1,
      laneViewKey: expect.any(String),
      laneY: 58,
      placementId: 'placement-b',
      start: START + 4 * DAY,
      taskId: 'task-b',
    });
    expect(Object.isFrozen(first.occurrences)).toBe(true);
    expect(Object.isFrozen(first.occurrences[1])).toBe(true);
    expect(first.work.occurrenceCatalogBuilds).toBe(1);

    const horizontal = pipeline.build({
      ...options(document),
      range: { start: START + 3 * DAY, end: START + 7 * DAY },
      viewport: { verticalStart: 0, verticalExtent: 58 },
    });
    expect(horizontal.occurrences).toBe(first.occurrences);
    expect(horizontal.work).toMatchObject({
      intervalBuilds: 0,
      laneStackBuilds: 0,
      occurrenceCatalogBuilds: 0,
      topologyBuilds: 0,
      viewportQueries: 1,
    });

    const vertical = pipeline.build({
      ...options(document),
      range: { start: START + 3 * DAY, end: START + 7 * DAY },
      viewport: { verticalStart: 58, verticalExtent: 72 },
    });
    expect(vertical.occurrences).toBe(first.occurrences);
    expect(vertical.scene.taskBars.map((task) => task.taskId)).toEqual(['task-b']);
    expect(vertical.work).toMatchObject({
      intervalBuilds: 0,
      laneStackBuilds: 0,
      occurrenceCatalogBuilds: 0,
      topologyBuilds: 0,
      viewportQueries: 1,
    });

    const removed = commit(document, {
      type: 'task.delete',
      id: 'task-a',
      cascade: true,
    });
    const afterRemoval = pipeline.build(options(removed.document), {
      kind: 'affected',
      affected: removed.affected,
    });
    expect(afterRemoval.occurrences.map((occurrence) => occurrence.taskId)).toEqual(['task-b']);
    expect(afterRemoval.occurrences).not.toBe(first.occurrences);
    expect(afterRemoval.work.occurrenceCatalogBuilds).toBe(1);
  });

  it('fails closed to a full rebuild for external documents without trusted affected metadata', () => {
    const pipeline = createChartScenePipeline();
    const document = fixture();
    pipeline.build(options(document));
    const external = {
      ...document,
      tasks: document.tasks.map((task) =>
        task.id === 'task-a' ? { ...task, title: 'External' } : task,
      ),
    };
    const result = pipeline.build(options(external));

    expect(result.scene).toEqual(buildChartScene(options(external)));
    expect(result.work).toMatchObject({
      mode: 'fallback',
      validationBuilds: 1,
      topologyBuilds: 1,
      intervalBuilds: 1,
      laneStackBuilds: 2,
      viewportKernelBuilds: 1,
      viewportIntervalIndexBuilds: 2,
      viewportQueries: 1,
    });
  });

  it('returns stable empty results for clipped and out-of-bounds vertical queries', () => {
    const pipeline = createChartScenePipeline();
    const document = fixture();
    const clipped = pipeline.build({
      ...options(document),
      viewport: { verticalStart: 57, verticalExtent: 2 },
    }).scene;
    const outside = pipeline.build({
      ...options(document),
      viewport: { verticalStart: 10_000, verticalExtent: 20 },
    }).scene;

    expect(clipped.lanes.map((lane) => lane.laneId)).toEqual(['lane-a', 'lane-b']);
    expect(outside.lanes).toEqual([]);
    expect(outside.taskBars).toEqual([]);
    expect(outside.bounds.timelineHeight).toBeGreaterThan(0);
  });
});

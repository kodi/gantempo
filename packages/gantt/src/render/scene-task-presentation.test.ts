import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';

function fixture(): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'summary',
        kind: 'summary',
        progress: 0.5,
        segments: [],
        title: 'Summary',
      },
      {
        id: 'child',
        kind: 'task',
        parentId: 'summary',
        schedule: { end: 110, mode: 'instant', start: -10 },
        segments: [],
        title: 'Child',
      },
      {
        id: 'start-point',
        kind: 'milestone',
        schedule: { end: 0, mode: 'instant', start: 0 },
        segments: [],
        title: 'Start point',
      },
      {
        id: 'end-point',
        kind: 'milestone',
        schedule: { end: 100, mode: 'instant', start: 100 },
        segments: [],
        title: 'End point',
      },
    ],
  };
}

function build(document: GanttDocument, verticalStart = 0, verticalExtent = 232) {
  return buildChartScene({
    document,
    range: { end: 100, start: 0 },
    tickAnchor: 0,
    tickInterval: 10,
    timeZone: 'UTC',
    view: { kind: 'project' },
    viewport: { verticalExtent, verticalStart },
  });
}

describe('task presentation scene primitives', () => {
  it('emits summary brackets, read-only progress, milestone diamonds, and half-open boundaries', () => {
    const scene = build(fixture());
    const byId = new Map(scene.taskBars.map((item) => [item.taskId, item]));
    const summary = byId.get('summary');
    const startPoint = byId.get('start-point');

    expect([...byId.keys()]).toEqual(['summary', 'child', 'start-point']);
    expect(summary).toMatchObject({
      clippedEnd: true,
      clippedStart: true,
      end: 110,
      presentation: {
        geometry: { kind: 'summary' },
        intervalSource: 'descendants',
        kind: 'summary',
        project: { depth: 0, expanded: true, hasChildren: true },
        summary: {
          descendantCount: 1,
          resolvedDescendantCount: 1,
          unresolvedDescendantCount: 0,
        },
      },
      progress: { value: 0.5, width: 0.5, x: 0 },
      start: -10,
      width: 1,
      x: 0,
    });
    expect(startPoint).toMatchObject({
      clippedEnd: false,
      clippedStart: false,
      end: 0,
      presentation: {
        geometry: { centerX: 0, kind: 'milestone', size: 24 },
        intervalSource: 'canonical',
        kind: 'milestone',
      },
      start: 0,
      width: 0,
      x: 0,
    });
    expect(Object.isFrozen(summary?.presentation)).toBe(true);
    expect(Object.isFrozen(summary?.presentation?.geometry)).toBe(true);
  });

  it('keeps point geometry correct through vertical virtualization', () => {
    const scene = build(fixture(), 116, 58);

    expect(scene.lanes.map((lane) => lane.source)).toEqual([
      { kind: 'project-task', taskId: 'start-point' },
    ]);
    expect(scene.taskBars.map((task) => task.taskId)).toEqual(['start-point']);
    expect(scene.taskBars[0]?.presentation?.geometry.kind).toBe('milestone');
  });

  it('presents an unequal permissive milestone at its start with one diagnostic', () => {
    const document = fixture();
    const tasks = document.tasks.map((task) =>
      task.id === 'start-point'
        ? { ...task, schedule: { end: 10, mode: 'instant' as const, start: 0 } }
        : task,
    );
    const scene = build({ ...document, tasks });

    expect(scene.taskBars.find((task) => task.taskId === 'start-point')).toMatchObject({
      end: 0,
      start: 0,
    });
    expect(
      scene.diagnostics.filter((item) => item.code === 'presentation.milestone-interval'),
    ).toHaveLength(1);
  });
});

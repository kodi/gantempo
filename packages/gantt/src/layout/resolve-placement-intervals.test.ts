import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { resolveView } from '../view/resolve-view';
import type { ResolvedViewPlacement, ViewLaneKey, ViewPlacementKey } from '../view/types';
import { resolvePlacementIntervals } from './resolve-placement-intervals';

function documentWithTasks(tasks: GanttDocument['tasks']): GanttDocument {
  return {
    schemaVersion: 1,
    tasks,
    resources: [],
    lanes: [{ id: 'lane', title: 'Lane' }],
    assignments: [],
    placements: tasks.map((task) => ({
      id: `placement-${task.id}`,
      taskId: task.id,
      laneId: 'lane',
    })),
    dependencies: [],
  };
}

function placement(taskId: string, segmentId?: string, sourceOrder = 0): ResolvedViewPlacement {
  return {
    key: `placement:${taskId}:${segmentId ?? ''}` as ViewPlacementKey,
    laneKey: 'lane' as ViewLaneKey,
    taskId,
    ...(segmentId === undefined ? {} : { segmentId }),
    sourceOrder,
    source: { kind: 'project-task', taskId },
  };
}

describe('resolvePlacementIntervals', () => {
  it('uses task schedules unless an explicit segment is selected', () => {
    const document = documentWithTasks([
      {
        id: 'task',
        title: 'Task',
        kind: 'task',
        schedule: { mode: 'instant', start: 10, end: 30 },
        segments: [{ id: 'segment', schedule: { mode: 'instant', start: 15, end: 20 } }],
      },
    ]);
    const resolvedView = resolveView(document, {
      kind: 'custom',
      id: 'segments',
      lanes: [{ key: 'lane', title: 'Lane' }],
      placements: [
        { key: 'task', laneKey: 'lane', taskId: 'task' },
        { key: 'segment', laneKey: 'lane', taskId: 'task', segmentId: 'segment' },
      ],
    });
    expect(resolvedView.status).toBe('resolved');
    if (resolvedView.status !== 'resolved') {
      return;
    }

    const result = resolvePlacementIntervals(document, resolvedView.view.placements);

    expect(result.placements.map(({ start, end }) => [start, end])).toEqual([
      [10, 30],
      [15, 20],
    ]);
    expect(result.placements[1]).toMatchObject({
      taskId: 'task',
      segmentId: 'segment',
      source: {
        kind: 'custom',
        viewId: 'segments',
        customPlacementKey: 'segment',
      },
    });
  });

  it('resolves all-day input and isolates absent, non-finite, zero-width, and reversed schedules', () => {
    const document = documentWithTasks([
      { id: 'absent', title: 'Absent', kind: 'task', segments: [] },
      {
        id: 'all-day',
        title: 'All day',
        kind: 'task',
        schedule: { mode: 'all-day', startDate: '2026-07-30', endDate: '2026-07-31' },
        segments: [],
      },
      {
        id: 'non-finite',
        title: 'Non finite',
        kind: 'task',
        schedule: { mode: 'instant', start: Number.NaN, end: 2 },
        segments: [],
      },
      {
        id: 'zero',
        title: 'Zero',
        kind: 'task',
        schedule: { mode: 'instant', start: 2, end: 2 },
        segments: [],
      },
      {
        id: 'reversed',
        title: 'Reversed',
        kind: 'task',
        schedule: { mode: 'instant', start: 3, end: 2 },
        segments: [],
      },
      {
        id: 'valid',
        title: 'Valid',
        kind: 'task',
        schedule: { mode: 'instant', start: 1, end: 2 },
        segments: [],
      },
    ]);
    const view = resolveView(document, { kind: 'document' });
    expect(view.status).toBe('resolved');
    if (view.status !== 'resolved') {
      return;
    }

    const result = resolvePlacementIntervals(document, view.view.placements);

    expect(result.placements.map((item) => item.taskId)).toEqual(['all-day', 'valid']);
    expect(result.placements[0]).toMatchObject({
      end: Date.UTC(2026, 6, 31),
      intervalSource: 'canonical',
      kind: 'task',
      start: Date.UTC(2026, 6, 30),
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'layout.missing-schedule',
      'layout.non-finite-interval',
      'layout.invalid-interval',
      'layout.invalid-interval',
    ]);
  });

  it('keeps valid siblings when task and segment sources are missing', () => {
    const document = documentWithTasks([
      {
        id: 'valid',
        title: 'Valid',
        kind: 'task',
        schedule: { mode: 'instant', start: 1, end: 2 },
        segments: [],
      },
    ]);

    const result = resolvePlacementIntervals(document, [
      placement('missing'),
      placement('valid', 'missing', 1),
      placement('valid', undefined, 2),
    ]);

    expect(result.placements.map((item) => item.taskId)).toEqual(['valid']);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'layout.missing-task',
      'layout.missing-segment',
    ]);
  });

  it('does not mutate frozen placement or document inputs', () => {
    const document = Object.freeze(
      documentWithTasks([
        Object.freeze({
          id: 'task',
          title: 'Task',
          kind: 'task' as const,
          schedule: Object.freeze({ mode: 'instant' as const, start: 1, end: 2 }),
          segments: Object.freeze([]),
        }),
      ]),
    );
    const input = Object.freeze([Object.freeze(placement('task'))]);

    const result = resolvePlacementIntervals(document, input);

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).not.toBe(input[0]);
    expect(Object.isFrozen(result.placements[0]?.source)).toBe(true);
    expect(input[0]?.taskId).toBe('task');
  });
});

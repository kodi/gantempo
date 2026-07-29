import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 6, 29);
const RANGE = { start: START, end: START + 10 * DAY };

function documentWith(
  tasks: GanttDocument['tasks'],
  placements: GanttDocument['placements'],
  lanes: GanttDocument['lanes'] = [{ id: 'lane-a', title: 'Lane A' }],
): GanttDocument {
  return {
    schemaVersion: 1,
    assignments: [],
    dependencies: [],
    lanes,
    placements,
    resources: [],
    tasks,
  };
}

function build(document: GanttDocument) {
  return buildChartScene({
    document,
    range: RANGE,
    tickAnchor: START,
    tickInterval: 2 * DAY,
    timeZone: 'UTC',
  });
}

describe('buildChartScene', () => {
  it('maps exact boundaries and clips bars at both visible edges', () => {
    const scene = build(
      documentWith(
        [
          {
            id: 'full',
            kind: 'task',
            segments: [],
            title: 'Full',
            schedule: { mode: 'instant', start: START, end: RANGE.end },
          },
          {
            id: 'left',
            kind: 'task',
            segments: [],
            title: 'Left',
            schedule: { mode: 'instant', start: START - DAY, end: START + 2 * DAY },
          },
          {
            id: 'right',
            kind: 'task',
            segments: [],
            title: 'Right',
            schedule: { mode: 'instant', start: START + 8 * DAY, end: RANGE.end + DAY },
          },
          {
            id: 'before',
            kind: 'task',
            segments: [],
            title: 'Before',
            schedule: { mode: 'instant', start: START - 2 * DAY, end: START },
          },
          {
            id: 'after',
            kind: 'task',
            segments: [],
            title: 'After',
            schedule: { mode: 'instant', start: RANGE.end, end: RANGE.end + DAY },
          },
        ],
        ['full', 'left', 'right', 'before', 'after'].map((taskId) => ({
          id: `placement-${taskId}`,
          laneId: 'lane-a',
          taskId,
        })),
      ),
    );

    expect(scene.taskBars.map((bar) => bar.taskId)).toEqual(['full', 'left', 'right']);
    expect(scene.taskBars[0]).toMatchObject({ x: 0, width: 1 });
    expect(scene.taskBars[1]).toMatchObject({ x: 0, width: 0.2, clippedStart: true });
    expect(scene.taskBars[2]).toMatchObject({ x: 0.8, clippedEnd: true });
    expect(scene.taskBars[2]?.width).toBeCloseTo(0.2, 10);
  });

  it('keeps lane and placement order, empty lanes, and centered fixed-height bars', () => {
    const scene = build(
      documentWith(
        [
          {
            id: 'task-b',
            kind: 'task',
            segments: [],
            title: 'B',
            schedule: { mode: 'instant', start: START + 4 * DAY, end: START + 5 * DAY },
          },
          {
            id: 'task-a',
            kind: 'task',
            segments: [],
            title: 'A',
            schedule: { mode: 'instant', start: START + DAY, end: START + 2 * DAY },
          },
        ],
        [
          { id: 'placement-b', laneId: 'lane-b', taskId: 'task-b' },
          { id: 'placement-a', laneId: 'lane-b', taskId: 'task-a' },
        ],
        [
          { id: 'lane-a', title: 'Empty first' },
          { id: 'lane-b', title: 'Two tasks' },
        ],
      ),
    );

    expect(scene.lanes.map((lane) => lane.laneId)).toEqual(['lane-a', 'lane-b']);
    expect(scene.taskBars.map((bar) => bar.taskId)).toEqual(['task-b', 'task-a']);
    expect(scene.taskBars[0]).toMatchObject({ laneId: 'lane-b', y: 75, height: 24 });
    expect(scene.emptyState).toBeUndefined();
  });

  it('returns usable primitives and focused diagnostics for invalid records', () => {
    const scene = build(
      documentWith(
        [
          { id: 'unscheduled', kind: 'task', segments: [], title: 'Unscheduled' },
          {
            id: 'invalid',
            kind: 'task',
            segments: [],
            title: 'Invalid',
            schedule: { mode: 'instant', start: START + DAY, end: START },
          },
          {
            id: 'non-finite',
            kind: 'task',
            segments: [],
            title: 'Non finite',
            schedule: { mode: 'instant', start: Number.NaN, end: START + DAY },
          },
          {
            id: 'valid',
            kind: 'task',
            segments: [],
            title: 'Valid',
            schedule: { mode: 'instant', start: START, end: START + DAY },
          },
        ],
        [
          { id: 'missing-lane', laneId: 'nope', taskId: 'valid' },
          { id: 'missing-task', laneId: 'lane-a', taskId: 'nope' },
          { id: 'unscheduled', laneId: 'lane-a', taskId: 'unscheduled' },
          { id: 'invalid', laneId: 'lane-a', taskId: 'invalid' },
          { id: 'non-finite', laneId: 'lane-a', taskId: 'non-finite' },
          { id: 'valid', laneId: 'lane-a', taskId: 'valid' },
        ],
      ),
    );

    expect(scene.taskBars.map((bar) => bar.taskId)).toEqual(['valid']);
    expect(scene.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'reference.placement-lane',
      'reference.placement-task',
      'render.missing-task-schedule',
      'render.invalid-task-interval',
      'render.non-finite-task-time',
    ]);
  });

  it('emits an empty state only for a document without display lanes', () => {
    const scene = build(documentWith([], [], []));

    expect(scene.lanes).toEqual([]);
    expect(scene.taskBars).toEqual([]);
    expect(scene.emptyState).toEqual({
      title: 'No scheduled work',
      description: 'Add a task to begin planning.',
    });
  });

  it('does not mutate frozen inputs and rejects an invalid visible range', () => {
    const document: GanttDocument = Object.freeze({
      schemaVersion: 1,
      assignments: Object.freeze([]),
      dependencies: Object.freeze([]),
      tasks: Object.freeze([
        Object.freeze({
          id: 'task-a',
          kind: 'task' as const,
          segments: Object.freeze([]),
          title: 'A',
          schedule: Object.freeze({ mode: 'instant' as const, start: START, end: START + DAY }),
        }),
      ]),
      resources: Object.freeze([]),
      lanes: Object.freeze([Object.freeze({ id: 'lane-a', title: 'Lane A' })]),
      placements: Object.freeze([
        Object.freeze({ id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' }),
      ]),
    });

    expect(() => build(document)).not.toThrow();
    expect(document.tasks[0]?.title).toBe('A');
    expect(() =>
      buildChartScene({
        document,
        range: { start: START, end: START },
        tickAnchor: START,
        tickInterval: DAY,
        timeZone: 'UTC',
      }),
    ).toThrow(RangeError);
  });
});

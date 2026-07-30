import { describe, expect, it } from 'vite-plus/test';

import type { GanttEntityChange, PlacementRecord, TaskRecord } from '@gantempo/gantt';
import { createExampleApiWrite } from './example-persistence';

function task(start: number, end: number, title = 'Work item 1'): TaskRecord {
  return Object.freeze({
    id: 'interactive-task-1',
    kind: 'task',
    schedule: Object.freeze({ end, mode: 'instant', start }),
    segments: Object.freeze([]),
    title,
  });
}

describe('example persistence projection', () => {
  it('renders a task drag as the old and new ISO schedule', () => {
    const entityChanges: readonly GanttEntityChange[] = [
      Object.freeze({
        after: task(Date.UTC(2026, 7, 3), Date.UTC(2026, 7, 7)),
        before: task(Date.UTC(2026, 6, 29), Date.UTC(2026, 7, 2)),
        collection: 'tasks',
        id: 'interactive-task-1',
        kind: 'update',
      }),
    ];

    expect(
      createExampleApiWrite(
        { baseRevision: 'example-server-r17', entityChanges },
        'example-operation-001',
      ),
    ).toEqual({
      baseRevision: 'example-server-r17',
      changes: [
        {
          before: {
            end: '2026-08-02T00:00:00.000Z',
            start: '2026-07-29T00:00:00.000Z',
          },
          task: { id: 'interactive-task-1', title: 'Work item 1' },
          type: 'task.schedule.updated',
          update: {
            end: '2026-08-07T00:00:00.000Z',
            start: '2026-08-03T00:00:00.000Z',
          },
        },
      ],
      operationId: 'example-operation-001',
    });
  });

  it('keeps a cross-lane placement update explicit in the same batch', () => {
    const before: PlacementRecord = Object.freeze({
      id: 'interactive-placement-1',
      laneId: 'discovery',
      taskId: 'interactive-task-1',
    });
    const after: PlacementRecord = Object.freeze({ ...before, laneId: 'design' });

    expect(
      createExampleApiWrite(
        {
          entityChanges: [
            Object.freeze({
              after,
              before,
              collection: 'placements',
              id: before.id,
              kind: 'update',
            }),
          ],
        },
        'example-operation-002',
      ),
    ).toEqual({
      baseRevision: null,
      changes: [
        {
          before: { laneId: 'discovery' },
          entity: { id: 'interactive-placement-1', type: 'placement' },
          type: 'placement.updated',
          update: { laneId: 'design' },
        },
      ],
      operationId: 'example-operation-002',
    });
  });

  it('retains canonical schedule mode in full task creates', () => {
    const created = task(Date.UTC(2026, 7, 3), Date.UTC(2026, 7, 7));

    expect(
      createExampleApiWrite(
        {
          entityChanges: [
            Object.freeze({
              after: created,
              collection: 'tasks',
              id: created.id,
              kind: 'create',
            }),
          ],
        },
        'example-operation-003',
      ).changes[0],
    ).toEqual({
      entity: {
        id: 'interactive-task-1',
        title: 'Work item 1',
        type: 'task',
      },
      type: 'task.created',
      value: {
        id: 'interactive-task-1',
        kind: 'task',
        schedule: {
          end: '2026-08-07T00:00:00.000Z',
          mode: 'instant',
          start: '2026-08-03T00:00:00.000Z',
        },
        segments: [],
        title: 'Work item 1',
      },
    });
  });
});

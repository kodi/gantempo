import type { GanttDocument } from '../model/types';

export function createPatchTestDocument(): GanttDocument {
  return Object.freeze({
    assignments: Object.freeze([
      Object.freeze({
        allocation: 1,
        id: 'shared',
        resourceId: 'resource-1',
        taskId: 'task-1',
      }),
    ]),
    dependencies: Object.freeze([
      Object.freeze({
        fromTaskId: 'task-1',
        id: 'shared',
        toTaskId: 'task-2',
        type: 'finish-to-start' as const,
      }),
    ]),
    lanes: Object.freeze([
      Object.freeze({
        id: 'shared',
        resourceId: 'resource-1',
        title: 'Delivery',
      }),
    ]),
    metadata: Object.freeze({ source: 'patch-test' }),
    placements: Object.freeze([
      Object.freeze({
        assignmentId: 'shared',
        id: 'shared',
        laneId: 'shared',
        segmentId: 'segment-1',
        taskId: 'task-1',
      }),
    ]),
    resources: Object.freeze([
      Object.freeze({
        capacity: 1,
        id: 'resource-1',
        title: 'Team',
      }),
    ]),
    revision: 'revision-7',
    schemaVersion: 1,
    tasks: Object.freeze([
      Object.freeze({
        fields: Object.freeze({ priority: 'high' }),
        id: 'task-1',
        kind: 'task' as const,
        schedule: Object.freeze({
          end: 20,
          mode: 'instant' as const,
          start: 10,
        }),
        segments: Object.freeze([
          Object.freeze({
            id: 'segment-1',
            schedule: Object.freeze({
              end: 15,
              mode: 'instant' as const,
              start: 10,
            }),
          }),
        ]),
        title: 'First',
      }),
      Object.freeze({
        id: 'task-2',
        kind: 'milestone' as const,
        schedule: Object.freeze({
          endDate: '2026-07-30',
          mode: 'all-day' as const,
          startDate: '2026-07-30',
        }),
        segments: Object.freeze([]),
        title: 'Second',
      }),
    ]),
  });
}

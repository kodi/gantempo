import { describe, expect, it } from 'vite-plus/test';

import { buildDocumentIndexes } from './indexes';
import type { GanttDocument } from './types';

describe('document indexes', () => {
  it('builds stable primary, hierarchy, segment, and relationship lookups', () => {
    const document: GanttDocument = {
      assignments: [
        { id: 'assignment-b', resourceId: 'resource-a', taskId: 'task-a' },
        { id: 'assignment-a', resourceId: 'resource-a', taskId: 'task-a' },
      ],
      dependencies: [
        {
          fromTaskId: 'task-a',
          id: 'dependency-b',
          toTaskId: 'task-b',
          type: 'finish-to-start',
        },
        {
          fromTaskId: 'task-a',
          id: 'dependency-a',
          toTaskId: 'task-b',
          type: 'start-to-start',
        },
      ],
      lanes: [
        { id: 'lane-parent', title: 'Parent' },
        { id: 'lane-child', parentId: 'lane-parent', title: 'Child' },
      ],
      placements: [
        {
          assignmentId: 'assignment-b',
          id: 'placement-b',
          laneId: 'lane-child',
          segmentId: 'segment-b',
          taskId: 'task-a',
        },
        {
          assignmentId: 'assignment-a',
          id: 'placement-a',
          laneId: 'lane-child',
          segmentId: 'segment-a',
          taskId: 'task-a',
        },
      ],
      resources: [
        { id: 'resource-parent', title: 'Parent' },
        { id: 'resource-a', parentId: 'resource-parent', title: 'A' },
      ],
      schemaVersion: 1,
      tasks: [
        {
          id: 'task-parent',
          kind: 'summary',
          segments: [],
          title: 'Parent',
        },
        {
          id: 'task-a',
          kind: 'task',
          order: 2,
          parentId: 'task-parent',
          segments: [
            { id: 'segment-b', schedule: { end: 2, mode: 'instant', start: 1 } },
            { id: 'segment-a', schedule: { end: 1, mode: 'instant', start: 0 } },
          ],
          title: 'A',
        },
        {
          id: 'task-child-first',
          kind: 'task',
          order: 1,
          parentId: 'task-parent',
          segments: [],
          title: 'First child',
        },
        { id: 'task-b', kind: 'task', segments: [], title: 'B' },
      ],
    };

    const indexes = buildDocumentIndexes(document);

    expect([...indexes.tasksById]).toEqual(document.tasks.map((task) => [task.id, task]));
    expect(indexes.taskChildrenByParentId.get('task-parent')?.map((task) => task.id)).toEqual([
      'task-child-first',
      'task-a',
    ]);
    expect(
      indexes.resourceChildrenByParentId.get('resource-parent')?.map((resource) => resource.id),
    ).toEqual(['resource-a']);
    expect(indexes.laneChildrenByParentId.get('lane-parent')?.map((lane) => lane.id)).toEqual([
      'lane-child',
    ]);
    expect([...indexes.segmentsByTaskId.get('task-a')!]).toEqual(
      document.tasks[1]?.segments.map((segment) => [segment.id, segment]),
    );
    expect(indexes.assignmentsByTaskId.get('task-a')?.map((record) => record.id)).toEqual([
      'assignment-b',
      'assignment-a',
    ]);
    expect(indexes.assignmentsByResourceId.get('resource-a')?.map((record) => record.id)).toEqual([
      'assignment-b',
      'assignment-a',
    ]);
    expect(indexes.placementsByTaskId.get('task-a')?.map((record) => record.id)).toEqual([
      'placement-b',
      'placement-a',
    ]);
    expect(indexes.placementsByLaneId.get('lane-child')?.map((record) => record.id)).toEqual([
      'placement-b',
      'placement-a',
    ]);
    expect(
      indexes.placementsByAssignmentId.get('assignment-b')?.map((record) => record.id),
    ).toEqual(['placement-b']);
    expect(indexes.dependenciesBySourceTaskId.get('task-a')?.map((record) => record.id)).toEqual([
      'dependency-b',
      'dependency-a',
    ]);
    expect(indexes.dependenciesByTargetTaskId.get('task-b')?.map((record) => record.id)).toEqual([
      'dependency-b',
      'dependency-a',
    ]);
    expect(Object.isFrozen(indexes.assignmentsByTaskId.get('task-a'))).toBe(true);
    expect(document.assignments.map((record) => record.id)).toEqual([
      'assignment-b',
      'assignment-a',
    ]);
  });

  it('returns complete empty lookup maps without filtering or diagnostics', () => {
    const indexes = buildDocumentIndexes({
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [],
    });

    expect(indexes.tasksById.size).toBe(0);
    expect(indexes.taskChildrenByParentId.size).toBe(0);
    expect(indexes.taskHierarchy.orderedTasks).toEqual([]);
    expect(indexes.taskHierarchy.roots).toEqual([]);
    expect('diagnostics' in indexes).toBe(false);
  });
});

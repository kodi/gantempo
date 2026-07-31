import { describe, expect, it } from 'vite-plus/test';

import { parseGanttDocument } from './codec';
import type { GanttDocument } from './types';
import { validateDocumentReferences } from './validate';

function documentWith(overrides: Partial<GanttDocument>): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: [],
    ...overrides,
  };
}

describe('validateDocumentReferences', () => {
  it('clears invalid primary-record references without dropping primary records', () => {
    const document = documentWith({
      lanes: [
        { id: 'lane-a', parentId: 'missing-lane', resourceId: 'missing-resource', title: 'A' },
      ],
      resources: [{ id: 'resource-a', parentId: 'missing-resource', title: 'A' }],
      tasks: [{ id: 'task-a', kind: 'task', parentId: 'missing-task', segments: [], title: 'A' }],
    });

    const result = validateDocumentReferences(document);

    expect(result.document.tasks).toEqual([
      { id: 'task-a', kind: 'task', segments: [], title: 'A' },
    ]);
    expect(result.document.resources).toEqual([{ id: 'resource-a', title: 'A' }]);
    expect(result.document.lanes).toEqual([{ id: 'lane-a', title: 'A' }]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'reference.task-parent',
      'reference.resource-parent',
      'reference.lane-parent',
      'reference.lane-resource',
    ]);
    expect(document.tasks[0]?.parentId).toBe('missing-task');
  });

  it('repairs invalid task hierarchy edges deterministically without dropping tasks', () => {
    const document = documentWith({
      tasks: [
        { id: 'self', kind: 'summary', parentId: 'self', segments: [], title: 'Self' },
        { id: 'leaf-parent', kind: 'task', segments: [], title: 'Leaf parent' },
        {
          id: 'leaf-child',
          kind: 'task',
          parentId: 'leaf-parent',
          segments: [],
          title: 'Leaf child',
        },
        { id: 'c', kind: 'summary', parentId: 'a', segments: [], title: 'C' },
        { id: 'a', kind: 'summary', parentId: 'b', segments: [], title: 'A' },
        { id: 'b', kind: 'summary', parentId: 'c', segments: [], title: 'B' },
        { id: 'unrelated', kind: 'task', segments: [], title: 'Unrelated' },
      ],
    });

    const result = validateDocumentReferences(document);

    expect(result.document.tasks.map((task) => task.id)).toEqual(
      document.tasks.map((task) => task.id),
    );
    expect(result.document.tasks.find((task) => task.id === 'self')).not.toHaveProperty('parentId');
    expect(result.document.tasks.find((task) => task.id === 'leaf-child')).not.toHaveProperty(
      'parentId',
    );
    expect(result.document.tasks.find((task) => task.id === 'a')).not.toHaveProperty('parentId');
    expect(result.document.tasks.find((task) => task.id === 'b')?.parentId).toBe('c');
    expect(result.document.tasks.find((task) => task.id === 'c')?.parentId).toBe('a');
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'reference.task-parent-self',
      'reference.task-parent-kind',
      'reference.task-parent-cycle',
    ]);
    expect(result.diagnostics[2]).toMatchObject({
      details: { cyclePath: ['a', 'b', 'c', 'a'] },
      entityIds: ['a', 'b', 'c'],
      path: '/tasks/4/parentId',
    });
    expect(document.tasks.find((task) => task.id === 'a')?.parentId).toBe('b');
  });

  it('preserves and diagnoses unequal milestone input at the permissive parse boundary', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      tasks: [
        {
          id: 'milestone',
          kind: 'milestone',
          schedule: { end: 20, mode: 'instant', start: 10 },
          title: 'Milestone',
        },
      ],
    });

    expect(result.document?.tasks[0]?.schedule).toEqual({
      end: 20,
      mode: 'instant',
      start: 10,
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'presentation.milestone-interval',
        path: '/tasks/0/schedule',
        severity: 'warning',
      }),
    );
  });

  it('omits invalid relationships and preserves valid document order', () => {
    const document = documentWith({
      assignments: [
        { id: 'assignment-valid', resourceId: 'resource-a', taskId: 'task-a' },
        { id: 'assignment-task', resourceId: 'resource-a', taskId: 'missing' },
        { id: 'assignment-resource', resourceId: 'missing', taskId: 'task-a' },
      ],
      dependencies: [
        {
          fromTaskId: 'task-a',
          id: 'dependency-valid',
          toTaskId: 'task-b',
          type: 'finish-to-start',
        },
        {
          fromTaskId: 'missing',
          id: 'dependency-source',
          toTaskId: 'task-b',
          type: 'finish-to-start',
        },
        {
          fromTaskId: 'task-a',
          id: 'dependency-target',
          toTaskId: 'missing',
          type: 'finish-to-start',
        },
        {
          fromTaskId: 'task-a',
          id: 'dependency-self',
          toTaskId: 'task-a',
          type: 'finish-to-start',
        },
      ],
      lanes: [{ id: 'lane-a', title: 'A' }],
      placements: [
        {
          assignmentId: 'assignment-valid',
          id: 'placement-valid',
          laneId: 'lane-a',
          segmentId: 'segment-a',
          taskId: 'task-a',
        },
        { id: 'placement-task', laneId: 'lane-a', taskId: 'missing' },
        { id: 'placement-lane', laneId: 'missing', taskId: 'task-a' },
        {
          assignmentId: 'assignment-task',
          id: 'placement-assignment',
          laneId: 'lane-a',
          taskId: 'task-a',
        },
        {
          id: 'placement-segment',
          laneId: 'lane-a',
          segmentId: 'segment-b',
          taskId: 'task-a',
        },
      ],
      resources: [{ id: 'resource-a', title: 'A' }],
      tasks: [
        {
          id: 'task-a',
          kind: 'task',
          segments: [
            {
              id: 'segment-a',
              schedule: { end: 1, mode: 'instant', start: 0 },
            },
          ],
          title: 'A',
        },
        {
          id: 'task-b',
          kind: 'task',
          segments: [
            {
              id: 'segment-b',
              schedule: { end: 2, mode: 'instant', start: 1 },
            },
          ],
          title: 'B',
        },
      ],
    });

    const result = validateDocumentReferences(document);

    expect(result.document.assignments.map((record) => record.id)).toEqual(['assignment-valid']);
    expect(result.document.placements.map((record) => record.id)).toEqual(['placement-valid']);
    expect(result.document.dependencies.map((record) => record.id)).toEqual(['dependency-valid']);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'reference.assignment-task',
      'reference.assignment-resource',
      'reference.placement-task',
      'reference.placement-lane',
      'reference.placement-assignment',
      'reference.placement-segment',
      'reference.dependency-source',
      'reference.dependency-target',
      'reference.dependency-self',
    ]);
  });

  it('keeps original input paths through structural recovery cascades', () => {
    const result = parseGanttDocument({
      schemaVersion: 1,
      tasks: [
        { id: 'bad-task', title: 42 },
        { id: 'good-task', title: 'Good' },
      ],
      resources: [{ id: 'resource-a', title: 'A' }],
      lanes: [{ id: 'lane-a', title: 'A' }],
      assignments: [
        { id: 'assignment-bad', resourceId: 'resource-a', taskId: 'bad-task' },
        { id: 'assignment-good', resourceId: 'resource-a', taskId: 'good-task' },
      ],
      placements: [
        'malformed',
        { id: 'placement-bad', laneId: 'lane-a', taskId: 'bad-task' },
        { id: 'placement-good', laneId: 'lane-a', taskId: 'good-task' },
      ],
    });

    expect(result.document?.assignments.map((record) => record.id)).toEqual(['assignment-good']);
    expect(result.document?.placements.map((record) => record.id)).toEqual(['placement-good']);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'reference.assignment-task',
          path: '/assignments/0/taskId',
        }),
        expect.objectContaining({
          code: 'reference.placement-task',
          path: '/placements/1/taskId',
        }),
      ]),
    );
  });

  it('is stable for an empty document', () => {
    const document = documentWith({});
    const result = validateDocumentReferences(document);

    expect(result.document).toEqual(document);
    expect(result.diagnostics).toEqual([]);
  });
});

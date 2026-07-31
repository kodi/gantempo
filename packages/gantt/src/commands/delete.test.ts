import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

function withTaskTree(): GanttDocument {
  const base = createPatchTestDocument();
  return Object.freeze({
    ...base,
    assignments: Object.freeze([
      ...base.assignments,
      Object.freeze({
        id: 'assignment-child',
        resourceId: 'resource-1',
        taskId: 'task-child',
      }),
    ]),
    dependencies: Object.freeze([
      ...base.dependencies,
      Object.freeze({
        fromTaskId: 'task-child',
        id: 'dependency-child',
        toTaskId: 'task-2',
        type: 'finish-to-start' as const,
      }),
    ]),
    placements: Object.freeze([
      ...base.placements,
      Object.freeze({
        assignmentId: 'assignment-child',
        id: 'placement-child',
        laneId: 'shared',
        taskId: 'task-child',
      }),
    ]),
    tasks: Object.freeze([
      ...base.tasks.map((task) =>
        task.id === 'task-1' ? Object.freeze({ ...task, kind: 'summary' as const }) : task,
      ),
      Object.freeze({
        id: 'task-child',
        kind: 'summary' as const,
        parentId: 'task-1',
        segments: Object.freeze([]),
        title: 'Child',
      }),
      Object.freeze({
        id: 'task-grandchild',
        kind: 'task' as const,
        parentId: 'task-child',
        segments: Object.freeze([]),
        title: 'Grandchild',
      }),
    ]),
  });
}

describe('referential deletion', () => {
  it('rejects task deletion by default and cascades in canonical collection order', () => {
    const base = withTaskTree();
    const rejected = applyGanttCommand(base, {
      id: 'task-1',
      type: 'task.delete',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.document).toBe(base);
    expect(rejected.diagnostics[0]?.code).toBe('command.strict-reference');

    const outcome = applyGanttCommand(base, {
      cascade: true,
      id: 'task-1',
      type: 'task.delete',
    });
    expect(outcome.status).toBe('committed');
    expect(outcome.document.tasks.map((task) => task.id)).toEqual(['task-2']);
    expect(outcome.document.assignments).toEqual([]);
    expect(outcome.document.placements).toEqual([]);
    expect(outcome.document.dependencies).toEqual([]);
    expect(outcome.document.resources).toBe(base.resources);
    expect(outcome.document.lanes).toBe(base.lanes);
    expect(outcome.patches.map((patch) => patch.target.collection)).toEqual([
      'tasks',
      'tasks',
      'tasks',
      'assignments',
      'assignments',
      'placements',
      'placements',
      'dependencies',
      'dependencies',
    ]);
    expect(outcome.patches.map((patch) => patch.target.id)).toEqual([
      'task-1',
      'task-child',
      'task-grandchild',
      'shared',
      'assignment-child',
      'shared',
      'placement-child',
      'shared',
      'dependency-child',
    ]);

    const restored = applyGanttPatches(outcome.document, outcome.inversePatches);
    expect(restored.status).toBe('applied');
    expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
  });

  it('clears assignment references from placements and restores them on inversion', () => {
    const base = createPatchTestDocument();
    const outcome = applyGanttCommand(base, {
      id: 'shared',
      type: 'assignment.delete',
    });

    expect(outcome.status).toBe('committed');
    expect(outcome.document.assignments).toEqual([]);
    expect(outcome.document.placements[0]).not.toHaveProperty('assignmentId');
    expect(outcome.patches.map((patch) => patch.target.collection)).toEqual([
      'assignments',
      'placements',
    ]);
    const restored = applyGanttPatches(outcome.document, outcome.inversePatches);
    expect(restored.status).toBe('applied');
    expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
  });

  it('deletes placements and dependencies without confusing cross-family same IDs', () => {
    const base = createPatchTestDocument();
    const placement = applyGanttCommand(base, {
      id: 'shared',
      type: 'placement.delete',
    });
    expect(placement.status).toBe('committed');
    expect(placement.document.placements).toEqual([]);
    expect(placement.document.assignments[0]?.id).toBe('shared');
    expect(placement.document.dependencies[0]?.id).toBe('shared');
    expect(placement.document.lanes[0]?.id).toBe('shared');

    const dependency = applyGanttCommand(placement.document, {
      id: 'shared',
      type: 'dependency.delete',
    });
    expect(dependency.status).toBe('committed');
    expect(dependency.document.dependencies).toEqual([]);
    expect(dependency.document.assignments[0]?.id).toBe('shared');
    expect(dependency.document.lanes[0]?.id).toBe('shared');
  });

  it('terminates and removes a malformed cyclic ancestry when the cycle includes the target', () => {
    const base = createPatchTestDocument();
    const cyclic: GanttDocument = Object.freeze({
      ...base,
      assignments: Object.freeze([]),
      dependencies: Object.freeze([]),
      placements: Object.freeze([]),
      tasks: Object.freeze([
        Object.freeze({
          id: 'a',
          kind: 'summary' as const,
          parentId: 'b',
          segments: Object.freeze([]),
          title: 'A',
        }),
        Object.freeze({
          id: 'b',
          kind: 'summary' as const,
          parentId: 'a',
          segments: Object.freeze([]),
          title: 'B',
        }),
      ]),
    });

    const outcome = applyGanttCommand(cyclic, {
      cascade: true,
      id: 'a',
      type: 'task.delete',
    });
    expect(outcome.status).toBe('committed');
    expect(outcome.document.tasks).toEqual([]);
  });
});

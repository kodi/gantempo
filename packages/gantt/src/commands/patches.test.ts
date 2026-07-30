import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttPatch } from './types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';

describe('applyGanttPatches', () => {
  it('uses collection plus ID identity and replaces a task with all owned segments', () => {
    const base = createPatchTestDocument();
    const replacement = {
      ...base.tasks[0]!,
      segments: [
        ...base.tasks[0]!.segments,
        {
          id: 'segment-2',
          schedule: { end: 20, mode: 'instant' as const, start: 16 },
        },
      ],
      title: 'Updated',
    };
    const result = applyGanttPatches(base, [
      {
        op: 'replace',
        patchVersion: 1,
        target: { collection: 'tasks', id: 'task-1' },
        value: replacement,
      },
    ]);

    expect(result.status).toBe('applied');
    expect(result.document.tasks[0]).toEqual(replacement);
    expect(result.document.assignments[0]?.id).toBe('shared');
    expect(result.document.dependencies[0]?.id).toBe('shared');
    expect(result.document.lanes[0]?.id).toBe('shared');
    expect(result.document.placements[0]?.id).toBe('shared');
    expect(result.document.resources).toBe(base.resources);
    expect(result.document.assignments).toBe(base.assignments);
    expect(result.document.tasks[1]).toBe(base.tasks[1]);
    expect(result.document.revision).toBe(base.revision);
    expect(result.document.metadata).toBe(base.metadata);
    expect(Object.isFrozen(result.document.tasks)).toBe(true);
    expect(Object.isFrozen(result.document.tasks[0])).toBe(true);

    const restored = applyGanttPatches(result.document, result.inversePatches);
    expect(restored.status).toBe('applied');
    expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
  });

  it('rejects malformed and stale batches atomically', () => {
    const base = createPatchTestDocument();
    const malformed = applyGanttPatches(base, [
      {
        op: 'add',
        patchVersion: 1,
        target: { collection: 'resources', id: 'resource-2' },
        value: { id: 'resource-2', title: 'Second team' },
        index: 1,
      },
      {
        op: 'remove',
        patchVersion: 1,
        target: { collection: 'tasks', id: 'missing' },
      },
    ]);

    expect(malformed.status).toBe('rejected');
    expect(malformed.document).toBe(base);
    expect(malformed.patches).toEqual([]);
    expect(malformed.inversePatches).toEqual([]);
    expect(malformed.diagnostics[0]?.code).toBe('patch.missing-target');

    const wrongVersion = applyGanttPatches(base, [
      {
        op: 'remove',
        patchVersion: 2,
        target: { collection: 'tasks', id: 'task-1' },
      } as unknown as GanttPatch,
    ]);
    expect(wrongVersion.status).toBe('rejected');
    expect(wrongVersion.document).toBe(base);
    expect(wrongVersion.diagnostics[0]?.code).toBe('patch.invalid-version');
  });

  it('validates references after the complete multi-patch final state', () => {
    const base = createPatchTestDocument();
    const result = applyGanttPatches(base, [
      {
        op: 'replace',
        patchVersion: 1,
        target: { collection: 'assignments', id: 'shared' },
        value: {
          ...base.assignments[0]!,
          taskId: 'task-2',
        },
      },
      {
        op: 'replace',
        patchVersion: 1,
        target: { collection: 'placements', id: 'shared' },
        value: {
          id: 'shared',
          assignmentId: 'shared',
          laneId: 'shared',
          taskId: 'task-2',
        },
      },
    ]);

    expect(result.status).toBe('applied');
    expect(result.document.assignments[0]?.taskId).toBe('task-2');
    expect(result.document.placements[0]?.taskId).toBe('task-2');
    const restored = applyGanttPatches(result.document, result.inversePatches);
    expect(restored.status).toBe('applied');
    expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
  });
});

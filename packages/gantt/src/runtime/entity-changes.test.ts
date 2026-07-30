import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import { createPatchTestDocument } from '../commands/patches.test-fixtures';
import { createGanttEntityChanges } from './entity-changes';

function committed(
  document: ReturnType<typeof createPatchTestDocument>,
  command: Parameters<typeof applyGanttCommand>[1],
) {
  const outcome = applyGanttCommand(document, command);
  if (outcome.status !== 'committed') {
    throw new Error(outcome.diagnostics[0]?.message ?? 'Expected a committed test command.');
  }
  return outcome;
}

describe('Gantt entity changes', () => {
  it('coalesces repeated transaction patches into one explicit before/after row update', () => {
    const base = createPatchTestDocument();
    const outcome = committed(base, {
      commands: [
        {
          changes: {
            appearance: { variant: 'customer:blocked' },
            description: 'Persistence-ready details',
            title: 'Updated',
          },
          id: 'task-1',
          type: 'task.update',
        },
        { delta: 5, id: 'task-1', type: 'task.move' },
      ],
      type: 'transaction',
    });

    const changes = createGanttEntityChanges(base, outcome.document, outcome.patches);

    expect(changes).toEqual([
      {
        after: expect.objectContaining({
          appearance: { variant: 'customer:blocked' },
          description: 'Persistence-ready details',
          id: 'task-1',
          schedule: { end: 25, mode: 'instant', start: 15 },
          title: 'Updated',
        }),
        before: base.tasks[0],
        collection: 'tasks',
        id: 'task-1',
        kind: 'update',
      },
    ]);
    expect(Object.isFrozen(changes)).toBe(true);
    expect(Object.isFrozen(changes[0])).toBe(true);
  });

  it('projects creates and their inverse direction without pairing patches', () => {
    const base = createPatchTestDocument();
    const outcome = committed(base, {
      type: 'resource.add',
      value: { id: 'resource-2', title: 'Second team' },
    });

    expect(createGanttEntityChanges(base, outcome.document, outcome.patches)).toEqual([
      {
        after: outcome.document.resources[1],
        collection: 'resources',
        id: 'resource-2',
        kind: 'create',
      },
    ]);
    expect(createGanttEntityChanges(outcome.document, base, outcome.inversePatches)).toEqual([
      {
        before: outcome.document.resources[1],
        collection: 'resources',
        id: 'resource-2',
        kind: 'delete',
      },
    ]);
  });

  it('keeps same IDs in different collections distinct during cascade deletion', () => {
    const base = createPatchTestDocument();
    const outcome = committed(base, {
      cascade: true,
      id: 'task-1',
      type: 'task.delete',
    });

    const changes = createGanttEntityChanges(base, outcome.document, outcome.patches);

    expect(changes.map(({ collection, id, kind }) => ({ collection, id, kind }))).toEqual([
      { collection: 'tasks', id: 'task-1', kind: 'delete' },
      { collection: 'assignments', id: 'shared', kind: 'delete' },
      { collection: 'placements', id: 'shared', kind: 'delete' },
      { collection: 'dependencies', id: 'shared', kind: 'delete' },
    ]);
  });

  it('omits a repeatedly touched row that returns to its base value', () => {
    const base = createPatchTestDocument();
    const outcome = committed(base, {
      commands: [
        {
          changes: { title: 'Temporary' },
          id: 'task-1',
          type: 'task.update',
        },
        {
          changes: { title: 'First' },
          id: 'task-1',
          type: 'task.update',
        },
        {
          changes: { title: 'Changed lane' },
          id: 'shared',
          type: 'lane.update',
        },
      ],
      type: 'transaction',
    });

    expect(createGanttEntityChanges(base, outcome.document, outcome.patches)).toEqual([
      {
        after: outcome.document.lanes[0],
        before: base.lanes[0],
        collection: 'lanes',
        id: 'shared',
        kind: 'update',
      },
    ]);
  });
});

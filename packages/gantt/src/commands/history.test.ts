import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttCommand } from './types';
import {
  clearGanttHistory,
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
  type GanttHistoryState,
} from './history';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

function commitCommand(history: GanttHistoryState, command: GanttCommand): GanttHistoryState {
  const outcome = applyGanttCommand(history.document, command);
  expect(outcome.status).toBe('committed');
  const committed = commitGanttHistory(history, outcome);
  expect(committed.status).toBe('applied');
  return committed.history;
}

describe('bounded immutable local history', () => {
  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects invalid capacity %s',
    (capacity) => {
      expect(() => createGanttHistory(createPatchTestDocument(), capacity)).toThrow(RangeError);
    },
  );

  it('records only committed non-empty outcomes and treats a transaction as one entry', () => {
    const base = createPatchTestDocument();
    const initial = createGanttHistory(base, 4);
    const noOp = applyGanttCommand(base, {
      changes: { title: 'First' },
      id: 'task-1',
      type: 'task.update',
    });
    const afterNoOp = commitGanttHistory(initial, noOp);
    expect(afterNoOp.status).toBe('applied');
    expect(afterNoOp.history).toBe(initial);

    const rejected = applyGanttCommand(base, {
      type: 'task.add',
      value: { id: 'task-1', title: 'Duplicate' },
    });
    const afterRejected = commitGanttHistory(initial, rejected);
    expect(afterRejected.status).toBe('applied');
    expect(afterRejected.history).toBe(initial);

    const transaction = applyGanttCommand(base, {
      commands: [
        { type: 'task.add', value: { id: 'third', title: 'Third' } },
        { type: 'resource.add', value: { id: 'second', title: 'Second' } },
      ],
      type: 'transaction',
    });
    const committed = commitGanttHistory(initial, transaction);
    expect(committed.status).toBe('applied');
    expect(committed.history.past).toHaveLength(1);
    expect(committed.history.past[0]?.patches).toHaveLength(2);
    expect(Object.isFrozen(committed.history)).toBe(true);
    expect(Object.isFrozen(committed.history.past)).toBe(true);
    expect(Object.isFrozen(committed.history.past[0])).toBe(true);
  });

  it('bounds past entries, supports undo/redo, and clears a redo branch on commit', () => {
    const base = createPatchTestDocument();
    let history = createGanttHistory(base, 2);
    history = commitCommand(history, {
      type: 'task.add',
      value: { fields: { sequence: 1 }, id: 'one', title: 'One' },
    });
    history = commitCommand(history, {
      type: 'task.add',
      value: { fields: { sequence: 2 }, id: 'two', title: 'Two' },
    });
    history = commitCommand(history, {
      type: 'task.add',
      value: { fields: { sequence: 3 }, id: 'three', title: 'Three' },
    });
    expect(history.past).toHaveLength(2);

    const undoThree = undoGanttHistory(history);
    expect(undoThree.status).toBe('applied');
    expect(undoThree.history.document.tasks.some((task) => task.id === 'three')).toBe(false);
    expect(undoThree.history.future).toHaveLength(1);
    const undoTwo = undoGanttHistory(undoThree.history);
    expect(undoTwo.status).toBe('applied');
    expect(undoTwo.history.document.tasks.some((task) => task.id === 'two')).toBe(false);
    expect(undoTwo.history.document.tasks.some((task) => task.id === 'one')).toBe(true);

    const redoTwo = redoGanttHistory(undoTwo.history);
    expect(redoTwo.status).toBe('applied');
    expect(redoTwo.history.document.tasks.some((task) => task.id === 'two')).toBe(true);
    expect(redoTwo.history.future).toHaveLength(1);

    const branched = commitCommand(redoTwo.history, {
      type: 'task.add',
      value: { id: 'branch', title: 'Branch' },
    });
    expect(branched.future).toEqual([]);
    expect(branched.past).toHaveLength(2);
    expect(clearGanttHistory(branched)).toMatchObject({ future: [], past: [] });
  });

  it('fails closed on stale undo and retains document and stacks by identity', () => {
    const base = createPatchTestDocument();
    const committed = commitCommand(createGanttHistory(base, 3), {
      id: 'shared',
      type: 'assignment.delete',
    });
    const staleOutcome = applyGanttCommand(committed.document, {
      type: 'assignment.set',
      value: {
        id: 'shared',
        resourceId: 'resource-1',
        taskId: 'task-1',
      },
    });
    expect(staleOutcome.status).toBe('committed');
    const stale: GanttHistoryState = Object.freeze({
      ...committed,
      document: staleOutcome.document,
    });
    const undo = undoGanttHistory(stale);

    expect(undo.status).toBe('rejected');
    expect(undo.history).toBe(stale);
    expect(undo.history.past).toBe(committed.past);
    expect(undo.history.future).toBe(committed.future);
  });

  it('restores cascade relationships and extension data through undo and redo', () => {
    const base = createPatchTestDocument();
    let history = createGanttHistory(base, 4);
    history = commitCommand(history, {
      cascade: true,
      id: 'task-1',
      type: 'task.delete',
    });
    const afterDelete = serializeGanttDocument(history.document);
    const undone = undoGanttHistory(history);
    expect(undone.status).toBe('applied');
    expect(serializeGanttDocument(undone.history.document)).toBe(serializeGanttDocument(base));
    expect(undone.history.document.tasks[0]?.fields).toEqual({ priority: 'high' });
    expect(undone.history.document.assignments[0]?.id).toBe('shared');
    expect(undone.history.document.placements[0]?.assignmentId).toBe('shared');

    const redone = redoGanttHistory(undone.history);
    expect(redone.status).toBe('applied');
    expect(serializeGanttDocument(redone.history.document)).toBe(afterDelete);
  });
});

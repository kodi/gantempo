import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { createGanttEntityChanges } from '../runtime/entity-changes';
import {
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
} from './history';
import { applyGanttPatches } from './patches';
import { applyGanttCommand } from './reduce';

function fixture(): GanttDocument {
  return {
    assignments: [],
    dependencies: [
      { fromTaskId: 'a', id: 'ab', toTaskId: 'b', type: 'finish-to-start' },
      { fromTaskId: 'b', id: 'bc', toTaskId: 'c', type: 'start-to-start' },
    ],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      kind: id === 'd' ? ('summary' as const) : ('task' as const),
      schedule: { end: 20, mode: 'instant' as const, start: 10 },
      segments: [],
      title: id.toUpperCase(),
    })),
  };
}

describe('dependency.update command', () => {
  it('normalizes all mutable fields and produces direct patches, inverses, and changes', () => {
    const base = fixture();
    const outcome = applyGanttCommand(base, {
      changes: {
        fields: { note: 'manual only' },
        fromTaskId: 'd',
        lag: { unit: 'hour', value: -3 },
        toTaskId: 'c',
        type: 'finish-to-finish',
      },
      id: 'ab',
      type: 'dependency.update',
    });

    expect(outcome.status).toBe('committed');
    expect(outcome.document.tasks).toBe(base.tasks);
    expect(outcome.document.tasks.map((task) => task.schedule)).toEqual(
      base.tasks.map((task) => task.schedule),
    );
    expect(outcome.document.dependencies[0]).toEqual({
      fields: { note: 'manual only' },
      fromTaskId: 'd',
      id: 'ab',
      lag: { unit: 'hour', value: -3 },
      toTaskId: 'c',
      type: 'finish-to-finish',
    });
    expect(outcome.affected).toEqual([
      { collection: 'dependencies', id: 'ab' },
      { collection: 'tasks', id: 'a' },
      { collection: 'tasks', id: 'b' },
      { collection: 'tasks', id: 'd' },
      { collection: 'tasks', id: 'c' },
    ]);
    expect(outcome.patches).toHaveLength(1);
    expect(applyGanttPatches(outcome.document, outcome.inversePatches)).toMatchObject({
      document: base,
      status: 'applied',
    });
    expect(createGanttEntityChanges(base, outcome.document, outcome.patches)).toEqual([
      {
        after: outcome.document.dependencies[0],
        before: base.dependencies[0],
        collection: 'dependencies',
        id: 'ab',
        kind: 'update',
      },
    ]);
  });

  it('supports null clearing, atomic transactions, and one-entry undo/redo', () => {
    const base = fixture();
    const seeded = applyGanttCommand(base, {
      changes: { fields: { owner: 'Ada' }, lag: { mode: 'working', unit: 'day', value: 2 } },
      id: 'ab',
      type: 'dependency.update',
    });
    expect(seeded.status).toBe('committed');
    const outcome = applyGanttCommand(seeded.document, {
      commands: [
        { changes: { fields: null, lag: null }, id: 'ab', type: 'dependency.update' },
        { changes: { type: 'finish-to-finish' }, id: 'bc', type: 'dependency.update' },
      ],
      type: 'transaction',
    });
    expect(outcome.status).toBe('committed');
    expect(outcome.document.dependencies[0]).not.toHaveProperty('lag');
    expect(outcome.document.dependencies[0]).not.toHaveProperty('fields');

    const committed = commitGanttHistory(createGanttHistory(seeded.document, 100), outcome);
    expect(committed.status).toBe('applied');
    expect(committed.history.past).toHaveLength(1);
    const undone = undoGanttHistory(committed.history);
    expect(undone.status).toBe('applied');
    expect(undone.history.document).toEqual(seeded.document);
    const redone = redoGanttHistory(undone.history);
    expect(redone.status).toBe('applied');
    expect(redone.history.document).toEqual(outcome.document);
  });

  it('rejects missing endpoints, self-links, semantic duplicates, and introduced cycles', () => {
    const cases = [
      {
        changes: { fromTaskId: 'missing' },
        code: 'reference.dependency-source',
        id: 'ab',
      },
      { changes: { toTaskId: 'a' }, code: 'reference.dependency-self', id: 'ab' },
      {
        changes: { fromTaskId: 'b', toTaskId: 'c', type: 'start-to-start' },
        code: 'dependency.duplicate',
        id: 'ab',
      },
      {
        changes: { fromTaskId: 'c', toTaskId: 'b' },
        code: 'dependency.cycle',
        id: 'ab',
      },
    ] as const;
    for (const testCase of cases) {
      const base = fixture();
      const outcome = applyGanttCommand(base, {
        changes: testCase.changes,
        id: testCase.id,
        type: 'dependency.update',
      });
      expect(outcome.status).toBe('rejected');
      expect(outcome.diagnostics[0]?.code).toBe(testCase.code);
      expect(outcome.document).toBe(base);
    }
  });

  it('applies the same semantic duplicate and cycle rules to dependency.add', () => {
    const base = fixture();
    const duplicate = applyGanttCommand(base, {
      type: 'dependency.add',
      value: { fromTaskId: 'a', id: 'duplicate', toTaskId: 'b', type: 'finish-to-start' },
    });
    expect(duplicate.status).toBe('rejected');
    expect(duplicate.diagnostics[0]?.code).toBe('dependency.duplicate');

    const cycle = applyGanttCommand(base, {
      type: 'dependency.add',
      value: { fromTaskId: 'c', id: 'ca', toTaskId: 'a', type: 'finish-to-start' },
    });
    expect(cycle.status).toBe('rejected');
    expect(cycle.diagnostics[0]?.code).toBe('dependency.cycle');

    const summaryEndpoint = applyGanttCommand(base, {
      type: 'dependency.add',
      value: { fromTaskId: 'd', id: 'da', toTaskId: 'a', type: 'finish-to-start' },
    });
    expect(summaryEndpoint.status).toBe('committed');
  });

  it('allows repairs and unrelated fields when the input already contains a cycle', () => {
    const base = fixture();
    const cyclic: GanttDocument = {
      ...base,
      dependencies: [
        ...base.dependencies,
        { fromTaskId: 'c', id: 'ca', toTaskId: 'a', type: 'finish-to-start' },
      ],
    };
    const fieldUpdate = applyGanttCommand(cyclic, {
      changes: { fields: { note: 'preserved cycle' } },
      id: 'ab',
      type: 'dependency.update',
    });
    expect(fieldUpdate.status).toBe('committed');

    const repair = applyGanttCommand(cyclic, {
      changes: { fromTaskId: 'd', toTaskId: 'a' },
      id: 'ca',
      type: 'dependency.update',
    });
    expect(repair.status).toBe('committed');
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument, TaskRecord } from '../model/types';
import { serializeGanttDocument } from '../model/serialize';
import {
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
} from './history';
import { applyGanttPatches } from './patches';
import { applyGanttCommand } from './reduce';

const PROPERTY_SEED = 20_260_731;
const PROPERTY_RUNS = 150;

function chainDocument(length: number, salt: number): GanttDocument {
  const tasks: TaskRecord[] = Array.from({ length }, (_, index) => ({
    id: `task-${index}`,
    kind: index === length - 1 ? ('task' as const) : ('summary' as const),
    ...(index === 0 ? {} : { parentId: `task-${index - 1}` }),
    segments: [],
    title: `Task ${index}`,
  }));
  tasks.sort(
    (left, right) =>
      ((Number(left.id.slice(5)) * 37 + salt) % 101) -
        ((Number(right.id.slice(5)) * 37 + salt) % 101) || left.id.localeCompare(right.id),
  );
  return Object.freeze({
    assignments: Object.freeze([]),
    dependencies: Object.freeze([]),
    lanes: Object.freeze([]),
    placements: Object.freeze([]),
    resources: Object.freeze([]),
    schemaVersion: 1,
    tasks: Object.freeze(tasks.map((task) => Object.freeze(task))),
  });
}

describe('hierarchy command properties', () => {
  it('reparents and orders arbitrary deep chains through patches and history', () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 50, min: 3 }),
        fc.integer(),
        fc.integer({ max: 1_000, min: -1_000 }),
        (length, salt, order) => {
          const base = chainDocument(length, salt);
          const leafId = `task-${length - 1}`;
          const outcome = applyGanttCommand(base, {
            changes: { order, parentId: 'task-0' },
            id: leafId,
            type: 'task.update',
          });

          expect(outcome.status).toBe('committed');
          if (outcome.status !== 'committed') {
            return;
          }
          expect(outcome.document.tasks.find((task) => task.id === leafId)).toMatchObject({
            order,
            parentId: 'task-0',
          });
          const replay = applyGanttPatches(base, outcome.patches);
          expect(replay.status).toBe('applied');
          expect(serializeGanttDocument(replay.document)).toBe(
            serializeGanttDocument(outcome.document),
          );
          const inverse = applyGanttPatches(outcome.document, outcome.inversePatches);
          expect(inverse.status).toBe('applied');
          expect(serializeGanttDocument(inverse.document)).toBe(serializeGanttDocument(base));

          const committed = commitGanttHistory(createGanttHistory(base, 2), outcome);
          expect(committed.status).toBe('applied');
          const undone = undoGanttHistory(committed.history);
          expect(undone.status).toBe('applied');
          expect(serializeGanttDocument(undone.history.document)).toBe(
            serializeGanttDocument(base),
          );
          const redone = redoGanttHistory(undone.history);
          expect(redone.status).toBe('applied');
          expect(serializeGanttDocument(redone.history.document)).toBe(
            serializeGanttDocument(outcome.document),
          );
        },
      ),
      { endOnFailure: true, numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });

  it('rejects every root-to-descendant reparent cycle without changing the document', () => {
    fc.assert(
      fc.property(fc.integer({ max: 60, min: 2 }), fc.integer(), (length, salt) => {
        const base = chainDocument(length, salt);
        const outcome = applyGanttCommand(base, {
          changes: { parentId: `task-${length - 1}` },
          id: 'task-0',
          type: 'task.update',
        });

        expect(outcome.status).toBe('rejected');
        expect(outcome.document).toBe(base);
        expect(
          outcome.diagnostics.some((item) => item.code === 'reference.task-parent-cycle'),
        ).toBe(true);
        expect(outcome.patches).toEqual([]);
      }),
      { endOnFailure: true, numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });
});

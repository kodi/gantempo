import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { EntityId, TaskRecord } from '../model/types';
import { buildTaskHierarchyIndexes, findTaskHierarchyCycles } from './task-hierarchy';

const PROPERTY_SEED = 20_260_731;
const PROPERTY_RUNS = 200;

const nodeArbitrary = fc.record({
  order: fc.option(fc.integer({ max: 10, min: -10 }), { nil: undefined }),
  parentSeed: fc.nat(),
  permutation: fc.integer(),
});

function isDescendant(
  tasksById: ReadonlyMap<EntityId, TaskRecord>,
  candidateId: EntityId,
  ancestorId: EntityId,
): boolean {
  const visited = new Set<EntityId>([candidateId]);
  let parentId = tasksById.get(candidateId)?.parentId;
  while (parentId !== undefined && !visited.has(parentId)) {
    if (parentId === ancestorId) {
      return true;
    }
    visited.add(parentId);
    parentId = tasksById.get(parentId)?.parentId;
  }
  return false;
}

describe('task hierarchy properties', () => {
  it('indexes every forest as one contiguous parent-before-child traversal', () => {
    fc.assert(
      fc.property(fc.array(nodeArbitrary, { maxLength: 60, minLength: 1 }), (nodes) => {
        const parentIds = new Set<EntityId>();
        const logicalTasks = nodes.map((node, index): TaskRecord => {
          const parentIndex = index === 0 ? index : node.parentSeed % (index + 1);
          const parentId = parentIndex === index ? undefined : `task-${parentIndex}`;
          if (parentId !== undefined) {
            parentIds.add(parentId);
          }
          return {
            id: `task-${index}`,
            kind: 'task',
            ...(node.order === undefined ? {} : { order: node.order }),
            ...(parentId === undefined ? {} : { parentId }),
            segments: [],
            title: `Task ${index}`,
          };
        });
        const tasks = logicalTasks
          .map((task, index) => ({
            ...task,
            kind: parentIds.has(task.id) ? ('summary' as const) : ('task' as const),
            permutation: nodes[index]!.permutation,
          }))
          .sort(
            (left, right) =>
              left.permutation - right.permutation || left.id.localeCompare(right.id),
          )
          .map(({ permutation: _permutation, ...task }) => task);

        const indexes = buildTaskHierarchyIndexes(tasks);
        const orderedIds = indexes.orderedTasks.map((task) => task.id);
        expect(new Set(orderedIds)).toEqual(new Set(tasks.map((task) => task.id)));
        expect(orderedIds).toHaveLength(tasks.length);

        const position = new Map(orderedIds.map((id, index) => [id, index]));
        for (const task of tasks) {
          if (task.parentId !== undefined) {
            expect(position.get(task.parentId)).toBeLessThan(position.get(task.id)!);
          }
          const range = indexes.subtreeRangeByTaskId.get(task.id)!;
          const actual = indexes.orderedTasks
            .slice(range.start + 1, range.end)
            .map((item) => item.id);
          const expected = indexes.orderedTasks
            .filter((item) => isDescendant(indexes.tasksById, item.id, task.id))
            .map((item) => item.id);
          expect(actual).toEqual(expected);
        }
      }),
      { endOnFailure: true, numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });

  it('reports one normalized cycle regardless of collection permutation', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,4}$/), { maxLength: 24, minLength: 2 }),
        fc.integer(),
        (ids, salt) => {
          const cycle = ids.map(
            (id, index): TaskRecord => ({
              id,
              kind: 'summary',
              parentId: ids[(index + 1) % ids.length]!,
              segments: [],
              title: id,
            }),
          );
          const permuted = [...cycle].sort(
            (left, right) =>
              ((left.id.charCodeAt(0) * 31 + salt) % 97) -
                ((right.id.charCodeAt(0) * 31 + salt) % 97) || left.id.localeCompare(right.id),
          );

          const result = findTaskHierarchyCycles(permuted);
          expect(result).toHaveLength(1);
          expect(new Set(result[0])).toEqual(new Set(ids));
          expect(result[0]?.[0]).toBe([...ids].sort()[0]);
        },
      ),
      { endOnFailure: true, numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });
});

import { describe, expect, it } from 'vite-plus/test';

import type { TaskRecord } from '../model/types';
import {
  buildTaskHierarchyIndexes,
  findTaskHierarchyCycles,
  getTaskAncestors,
  getTaskDescendants,
} from './task-hierarchy';

describe('task hierarchy indexes', () => {
  it('orders roots and siblings by explicit order with stable source tie-breaks', () => {
    const tasks: readonly TaskRecord[] = [
      { id: 'root-b', kind: 'summary', order: 2, segments: [], title: 'Root B' },
      {
        id: 'child-source-first',
        kind: 'task',
        order: 1,
        parentId: 'root-a',
        segments: [],
        title: 'First source tie',
      },
      { id: 'root-a', kind: 'summary', order: 1, segments: [], title: 'Root A' },
      {
        id: 'child-unordered',
        kind: 'task',
        parentId: 'root-a',
        segments: [],
        title: 'Unordered',
      },
      {
        id: 'child-source-second',
        kind: 'summary',
        order: 1,
        parentId: 'root-a',
        segments: [],
        title: 'Second source tie',
      },
      {
        id: 'grandchild',
        kind: 'task',
        parentId: 'child-source-second',
        segments: [],
        title: 'Grandchild',
      },
    ];

    const indexes = buildTaskHierarchyIndexes(tasks);

    expect(indexes.roots.map((task) => task.id)).toEqual(['root-a', 'root-b']);
    expect(indexes.childrenByParentId.get('root-a')?.map((task) => task.id)).toEqual([
      'child-source-first',
      'child-source-second',
      'child-unordered',
    ]);
    expect(indexes.orderedTasks.map((task) => task.id)).toEqual([
      'root-a',
      'child-source-first',
      'child-source-second',
      'grandchild',
      'child-unordered',
      'root-b',
    ]);
    expect(indexes.depthByTaskId.get('grandchild')).toBe(2);
    expect(getTaskAncestors(indexes, 'grandchild').map((task) => task.id)).toEqual([
      'child-source-second',
      'root-a',
    ]);
    expect(getTaskDescendants(indexes, 'root-a').map((task) => task.id)).toEqual([
      'child-source-first',
      'child-source-second',
      'grandchild',
      'child-unordered',
    ]);
  });

  it('indexes a deep tree without recursive traversal', () => {
    const count = 5_000;
    const tasks: TaskRecord[] = Array.from({ length: count }, (_, index) => ({
      id: `task-${index}`,
      kind: index === count - 1 ? ('task' as const) : ('summary' as const),
      ...(index === 0 ? {} : { parentId: `task-${index - 1}` }),
      segments: [],
      title: `Task ${index}`,
    }));

    const indexes = buildTaskHierarchyIndexes(tasks);

    expect(indexes.orderedTasks).toHaveLength(count);
    expect(indexes.depthByTaskId.get(`task-${count - 1}`)).toBe(count - 1);
    expect(indexes.subtreeRangeByTaskId.get('task-0')).toEqual({ end: count, start: 0 });
  });

  it('normalizes cycle paths independently of task array order', () => {
    const tasks: readonly TaskRecord[] = [
      { id: 'c', kind: 'summary', parentId: 'a', segments: [], title: 'C' },
      { id: 'a', kind: 'summary', parentId: 'b', segments: [], title: 'A' },
      { id: 'b', kind: 'summary', parentId: 'c', segments: [], title: 'B' },
      { id: 'self', kind: 'summary', parentId: 'self', segments: [], title: 'Self' },
    ];

    expect(findTaskHierarchyCycles(tasks)).toEqual([['a', 'b', 'c'], ['self']]);
    expect(findTaskHierarchyCycles([...tasks].reverse())).toEqual([['a', 'b', 'c'], ['self']]);
  });
});

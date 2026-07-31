import type { EntityId, TaskRecord } from '../model/types';

export interface TaskHierarchySubtreeRange {
  /** Half-open indexes into `orderedTasks`; the task itself is at `start`. */
  readonly end: number;
  readonly start: number;
}

export interface TaskHierarchyIndexes {
  readonly childrenByParentId: ReadonlyMap<EntityId, readonly TaskRecord[]>;
  readonly depthByTaskId: ReadonlyMap<EntityId, number>;
  readonly orderedTasks: readonly TaskRecord[];
  readonly roots: readonly TaskRecord[];
  readonly sourceIndexByTaskId: ReadonlyMap<EntityId, number>;
  readonly subtreeRangeByTaskId: ReadonlyMap<EntityId, TaskHierarchySubtreeRange>;
  readonly tasksById: ReadonlyMap<EntityId, TaskRecord>;
}

function compareIds(left: EntityId, right: EntityId): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rotateCycleToSmallestId(cycle: readonly EntityId[]): readonly EntityId[] {
  let smallestIndex = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if (compareIds(cycle[index]!, cycle[smallestIndex]!) < 0) {
      smallestIndex = index;
    }
  }
  return Object.freeze([...cycle.slice(smallestIndex), ...cycle.slice(0, smallestIndex)]);
}

/**
 * Task ancestry is a functional graph (each task has at most one parent), so an
 * iterative color walk finds every disjoint cycle without recursion depth limits.
 */
export function findTaskHierarchyCycles(
  tasks: readonly TaskRecord[],
): readonly (readonly EntityId[])[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const state = new Map<EntityId, 'done' | 'visiting'>();
  const cycles: (readonly EntityId[])[] = [];

  for (const startId of [...tasksById.keys()].sort(compareIds)) {
    if (state.has(startId)) {
      continue;
    }
    const path: EntityId[] = [];
    const pathIndex = new Map<EntityId, number>();
    let currentId: EntityId | undefined = startId;

    while (currentId !== undefined && tasksById.has(currentId) && !state.has(currentId)) {
      state.set(currentId, 'visiting');
      pathIndex.set(currentId, path.length);
      path.push(currentId);
      currentId = tasksById.get(currentId)?.parentId;
    }

    if (currentId !== undefined && state.get(currentId) === 'visiting') {
      const cycleStart = pathIndex.get(currentId);
      // A visiting node from another completed walk cannot occur in a functional
      // graph because that walk is marked done before the next root begins.
      if (cycleStart !== undefined) {
        cycles.push(rotateCycleToSmallestId(path.slice(cycleStart)));
      }
    }
    for (const id of path) {
      state.set(id, 'done');
    }
  }

  cycles.sort((left, right) => compareIds(left[0]!, right[0]!));
  return Object.freeze(cycles);
}

function siblingComparator(
  sourceIndexByTaskId: ReadonlyMap<EntityId, number>,
): (left: TaskRecord, right: TaskRecord) => number {
  return (left, right) => {
    if (left.order !== undefined || right.order !== undefined) {
      if (left.order === undefined) {
        return 1;
      }
      if (right.order === undefined) {
        return -1;
      }
      if (left.order !== right.order) {
        return left.order - right.order;
      }
    }
    const sourceDifference =
      (sourceIndexByTaskId.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (sourceIndexByTaskId.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    return sourceDifference || compareIds(left.id, right.id);
  };
}

/** Build immutable traversal indexes for a hierarchy already accepted as valid. */
export function buildTaskHierarchyIndexes(tasks: readonly TaskRecord[]): TaskHierarchyIndexes {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const sourceIndexByTaskId = new Map(tasks.map((task, index) => [task.id, index]));
  const mutableChildren = new Map<EntityId, TaskRecord[]>();
  const mutableRoots: TaskRecord[] = [];

  for (const task of tasks) {
    if (task.parentId === undefined || !tasksById.has(task.parentId)) {
      mutableRoots.push(task);
      continue;
    }
    const children = mutableChildren.get(task.parentId);
    if (children) {
      children.push(task);
    } else {
      mutableChildren.set(task.parentId, [task]);
    }
  }

  const compareSiblings = siblingComparator(sourceIndexByTaskId);
  mutableRoots.sort(compareSiblings);
  const childrenByParentId = new Map<EntityId, readonly TaskRecord[]>();
  for (const [parentId, children] of mutableChildren) {
    children.sort(compareSiblings);
    childrenByParentId.set(parentId, Object.freeze(children));
  }

  const orderedTasks: TaskRecord[] = [];
  const depthByTaskId = new Map<EntityId, number>();
  const subtreeRangeByTaskId = new Map<EntityId, TaskHierarchySubtreeRange>();
  const stack: Array<
    | { readonly depth: number; readonly phase: 'enter'; readonly task: TaskRecord }
    | { readonly phase: 'exit'; readonly start: number; readonly taskId: EntityId }
  > = [];
  for (let index = mutableRoots.length - 1; index >= 0; index -= 1) {
    stack.push({ depth: 0, phase: 'enter', task: mutableRoots[index]! });
  }

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.phase === 'exit') {
      subtreeRangeByTaskId.set(
        frame.taskId,
        Object.freeze({ end: orderedTasks.length, start: frame.start }),
      );
      continue;
    }

    const start = orderedTasks.length;
    orderedTasks.push(frame.task);
    depthByTaskId.set(frame.task.id, frame.depth);
    stack.push({ phase: 'exit', start, taskId: frame.task.id });
    const children = childrenByParentId.get(frame.task.id) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: frame.depth + 1, phase: 'enter', task: children[index]! });
    }
  }

  return Object.freeze({
    childrenByParentId,
    depthByTaskId,
    orderedTasks: Object.freeze(orderedTasks),
    roots: Object.freeze(mutableRoots),
    sourceIndexByTaskId,
    subtreeRangeByTaskId,
    tasksById,
  });
}

export function getTaskAncestors(
  indexes: TaskHierarchyIndexes,
  taskId: EntityId,
): readonly TaskRecord[] {
  const ancestors: TaskRecord[] = [];
  const visited = new Set<EntityId>([taskId]);
  let parentId = indexes.tasksById.get(taskId)?.parentId;
  while (parentId !== undefined && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = indexes.tasksById.get(parentId);
    if (!parent) {
      break;
    }
    ancestors.push(parent);
    parentId = parent.parentId;
  }
  return Object.freeze(ancestors);
}

export function getTaskDescendants(
  indexes: TaskHierarchyIndexes,
  taskId: EntityId,
): readonly TaskRecord[] {
  const range = indexes.subtreeRangeByTaskId.get(taskId);
  if (!range) {
    return Object.freeze([]);
  }
  return Object.freeze(indexes.orderedTasks.slice(range.start + 1, range.end));
}

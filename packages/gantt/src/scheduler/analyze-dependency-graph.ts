import type { Diagnostic } from '../model/diagnostics';
import type { DependencyRecord, EntityId, GanttDocument } from '../model/types';

export interface DependencyGraphAnalysis {
  readonly diagnostics: readonly Diagnostic[];
  readonly incomingByTaskId: ReadonlyMap<EntityId, readonly DependencyRecord[]>;
  readonly outgoingByTaskId: ReadonlyMap<EntityId, readonly DependencyRecord[]>;
  readonly stronglyConnectedComponents: readonly (readonly EntityId[])[];
}

function dependencyOrder(left: DependencyRecord, right: DependencyRecord): number {
  return (
    left.fromTaskId.localeCompare(right.fromTaskId) ||
    left.toTaskId.localeCompare(right.toTaskId) ||
    left.type.localeCompare(right.type) ||
    left.id.localeCompare(right.id)
  );
}

function dependencyKey(dependency: DependencyRecord): string {
  return `${dependency.fromTaskId}\u0000${dependency.toTaskId}\u0000${dependency.type}`;
}

function frozenDependencyIndex(
  taskIds: readonly EntityId[],
  dependencies: readonly DependencyRecord[],
  endpoint: 'fromTaskId' | 'toTaskId',
): ReadonlyMap<EntityId, readonly DependencyRecord[]> {
  const mutable = new Map(taskIds.map((id) => [id, [] as DependencyRecord[]]));
  for (const dependency of dependencies) {
    mutable.get(dependency[endpoint])?.push(dependency);
  }
  return Object.freeze(
    new Map(
      [...mutable].map(([id, records]) => [id, Object.freeze([...records].sort(dependencyOrder))]),
    ),
  );
}

function adjacency(
  taskIds: readonly EntityId[],
  dependencies: readonly DependencyRecord[],
  reverse = false,
): ReadonlyMap<EntityId, readonly EntityId[]> {
  const mutable = new Map(taskIds.map((id) => [id, new Set<EntityId>()]));
  for (const dependency of dependencies) {
    const from = reverse ? dependency.toTaskId : dependency.fromTaskId;
    const to = reverse ? dependency.fromTaskId : dependency.toTaskId;
    mutable.get(from)?.add(to);
  }
  return new Map([...mutable].map(([id, targets]) => [id, Object.freeze([...targets].sort())]));
}

function finishOrder(
  taskIds: readonly EntityId[],
  outgoing: ReadonlyMap<EntityId, readonly EntityId[]>,
): readonly EntityId[] {
  const visited = new Set<EntityId>();
  const finished: EntityId[] = [];
  for (const root of taskIds) {
    if (visited.has(root)) {
      continue;
    }
    visited.add(root);
    const stack: { index: number; readonly taskId: EntityId }[] = [{ index: 0, taskId: root }];
    while (stack.length > 0) {
      const current = stack.at(-1)!;
      const targets = outgoing.get(current.taskId) ?? [];
      const target = targets[current.index];
      if (target === undefined) {
        finished.push(current.taskId);
        stack.pop();
        continue;
      }
      current.index += 1;
      if (!visited.has(target)) {
        visited.add(target);
        stack.push({ index: 0, taskId: target });
      }
    }
  }
  return Object.freeze(finished);
}

function stronglyConnectedComponents(
  taskIds: readonly EntityId[],
  dependencies: readonly DependencyRecord[],
): readonly (readonly EntityId[])[] {
  const outgoing = adjacency(taskIds, dependencies);
  const incoming = adjacency(taskIds, dependencies, true);
  const order = finishOrder(taskIds, outgoing);
  const visited = new Set<EntityId>();
  const components: EntityId[][] = [];
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const root = order[index]!;
    if (visited.has(root)) {
      continue;
    }
    const component: EntityId[] = [];
    const stack = [root];
    visited.add(root);
    while (stack.length > 0) {
      const taskId = stack.pop()!;
      component.push(taskId);
      const sources = incoming.get(taskId) ?? [];
      for (let sourceIndex = sources.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
        const source = sources[sourceIndex]!;
        if (!visited.has(source)) {
          visited.add(source);
          stack.push(source);
        }
      }
    }
    components.push(component.sort());
  }
  return Object.freeze(
    components
      .filter((component) => component.length > 1)
      .sort((left, right) => left[0]!.localeCompare(right[0]!))
      .map((component) => Object.freeze(component)),
  );
}

function pathWithinComponent(
  component: readonly EntityId[],
  outgoing: ReadonlyMap<EntityId, readonly EntityId[]>,
): readonly EntityId[] {
  const allowed = new Set(component);
  const start = component[0]!;
  const candidates = (outgoing.get(start) ?? []).filter((id) => allowed.has(id));
  for (const first of candidates) {
    const queue = [first];
    const parent = new Map<EntityId, EntityId | undefined>([[first, undefined]]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!;
      if (current === start) {
        const reversed: EntityId[] = [];
        let cursor: EntityId | undefined = current;
        while (cursor !== undefined) {
          reversed.push(cursor);
          cursor = parent.get(cursor);
        }
        return Object.freeze([start, ...reversed.reverse()]);
      }
      for (const target of outgoing.get(current) ?? []) {
        if (allowed.has(target) && !parent.has(target)) {
          parent.set(target, current);
          queue.push(target);
        }
      }
    }
  }
  return Object.freeze([...component, start]);
}

function diagnostics(
  document: GanttDocument,
  components: readonly (readonly EntityId[])[],
): readonly Diagnostic[] {
  const result: Diagnostic[] = [];
  const sorted = [...document.dependencies].sort(dependencyOrder);
  const duplicateGroups = new Map<string, DependencyRecord[]>();
  for (const dependency of sorted) {
    const group = duplicateGroups.get(dependencyKey(dependency)) ?? [];
    group.push(dependency);
    duplicateGroups.set(dependencyKey(dependency), group);
    if (dependency.lag?.mode === 'working') {
      result.push(
        Object.freeze({
          code: 'dependency.working-lag',
          entityIds: Object.freeze([dependency.id]),
          message: `Dependency "${dependency.id}" uses working lag, which Community preserves without scheduling interpretation.`,
          path: '/dependencies',
          severity: 'warning',
        }),
      );
    }
  }
  for (const group of [...duplicateGroups.values()].filter((items) => items.length > 1)) {
    const first = group[0]!;
    result.push(
      Object.freeze({
        code: 'dependency.duplicate',
        details: Object.freeze({
          fromTaskId: first.fromTaskId,
          toTaskId: first.toTaskId,
          type: first.type,
        }),
        entityIds: Object.freeze(group.map((dependency) => dependency.id).sort()),
        message: `Dependencies ${group
          .map((dependency) => `"${dependency.id}"`)
          .sort()
          .join(', ')} duplicate the same semantic relationship.`,
        path: '/dependencies',
        severity: 'error',
      }),
    );
  }
  const outgoing = adjacency(document.tasks.map((task) => task.id).sort(), sorted);
  for (const component of components) {
    const completePath = pathWithinComponent(component, outgoing);
    const path = Object.freeze(completePath.slice(0, 32));
    const dependencyIds = sorted
      .filter(
        (dependency) =>
          component.includes(dependency.fromTaskId) && component.includes(dependency.toTaskId),
      )
      .map((dependency) => dependency.id);
    result.push(
      Object.freeze({
        code: 'dependency.cycle',
        details: Object.freeze({
          path,
          ...(completePath.length <= path.length ? {} : { pathTruncated: true }),
          taskCount: component.length,
          taskIds: component,
        }),
        entityIds: Object.freeze([...component, ...dependencyIds]),
        message: `Dependency cycle detected across tasks ${component.map((id) => `"${id}"`).join(', ')}.`,
        path: '/dependencies',
        severity: 'error',
      }),
    );
  }
  return Object.freeze(
    result.sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        (left.entityIds?.join('\u0000') ?? '').localeCompare(right.entityIds?.join('\u0000') ?? ''),
    ),
  );
}

export function analyzeDependencyGraph(document: GanttDocument): DependencyGraphAnalysis {
  const taskIds = document.tasks.map((task) => task.id).sort();
  const dependencies = [...document.dependencies].sort(dependencyOrder);
  const components = stronglyConnectedComponents(taskIds, dependencies);
  return Object.freeze({
    diagnostics: diagnostics(document, components),
    incomingByTaskId: frozenDependencyIndex(taskIds, dependencies, 'toTaskId'),
    outgoingByTaskId: frozenDependencyIndex(taskIds, dependencies, 'fromTaskId'),
    stronglyConnectedComponents: components,
  });
}

export function dependencyPathExists(
  document: GanttDocument,
  fromTaskId: EntityId,
  toTaskId: EntityId,
  excludedDependencyId?: EntityId,
): boolean {
  if (fromTaskId === toTaskId) {
    return true;
  }
  const outgoing = new Map<EntityId, EntityId[]>();
  for (const dependency of document.dependencies) {
    if (dependency.id === excludedDependencyId) {
      continue;
    }
    const targets = outgoing.get(dependency.fromTaskId) ?? [];
    targets.push(dependency.toTaskId);
    outgoing.set(dependency.fromTaskId, targets);
  }
  const visited = new Set<EntityId>([fromTaskId]);
  const stack = [fromTaskId];
  while (stack.length > 0) {
    const taskId = stack.pop()!;
    for (const target of outgoing.get(taskId) ?? []) {
      if (target === toTaskId) {
        return true;
      }
      if (!visited.has(target)) {
        visited.add(target);
        stack.push(target);
      }
    }
  }
  return false;
}

export function dependencySemanticKey(dependency: DependencyRecord): string {
  return dependencyKey(dependency);
}

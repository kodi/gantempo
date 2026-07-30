import type { Diagnostic } from '../model/diagnostics';
import type { EntityId, GanttDocument } from '../model/types';
import { normalizeCommandRecord, normalizeUpdatedRecord } from './normalize';
import { applyGanttPatches } from './patches';
import type {
  CommandOutcome,
  DocumentCollection,
  DomainRecordByCollection,
  EntityReference,
  GanttCommand,
  GanttPatch,
} from './types';

const EMPTY_AFFECTED = Object.freeze([]) as readonly [];
const EMPTY_PATCHES = Object.freeze([]) as readonly [];

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function diagnostic(
  code: Diagnostic['code'],
  message: string,
  path: string,
  entityIds?: readonly EntityId[],
): Diagnostic {
  return Object.freeze({
    code,
    ...(entityIds === undefined ? {} : { entityIds: Object.freeze([...entityIds]) }),
    message,
    path,
    severity: 'error',
  });
}

function rejected(document: GanttDocument, diagnostics: readonly Diagnostic[]): CommandOutcome {
  return Object.freeze({
    affected: EMPTY_AFFECTED,
    diagnostics: Object.freeze([...diagnostics]),
    document,
    inversePatches: EMPTY_PATCHES,
    patches: EMPTY_PATCHES,
    status: 'rejected',
  });
}

function committedNoOp(document: GanttDocument): CommandOutcome {
  return Object.freeze({
    affected: EMPTY_AFFECTED,
    diagnostics: Object.freeze([]),
    document,
    inversePatches: EMPTY_PATCHES,
    patches: EMPTY_PATCHES,
    status: 'committed',
  });
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(input).every((key) => allowed.includes(key));
}

function commandShape(
  document: GanttDocument,
  input: Record<string, unknown>,
  allowed: readonly string[],
): CommandOutcome | undefined {
  if (hasOnlyKeys(input, allowed)) {
    return undefined;
  }
  const key = Object.keys(input).find((candidate) => !allowed.includes(candidate));
  return rejected(document, [
    diagnostic(
      'command.invalid-payload',
      `Unknown command property "${key ?? ''}".`,
      `/command/${key ?? ''}`,
    ),
  ]);
}

function structuralEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => structuralEqual(item, right[index]))
    );
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        structuralEqual(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function findRecord<C extends DocumentCollection>(
  document: GanttDocument,
  collection: C,
  id: EntityId,
): DomainRecordByCollection[C] | undefined {
  return (document[collection] as readonly DomainRecordByCollection[C][]).find(
    (record) => record.id === id,
  );
}

function freezeAffected(affected: readonly EntityReference[]): readonly EntityReference[] {
  const seen = new Set<string>();
  const result: EntityReference[] = [];
  for (const reference of affected) {
    const key = `${reference.collection}\u0000${reference.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(Object.freeze({ ...reference }));
    }
  }
  return Object.freeze(result);
}

function commitPatches(
  document: GanttDocument,
  patches: readonly GanttPatch[],
  affected: readonly EntityReference[],
): CommandOutcome {
  const result = applyGanttPatches(document, patches);
  if (result.status === 'rejected') {
    return rejected(document, result.diagnostics);
  }
  return Object.freeze({
    affected: freezeAffected(affected),
    diagnostics: Object.freeze([]),
    document: result.document,
    inversePatches: result.inversePatches,
    patches: result.patches,
    status: 'committed',
  });
}

function commitPatch(
  document: GanttDocument,
  patch: GanttPatch,
  affected: readonly EntityReference[],
): CommandOutcome {
  return commitPatches(document, [patch], affected);
}

function addRecord<C extends DocumentCollection>(
  document: GanttDocument,
  collection: C,
  input: unknown,
  index: unknown,
): CommandOutcome {
  const normalized = normalizeCommandRecord(collection, input, '/command/value');
  if (!normalized.value) {
    return rejected(document, normalized.diagnostics);
  }
  if (findRecord(document, collection, normalized.value.id)) {
    return rejected(document, [
      diagnostic(
        'command.duplicate-target',
        `Cannot add duplicate ${collection} ID "${normalized.value.id}".`,
        '/command/value/id',
        [normalized.value.id],
      ),
    ]);
  }
  const insertionIndex = index === undefined ? document[collection].length : index;
  if (
    typeof insertionIndex !== 'number' ||
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document[collection].length
  ) {
    return rejected(document, [
      diagnostic(
        'command.invalid-payload',
        'A command insertion index must be an integer within the collection bounds.',
        '/command/index',
        [normalized.value.id],
      ),
    ]);
  }
  return commitPatch(
    document,
    {
      index: insertionIndex,
      op: 'add',
      patchVersion: 1,
      target: { collection, id: normalized.value.id },
      value: normalized.value,
    } as GanttPatch,
    [{ collection, id: normalized.value.id }],
  );
}

function updateRecord<C extends DocumentCollection>(
  document: GanttDocument,
  collection: C,
  id: unknown,
  changes: unknown,
  allowedKeys: ReadonlySet<string>,
  clearableKeys: ReadonlySet<string>,
): CommandOutcome {
  if (typeof id !== 'string' || id.length === 0) {
    return rejected(document, [
      diagnostic(
        'command.invalid-payload',
        'An update target must be a canonical string ID.',
        '/command/id',
      ),
    ]);
  }
  const current = findRecord(document, collection, id);
  if (!current) {
    return rejected(document, [
      diagnostic(
        'command.missing-target',
        `Cannot update missing ${collection} ID "${id}".`,
        '/command/id',
        [id],
      ),
    ]);
  }
  const normalized = normalizeUpdatedRecord(
    collection,
    current,
    changes,
    allowedKeys,
    clearableKeys,
    '/command/changes',
  );
  if (!normalized.value) {
    return rejected(document, normalized.diagnostics);
  }
  if (structuralEqual(current, normalized.value)) {
    return committedNoOp(document);
  }
  return commitPatch(
    document,
    {
      op: 'replace',
      patchVersion: 1,
      target: { collection, id },
      value: normalized.value,
    } as GanttPatch,
    [{ collection, id }],
  );
}

function requireDeleteTarget<C extends DocumentCollection>(
  document: GanttDocument,
  collection: C,
  id: unknown,
): DomainRecordByCollection[C] | CommandOutcome {
  if (typeof id !== 'string' || id.length === 0) {
    return rejected(document, [
      diagnostic(
        'command.invalid-payload',
        'A delete target must be a canonical string ID.',
        '/command/id',
      ),
    ]);
  }
  const record = findRecord(document, collection, id);
  if (!record) {
    return rejected(document, [
      diagnostic(
        'command.missing-target',
        `Cannot delete missing ${collection} ID "${id}".`,
        '/command/id',
        [id],
      ),
    ]);
  }
  return record;
}

function isCommandOutcome(
  input: CommandOutcome | DomainRecordByCollection[DocumentCollection],
): input is CommandOutcome {
  return Object.hasOwn(input, 'status');
}

function removePatch<C extends DocumentCollection>(collection: C, id: EntityId): GanttPatch {
  return Object.freeze({
    op: 'remove',
    patchVersion: 1,
    target: Object.freeze({ collection, id }),
  });
}

function deleteTask(document: GanttDocument, id: unknown, cascade: unknown): CommandOutcome {
  const target = requireDeleteTarget(document, 'tasks', id);
  if (isCommandOutcome(target)) {
    return target;
  }
  if (cascade !== undefined && typeof cascade !== 'boolean') {
    return rejected(document, [
      diagnostic(
        'command.invalid-payload',
        'Task delete cascade must be a boolean when supplied.',
        '/command/cascade',
        [target.id],
      ),
    ]);
  }

  const taskIds = new Set<EntityId>([target.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of document.tasks) {
      if (task.parentId !== undefined && taskIds.has(task.parentId) && !taskIds.has(task.id)) {
        taskIds.add(task.id);
        changed = true;
      }
    }
  }
  const tasks = document.tasks.filter((task) => taskIds.has(task.id));
  const assignments = document.assignments.filter((assignment) => taskIds.has(assignment.taskId));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const placements = document.placements.filter(
    (placement) =>
      taskIds.has(placement.taskId) ||
      (placement.assignmentId !== undefined && assignmentIds.has(placement.assignmentId)),
  );
  const dependencies = document.dependencies.filter(
    (dependency) => taskIds.has(dependency.fromTaskId) || taskIds.has(dependency.toTaskId),
  );
  const dependentCount =
    tasks.length - 1 + assignments.length + placements.length + dependencies.length;
  if (cascade !== true && dependentCount > 0) {
    return rejected(document, [
      diagnostic(
        'command.strict-reference',
        `Task "${target.id}" has descendants or incident relationships; set cascade to true to delete them.`,
        '/command/cascade',
        [target.id],
      ),
    ]);
  }

  const patches: GanttPatch[] = [
    ...tasks.map((task) => removePatch('tasks', task.id)),
    ...assignments.map((assignment) => removePatch('assignments', assignment.id)),
    ...placements.map((placement) => removePatch('placements', placement.id)),
    ...dependencies.map((dependency) => removePatch('dependencies', dependency.id)),
  ];
  const affected: EntityReference[] = patches.map((patch) => patch.target);
  if (target.parentId !== undefined && !taskIds.has(target.parentId)) {
    affected.push({ collection: 'tasks', id: target.parentId });
  }
  for (const assignment of assignments) {
    affected.push(
      { collection: 'resources', id: assignment.resourceId },
      { collection: 'tasks', id: assignment.taskId },
    );
  }
  for (const placement of placements) {
    affected.push(
      { collection: 'lanes', id: placement.laneId },
      { collection: 'tasks', id: placement.taskId },
    );
  }
  return commitPatches(document, patches, affected);
}

function deleteAssignment(document: GanttDocument, id: unknown): CommandOutcome {
  const target = requireDeleteTarget(document, 'assignments', id);
  if (isCommandOutcome(target)) {
    return target;
  }
  const placements = document.placements.filter(
    (placement) => placement.assignmentId === target.id,
  );
  const patches: GanttPatch[] = [removePatch('assignments', target.id)];
  for (const placement of placements) {
    const replacement = { ...placement };
    delete replacement.assignmentId;
    patches.push({
      op: 'replace',
      patchVersion: 1,
      target: { collection: 'placements', id: placement.id },
      value: replacement,
    });
  }
  return commitPatches(document, patches, [
    ...patches.map((patch) => patch.target),
    { collection: 'tasks', id: target.taskId },
    { collection: 'resources', id: target.resourceId },
    ...placements.flatMap((placement) => [
      { collection: 'tasks' as const, id: placement.taskId },
      { collection: 'lanes' as const, id: placement.laneId },
    ]),
  ]);
}

function deleteDirect<C extends 'dependencies' | 'placements'>(
  document: GanttDocument,
  collection: C,
  id: unknown,
): CommandOutcome {
  const target = requireDeleteTarget(document, collection, id);
  if (isCommandOutcome(target)) {
    return target;
  }
  const affected: EntityReference[] = [{ collection, id: target.id }];
  if (collection === 'placements') {
    const placement = target as DomainRecordByCollection['placements'];
    affected.push(
      { collection: 'tasks', id: placement.taskId },
      { collection: 'lanes', id: placement.laneId },
    );
  } else {
    const dependency = target as DomainRecordByCollection['dependencies'];
    affected.push(
      { collection: 'tasks', id: dependency.fromTaskId },
      { collection: 'tasks', id: dependency.toTaskId },
    );
  }
  return commitPatches(document, [removePatch(collection, target.id)], affected);
}

function prefixTransactionDiagnostics(
  diagnostics: readonly Diagnostic[],
  childPath: string,
): readonly Diagnostic[] {
  return Object.freeze(
    diagnostics.map((item) =>
      Object.freeze({
        ...item,
        ...(item.path === undefined
          ? { path: childPath }
          : {
              path: item.path.startsWith('/command')
                ? `${childPath}${item.path.slice('/command'.length)}`
                : `${childPath}${item.path}`,
            }),
      }),
    ),
  );
}

function applyTransaction(document: GanttDocument, commands: unknown): CommandOutcome {
  if (!Array.isArray(commands)) {
    return rejected(document, [
      diagnostic(
        'command.invalid-payload',
        'Transaction commands must be supplied as an array.',
        '/command/commands',
      ),
    ]);
  }
  if (commands.length === 0) {
    return committedNoOp(document);
  }

  let candidate = document;
  const patches: GanttPatch[] = [];
  let inversePatches: GanttPatch[] = [];
  const affected: EntityReference[] = [];
  for (const [index, child] of commands.entries()) {
    const outcome = applyGanttCommand(candidate, child as GanttCommand);
    if (outcome.status === 'rejected') {
      return rejected(
        document,
        prefixTransactionDiagnostics(outcome.diagnostics, `/command/commands/${index}`),
      );
    }
    candidate = outcome.document;
    patches.push(...outcome.patches);
    inversePatches = [...outcome.inversePatches, ...inversePatches];
    affected.push(...outcome.affected);
  }

  if (patches.length === 0 || structuralEqual(document, candidate)) {
    return committedNoOp(document);
  }
  return Object.freeze({
    affected: freezeAffected(affected),
    diagnostics: Object.freeze([]),
    document: candidate,
    inversePatches: Object.freeze(inversePatches),
    patches: Object.freeze(patches),
    status: 'committed',
  });
}

export function applyGanttCommand(document: GanttDocument, command: GanttCommand): CommandOutcome {
  if (!isPlainObject(command) || typeof command.type !== 'string') {
    return rejected(document, [
      diagnostic(
        'command.invalid-payload',
        'A command must be a plain object with a string type.',
        '/command',
      ),
    ]);
  }

  switch (command.type) {
    case 'task.add': {
      const invalid = commandShape(document, command, ['type', 'value', 'index']);
      return invalid ?? addRecord(document, 'tasks', command.value, command.index);
    }
    case 'task.update': {
      const invalid = commandShape(document, command, ['type', 'id', 'changes']);
      return (
        invalid ??
        updateRecord(
          document,
          'tasks',
          command.id,
          command.changes,
          new Set(['title', 'kind', 'parentId', 'schedule', 'progress', 'segments', 'fields']),
          new Set(['parentId', 'schedule', 'progress', 'fields']),
        )
      );
    }
    case 'task.delete': {
      const invalid = commandShape(document, command, ['type', 'id', 'cascade']);
      return invalid ?? deleteTask(document, command.id, command.cascade);
    }
    case 'resource.add': {
      const invalid = commandShape(document, command, ['type', 'value', 'index']);
      return invalid ?? addRecord(document, 'resources', command.value, command.index);
    }
    case 'resource.update': {
      const invalid = commandShape(document, command, ['type', 'id', 'changes']);
      return (
        invalid ??
        updateRecord(
          document,
          'resources',
          command.id,
          command.changes,
          new Set(['title', 'parentId', 'capacity', 'fields']),
          new Set(['parentId', 'capacity', 'fields']),
        )
      );
    }
    case 'lane.add': {
      const invalid = commandShape(document, command, ['type', 'value', 'index']);
      return invalid ?? addRecord(document, 'lanes', command.value, command.index);
    }
    case 'lane.update': {
      const invalid = commandShape(document, command, ['type', 'id', 'changes']);
      return (
        invalid ??
        updateRecord(
          document,
          'lanes',
          command.id,
          command.changes,
          new Set(['title', 'parentId', 'resourceId', 'order', 'height', 'fields']),
          new Set(['parentId', 'resourceId', 'order', 'height', 'fields']),
        )
      );
    }
    case 'assignment.set': {
      const invalid = commandShape(document, command, ['type', 'value']);
      if (invalid) {
        return invalid;
      }
      const normalized = normalizeCommandRecord('assignments', command.value, '/command/value');
      if (!normalized.value) {
        return rejected(document, normalized.diagnostics);
      }
      const existing = findRecord(document, 'assignments', normalized.value.id);
      if (!existing) {
        return addRecord(document, 'assignments', command.value, undefined);
      }
      if (structuralEqual(existing, normalized.value)) {
        return committedNoOp(document);
      }
      return commitPatch(
        document,
        {
          op: 'replace',
          patchVersion: 1,
          target: { collection: 'assignments', id: existing.id },
          value: normalized.value,
        },
        [{ collection: 'assignments', id: existing.id }],
      );
    }
    case 'assignment.delete': {
      const invalid = commandShape(document, command, ['type', 'id']);
      return invalid ?? deleteAssignment(document, command.id);
    }
    case 'placement.add': {
      const invalid = commandShape(document, command, ['type', 'value', 'index']);
      return invalid ?? addRecord(document, 'placements', command.value, command.index);
    }
    case 'placement.move': {
      const invalid = commandShape(document, command, [
        'type',
        'id',
        'laneId',
        'assignmentId',
        'segmentId',
        'order',
      ]);
      if (invalid) {
        return invalid;
      }
      const changes: Record<string, unknown> = { laneId: command.laneId };
      for (const key of ['assignmentId', 'segmentId', 'order'] as const) {
        if (Object.hasOwn(command, key)) {
          changes[key] = command[key];
        }
      }
      return updateRecord(
        document,
        'placements',
        command.id,
        changes,
        new Set(['laneId', 'assignmentId', 'segmentId', 'order']),
        new Set(['assignmentId', 'segmentId', 'order']),
      );
    }
    case 'placement.delete': {
      const invalid = commandShape(document, command, ['type', 'id']);
      return invalid ?? deleteDirect(document, 'placements', command.id);
    }
    case 'dependency.add': {
      const invalid = commandShape(document, command, ['type', 'value', 'index']);
      return invalid ?? addRecord(document, 'dependencies', command.value, command.index);
    }
    case 'dependency.delete': {
      const invalid = commandShape(document, command, ['type', 'id']);
      return invalid ?? deleteDirect(document, 'dependencies', command.id);
    }
    case 'transaction': {
      const invalid = commandShape(document, command, ['type', 'commands']);
      return invalid ?? applyTransaction(document, command.commands);
    }
    default:
      return rejected(document, [
        diagnostic(
          'command.unknown-type',
          `Unknown command type "${String((command as unknown as Record<string, unknown>).type)}".`,
          '/command/type',
        ),
      ]);
  }
}

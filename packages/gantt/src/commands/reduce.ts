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

function commitPatch(
  document: GanttDocument,
  patch: GanttPatch,
  affected: readonly EntityReference[],
): CommandOutcome {
  const result = applyGanttPatches(document, [patch]);
  if (result.status === 'rejected') {
    return rejected(document, result.diagnostics);
  }
  return Object.freeze({
    affected: Object.freeze(affected.map((reference) => Object.freeze({ ...reference }))),
    diagnostics: Object.freeze([]),
    document: result.document,
    inversePatches: result.inversePatches,
    patches: result.patches,
    status: 'committed',
  });
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
    case 'dependency.add': {
      const invalid = commandShape(document, command, ['type', 'value', 'index']);
      return invalid ?? addRecord(document, 'dependencies', command.value, command.index);
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

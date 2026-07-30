import type { Diagnostic } from './diagnostics';
import type { JsonObject, JsonValue } from './json';
import { CURRENT_SCHEMA_VERSION, migrateWireDocument } from './migrations';
import { validateDocumentReferences, type DocumentSourcePaths } from './validate';
import type {
  AssignmentRecord,
  DependencyRecord,
  DependencyType,
  DurationMode,
  DurationUnit,
  DurationValue,
  EntityId,
  GanttDocument,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskKind,
  TaskRecord,
  TaskSchedule,
  TaskSegment,
} from './types';

type WireObject = Record<string, unknown>;

export interface ParseDocumentResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly document?: GanttDocument;
  readonly sourceSchemaVersion?: number;
}

interface DecodeContext {
  readonly diagnostics: Diagnostic[];
}

interface DecodedCollection<T> {
  readonly records: readonly T[];
  readonly sourcePaths: ReadonlyMap<EntityId, string>;
}

type NormalizedRecord =
  | AssignmentRecord
  | DependencyRecord
  | LaneRecord
  | PlacementRecord
  | ResourceRecord
  | TaskRecord;

export interface NormalizeRecordInputResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly record?: NormalizedRecord;
}

const COLLECTION_NAMES = [
  'tasks',
  'resources',
  'lanes',
  'assignments',
  'placements',
  'dependencies',
] as const;

const ROOT_KEYS = new Set<string>(['schemaVersion', 'revision', ...COLLECTION_NAMES, 'metadata']);

const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isWireObject(input: unknown): input is WireObject {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function pointer(parent: string, key: number | string): string {
  const escaped = String(key).replaceAll('~', '~0').replaceAll('/', '~1');
  return `${parent}/${escaped}`;
}

function diagnose(
  context: DecodeContext,
  diagnostic: Omit<Diagnostic, 'message' | 'severity'> & {
    readonly message: string;
    readonly severity?: Diagnostic['severity'];
  },
): void {
  context.diagnostics.push({
    severity: diagnostic.severity ?? 'error',
    ...diagnostic,
  });
}

function unknownProperties(
  value: WireObject,
  knownKeys: ReadonlySet<string>,
  path: string,
  context: DecodeContext,
  entityId?: EntityId,
): void {
  for (const key of Object.keys(value)) {
    if (knownKeys.has(key)) {
      continue;
    }

    diagnose(context, {
      code: 'value.unknown-property',
      details: { property: key },
      ...(entityId === undefined ? {} : { entityIds: [entityId] }),
      message: `Unknown property "${key}" was ignored.`,
      path: pointer(path, key),
      severity: 'warning',
    });
  }
}

function decodeId(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityIds?: readonly EntityId[],
): EntityId | undefined {
  if (typeof input === 'string' && input.length > 0) {
    return input;
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return String(input);
  }

  diagnose(context, {
    code: 'value.invalid-id',
    ...(entityIds === undefined ? {} : { entityIds }),
    message: 'An ID must be a non-empty string or finite number.',
    path,
  });
  return undefined;
}

function decodeString(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityIds?: readonly EntityId[],
): string | undefined {
  if (typeof input === 'string') {
    return input;
  }

  diagnose(context, {
    code: 'value.invalid-string',
    ...(entityIds === undefined ? {} : { entityIds }),
    message: 'Expected a string.',
    path,
  });
  return undefined;
}

function decodeFiniteNumber(
  input: unknown,
  path: string,
  context: DecodeContext,
  options: {
    readonly entityIds?: readonly EntityId[];
    readonly maximum?: number;
    readonly minimum?: number;
  } = {},
): number | undefined {
  if (
    typeof input === 'number' &&
    Number.isFinite(input) &&
    (options.minimum === undefined || input >= options.minimum) &&
    (options.maximum === undefined || input <= options.maximum)
  ) {
    return input;
  }

  diagnose(context, {
    code: 'value.invalid-number',
    details: {
      ...(options.maximum === undefined ? {} : { maximum: options.maximum }),
      ...(options.minimum === undefined ? {} : { minimum: options.minimum }),
    },
    ...(options.entityIds === undefined ? {} : { entityIds: options.entityIds }),
    message: 'Expected a finite number within the supported range.',
    path,
  });
  return undefined;
}

function decodeEnum<T extends string>(
  input: unknown,
  values: readonly T[],
  path: string,
  context: DecodeContext,
  entityIds?: readonly EntityId[],
): T | undefined {
  if (typeof input === 'string' && values.includes(input as T)) {
    return input as T;
  }

  diagnose(context, {
    code: 'value.invalid-enum',
    details: { expected: values },
    ...(entityIds === undefined ? {} : { entityIds }),
    message: `Expected one of: ${values.join(', ')}.`,
    path,
  });
  return undefined;
}

function decodeOptionalId(
  value: WireObject,
  key: string,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
): EntityId | undefined | false {
  if (!Object.hasOwn(value, key)) {
    return undefined;
  }
  return decodeId(value[key], pointer(path, key), context, [entityId]) ?? false;
}

function decodeOptionalString(
  value: WireObject,
  key: string,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
): string | undefined | false {
  if (!Object.hasOwn(value, key)) {
    return undefined;
  }
  return decodeString(value[key], pointer(path, key), context, [entityId]) ?? false;
}

function cloneJsonValue(
  input: unknown,
  path: string,
  context: DecodeContext,
  ancestors: WeakSet<object>,
): JsonValue | undefined {
  if (input === null || typeof input === 'boolean' || typeof input === 'string') {
    return input;
  }
  if (typeof input === 'number') {
    if (Number.isFinite(input)) {
      return input;
    }
    diagnose(context, {
      code: 'value.invalid-json',
      message: 'JSON numbers must be finite.',
      path,
    });
    return undefined;
  }
  if (typeof input !== 'object') {
    diagnose(context, {
      code: 'value.invalid-json',
      message: 'Expected a JSON-compatible value.',
      path,
    });
    return undefined;
  }
  if (ancestors.has(input)) {
    diagnose(context, {
      code: 'value.invalid-json',
      message: 'Cyclic values are not JSON-compatible.',
      path,
    });
    return undefined;
  }

  ancestors.add(input);
  if (Array.isArray(input)) {
    const result: JsonValue[] = [];
    for (let index = 0; index < input.length; index += 1) {
      if (!Object.hasOwn(input, index)) {
        diagnose(context, {
          code: 'value.invalid-json',
          message: 'Sparse arrays are not JSON-compatible.',
          path: pointer(path, index),
        });
        ancestors.delete(input);
        return undefined;
      }
      const item = cloneJsonValue(input[index], pointer(path, index), context, ancestors);
      if (item === undefined) {
        ancestors.delete(input);
        return undefined;
      }
      result.push(item);
    }
    ancestors.delete(input);
    return Object.freeze(result);
  }

  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'value.invalid-json',
      message: 'JSON objects must be plain objects.',
      path,
    });
    ancestors.delete(input);
    return undefined;
  }

  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(input).sort()) {
    const item = cloneJsonValue(input[key], pointer(path, key), context, ancestors);
    if (item === undefined) {
      ancestors.delete(input);
      return undefined;
    }
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      value: item,
      writable: false,
    });
  }
  ancestors.delete(input);
  return Object.freeze(result);
}

function decodeJsonObject(
  input: unknown,
  path: string,
  context: DecodeContext,
): JsonObject | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'value.invalid-json',
      message: 'Expected a JSON-compatible plain object.',
      path,
    });
    return undefined;
  }
  return cloneJsonValue(input, path, context, new WeakSet()) as JsonObject | undefined;
}

function decodeInstant(input: unknown, path: string, context: DecodeContext): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string' && INSTANT_PATTERN.test(input)) {
    const epoch = Date.parse(input);
    if (Number.isFinite(epoch)) {
      return epoch;
    }
  }

  diagnose(context, {
    code: 'value.invalid-instant',
    message: 'Expected finite epoch milliseconds or an ISO datetime with an explicit offset.',
    path,
  });
  return undefined;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function decodeLocalDate(input: unknown, path: string, context: DecodeContext): string | undefined {
  if (typeof input === 'string') {
    const match = LOCAL_DATE_PATTERN.exec(input);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0)) {
        return input;
      }
    }
  }

  diagnose(context, {
    code: 'value.invalid-all-day-date',
    message: 'Expected a calendar-valid YYYY-MM-DD local date.',
    path,
  });
  return undefined;
}

function decodeSchedule(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
): TaskSchedule | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-task',
      entityIds: [entityId],
      message: 'A schedule must be a plain object.',
      path,
    });
    return undefined;
  }

  const mode = decodeEnum(
    input.mode,
    ['instant', 'all-day'] as const,
    pointer(path, 'mode'),
    context,
    [entityId],
  );
  if (mode === undefined) {
    return undefined;
  }

  if (mode === 'instant') {
    unknownProperties(input, new Set(['mode', 'start', 'end']), path, context, entityId);
    const start = decodeInstant(input.start, pointer(path, 'start'), context);
    const end = decodeInstant(input.end, pointer(path, 'end'), context);
    if (start === undefined || end === undefined) {
      return undefined;
    }
    if (end < start) {
      diagnose(context, {
        code: 'value.invalid-instant',
        entityIds: [entityId],
        message: 'An instant schedule end must not precede its start.',
        path: pointer(path, 'end'),
      });
      return undefined;
    }
    return Object.freeze({ end, mode, start });
  }

  unknownProperties(input, new Set(['mode', 'startDate', 'endDate']), path, context, entityId);
  const startDate = decodeLocalDate(input.startDate, pointer(path, 'startDate'), context);
  const endDate = decodeLocalDate(input.endDate, pointer(path, 'endDate'), context);
  if (startDate === undefined || endDate === undefined) {
    return undefined;
  }
  if (endDate < startDate) {
    diagnose(context, {
      code: 'value.invalid-all-day-date',
      entityIds: [entityId],
      message: 'An all-day schedule end must not precede its start.',
      path: pointer(path, 'endDate'),
    });
    return undefined;
  }
  return Object.freeze({ endDate, mode, startDate });
}

function decodeDuration(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
  allowNegative: boolean,
): DurationValue | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'value.invalid-number',
      entityIds: [entityId],
      message: 'A duration must be a plain object.',
      path,
    });
    return undefined;
  }

  unknownProperties(input, new Set(['value', 'unit', 'mode']), path, context, entityId);
  const value = decodeFiniteNumber(input.value, pointer(path, 'value'), context, {
    entityIds: [entityId],
    ...(allowNegative ? {} : { minimum: 0 }),
  });
  const unit = decodeEnum<DurationUnit>(
    input.unit,
    ['millisecond', 'minute', 'hour', 'day'],
    pointer(path, 'unit'),
    context,
    [entityId],
  );
  const mode = Object.hasOwn(input, 'mode')
    ? decodeEnum<DurationMode>(input.mode, ['elapsed', 'working'], pointer(path, 'mode'), context, [
        entityId,
      ])
    : undefined;
  if (value === undefined || unit === undefined || (Object.hasOwn(input, 'mode') && !mode)) {
    return undefined;
  }
  return Object.freeze({ ...(mode === undefined ? {} : { mode }), unit, value });
}

function decodeFields(
  value: WireObject,
  path: string,
  context: DecodeContext,
): JsonObject | undefined | false {
  if (!Object.hasOwn(value, 'fields')) {
    return undefined;
  }
  return decodeJsonObject(value.fields, pointer(path, 'fields'), context) ?? false;
}

function decodeSegments(
  input: unknown,
  path: string,
  context: DecodeContext,
  taskId: EntityId,
): readonly TaskSegment[] | undefined {
  if (!Array.isArray(input)) {
    diagnose(context, {
      code: 'record.invalid-task',
      entityIds: [taskId],
      message: 'Task segments must be an array.',
      path,
    });
    return undefined;
  }

  const result: TaskSegment[] = [];
  const seen = new Map<EntityId, string>();
  for (let index = 0; index < input.length; index += 1) {
    const segmentPath = pointer(path, index);
    const candidate = input[index];
    if (!isWireObject(candidate)) {
      diagnose(context, {
        code: 'record.invalid-segment',
        entityIds: [taskId],
        message: 'A task segment must be a plain object.',
        path: segmentPath,
      });
      continue;
    }

    const id = decodeId(candidate.id, pointer(segmentPath, 'id'), context, [taskId]);
    if (id === undefined) {
      continue;
    }
    unknownProperties(candidate, new Set(['id', 'schedule', 'fields']), segmentPath, context, id);
    const schedule = decodeSchedule(
      candidate.schedule,
      pointer(segmentPath, 'schedule'),
      context,
      id,
    );
    const fields = decodeFields(candidate, segmentPath, context);
    if (schedule === undefined || fields === false) {
      diagnose(context, {
        code: 'record.invalid-segment',
        entityIds: [taskId, id],
        message: `Task segment "${id}" was omitted because it is malformed.`,
        path: segmentPath,
      });
      continue;
    }
    const firstPath = seen.get(id);
    if (firstPath !== undefined) {
      diagnose(context, {
        code: 'record.duplicate-segment',
        details: { firstPath },
        entityIds: [taskId, id],
        message: `Duplicate task segment ID "${id}" was omitted.`,
        path: pointer(segmentPath, 'id'),
      });
      continue;
    }
    seen.set(id, pointer(segmentPath, 'id'));
    result.push(Object.freeze({ ...(fields === undefined ? {} : { fields }), id, schedule }));
  }
  return Object.freeze(result);
}

function decodeTask(input: unknown, path: string, context: DecodeContext): TaskRecord | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-task',
      message: 'A task must be a plain object.',
      path,
    });
    return undefined;
  }
  const id = decodeId(input.id, pointer(path, 'id'), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(
    input,
    new Set(['id', 'title', 'kind', 'parentId', 'schedule', 'progress', 'segments', 'fields']),
    path,
    context,
    id,
  );
  const title = decodeString(input.title, pointer(path, 'title'), context, [id]);
  const kind = Object.hasOwn(input, 'kind')
    ? decodeEnum<TaskKind>(
        input.kind,
        ['task', 'summary', 'milestone'],
        pointer(path, 'kind'),
        context,
        [id],
      )
    : 'task';
  const parentId = decodeOptionalId(input, 'parentId', path, context, id);
  const schedule = Object.hasOwn(input, 'schedule')
    ? decodeSchedule(input.schedule, pointer(path, 'schedule'), context, id)
    : undefined;
  const progress = Object.hasOwn(input, 'progress')
    ? decodeFiniteNumber(input.progress, pointer(path, 'progress'), context, {
        entityIds: [id],
        maximum: 1,
        minimum: 0,
      })
    : undefined;
  const segments = Object.hasOwn(input, 'segments')
    ? decodeSegments(input.segments, pointer(path, 'segments'), context, id)
    : Object.freeze([]);
  const fields = decodeFields(input, path, context);
  if (
    title === undefined ||
    kind === undefined ||
    parentId === false ||
    (Object.hasOwn(input, 'schedule') && schedule === undefined) ||
    (Object.hasOwn(input, 'progress') && progress === undefined) ||
    segments === undefined ||
    fields === false
  ) {
    diagnose(context, {
      code: 'record.invalid-task',
      entityIds: [id],
      message: `Task "${id}" was omitted because it is malformed.`,
      path,
    });
    return undefined;
  }
  return Object.freeze({
    ...(fields === undefined ? {} : { fields }),
    id,
    kind,
    ...(parentId === undefined ? {} : { parentId }),
    ...(progress === undefined ? {} : { progress }),
    ...(schedule === undefined ? {} : { schedule }),
    segments,
    title,
  });
}

function decodeResource(
  input: unknown,
  path: string,
  context: DecodeContext,
): ResourceRecord | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-resource',
      message: 'A resource must be a plain object.',
      path,
    });
    return undefined;
  }
  const id = decodeId(input.id, pointer(path, 'id'), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(
    input,
    new Set(['id', 'title', 'parentId', 'capacity', 'fields']),
    path,
    context,
    id,
  );
  const title = decodeString(input.title, pointer(path, 'title'), context, [id]);
  const parentId = decodeOptionalId(input, 'parentId', path, context, id);
  const capacity = Object.hasOwn(input, 'capacity')
    ? decodeFiniteNumber(input.capacity, pointer(path, 'capacity'), context, {
        entityIds: [id],
        minimum: 0,
      })
    : undefined;
  const fields = decodeFields(input, path, context);
  if (
    title === undefined ||
    parentId === false ||
    (Object.hasOwn(input, 'capacity') && capacity === undefined) ||
    fields === false
  ) {
    diagnose(context, {
      code: 'record.invalid-resource',
      entityIds: [id],
      message: `Resource "${id}" was omitted because it is malformed.`,
      path,
    });
    return undefined;
  }
  return Object.freeze({
    ...(capacity === undefined ? {} : { capacity }),
    ...(fields === undefined ? {} : { fields }),
    id,
    ...(parentId === undefined ? {} : { parentId }),
    title,
  });
}

function decodeLane(input: unknown, path: string, context: DecodeContext): LaneRecord | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-lane',
      message: 'A lane must be a plain object.',
      path,
    });
    return undefined;
  }
  const id = decodeId(input.id, pointer(path, 'id'), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(
    input,
    new Set(['id', 'title', 'parentId', 'resourceId', 'order', 'height', 'fields']),
    path,
    context,
    id,
  );
  const title = decodeString(input.title, pointer(path, 'title'), context, [id]);
  const parentId = decodeOptionalId(input, 'parentId', path, context, id);
  const resourceId = decodeOptionalId(input, 'resourceId', path, context, id);
  const order = Object.hasOwn(input, 'order')
    ? decodeFiniteNumber(input.order, pointer(path, 'order'), context, { entityIds: [id] })
    : undefined;
  const height = Object.hasOwn(input, 'height')
    ? decodeFiniteNumber(input.height, pointer(path, 'height'), context, {
        entityIds: [id],
        minimum: Number.MIN_VALUE,
      })
    : undefined;
  const fields = decodeFields(input, path, context);
  if (
    title === undefined ||
    parentId === false ||
    resourceId === false ||
    (Object.hasOwn(input, 'order') && order === undefined) ||
    (Object.hasOwn(input, 'height') && height === undefined) ||
    fields === false
  ) {
    diagnose(context, {
      code: 'record.invalid-lane',
      entityIds: [id],
      message: `Lane "${id}" was omitted because it is malformed.`,
      path,
    });
    return undefined;
  }
  return Object.freeze({
    ...(fields === undefined ? {} : { fields }),
    ...(height === undefined ? {} : { height }),
    id,
    ...(order === undefined ? {} : { order }),
    ...(parentId === undefined ? {} : { parentId }),
    ...(resourceId === undefined ? {} : { resourceId }),
    title,
  });
}

function decodeAssignment(
  input: unknown,
  path: string,
  context: DecodeContext,
): AssignmentRecord | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-assignment',
      message: 'An assignment must be a plain object.',
      path,
    });
    return undefined;
  }
  const id = decodeId(input.id, pointer(path, 'id'), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(
    input,
    new Set(['id', 'taskId', 'resourceId', 'allocation', 'effort', 'role', 'fields']),
    path,
    context,
    id,
  );
  const taskId = decodeId(input.taskId, pointer(path, 'taskId'), context, [id]);
  const resourceId = decodeId(input.resourceId, pointer(path, 'resourceId'), context, [id]);
  const allocation = Object.hasOwn(input, 'allocation')
    ? decodeFiniteNumber(input.allocation, pointer(path, 'allocation'), context, {
        entityIds: [id],
        minimum: 0,
      })
    : undefined;
  const effort = Object.hasOwn(input, 'effort')
    ? decodeDuration(input.effort, pointer(path, 'effort'), context, id, false)
    : undefined;
  const role = decodeOptionalString(input, 'role', path, context, id);
  const fields = decodeFields(input, path, context);
  if (
    taskId === undefined ||
    resourceId === undefined ||
    (Object.hasOwn(input, 'allocation') && allocation === undefined) ||
    (Object.hasOwn(input, 'effort') && effort === undefined) ||
    role === false ||
    fields === false
  ) {
    diagnose(context, {
      code: 'record.invalid-assignment',
      entityIds: [id],
      message: `Assignment "${id}" was omitted because it is malformed.`,
      path,
    });
    return undefined;
  }
  return Object.freeze({
    ...(allocation === undefined ? {} : { allocation }),
    ...(effort === undefined ? {} : { effort }),
    ...(fields === undefined ? {} : { fields }),
    id,
    resourceId,
    ...(role === undefined ? {} : { role }),
    taskId,
  });
}

function decodePlacement(
  input: unknown,
  path: string,
  context: DecodeContext,
): PlacementRecord | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-placement',
      message: 'A placement must be a plain object.',
      path,
    });
    return undefined;
  }
  const id = decodeId(input.id, pointer(path, 'id'), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(
    input,
    new Set(['id', 'taskId', 'laneId', 'assignmentId', 'segmentId', 'order', 'fields']),
    path,
    context,
    id,
  );
  const taskId = decodeId(input.taskId, pointer(path, 'taskId'), context, [id]);
  const laneId = decodeId(input.laneId, pointer(path, 'laneId'), context, [id]);
  const assignmentId = decodeOptionalId(input, 'assignmentId', path, context, id);
  const segmentId = decodeOptionalId(input, 'segmentId', path, context, id);
  const order = Object.hasOwn(input, 'order')
    ? decodeFiniteNumber(input.order, pointer(path, 'order'), context, { entityIds: [id] })
    : undefined;
  const fields = decodeFields(input, path, context);
  if (
    taskId === undefined ||
    laneId === undefined ||
    assignmentId === false ||
    segmentId === false ||
    (Object.hasOwn(input, 'order') && order === undefined) ||
    fields === false
  ) {
    diagnose(context, {
      code: 'record.invalid-placement',
      entityIds: [id],
      message: `Placement "${id}" was omitted because it is malformed.`,
      path,
    });
    return undefined;
  }
  return Object.freeze({
    ...(assignmentId === undefined ? {} : { assignmentId }),
    ...(fields === undefined ? {} : { fields }),
    id,
    laneId,
    ...(order === undefined ? {} : { order }),
    ...(segmentId === undefined ? {} : { segmentId }),
    taskId,
  });
}

function decodeDependency(
  input: unknown,
  path: string,
  context: DecodeContext,
): DependencyRecord | undefined {
  if (!isWireObject(input)) {
    diagnose(context, {
      code: 'record.invalid-dependency',
      message: 'A dependency must be a plain object.',
      path,
    });
    return undefined;
  }
  const id = decodeId(input.id, pointer(path, 'id'), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(
    input,
    new Set(['id', 'fromTaskId', 'toTaskId', 'type', 'lag', 'fields']),
    path,
    context,
    id,
  );
  const fromTaskId = decodeId(input.fromTaskId, pointer(path, 'fromTaskId'), context, [id]);
  const toTaskId = decodeId(input.toTaskId, pointer(path, 'toTaskId'), context, [id]);
  const type = decodeEnum<DependencyType>(
    input.type,
    ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'],
    pointer(path, 'type'),
    context,
    [id],
  );
  const lag = Object.hasOwn(input, 'lag')
    ? decodeDuration(input.lag, pointer(path, 'lag'), context, id, true)
    : undefined;
  const fields = decodeFields(input, path, context);
  if (
    fromTaskId === undefined ||
    toTaskId === undefined ||
    type === undefined ||
    (Object.hasOwn(input, 'lag') && lag === undefined) ||
    fields === false
  ) {
    diagnose(context, {
      code: 'record.invalid-dependency',
      entityIds: [id],
      message: `Dependency "${id}" was omitted because it is malformed.`,
      path,
    });
    return undefined;
  }
  return Object.freeze({
    ...(fields === undefined ? {} : { fields }),
    fromTaskId,
    id,
    ...(lag === undefined ? {} : { lag }),
    toTaskId,
    type,
  });
}

function decodeCollection<T>(
  input: readonly unknown[],
  path: string,
  context: DecodeContext,
  duplicateCode: Diagnostic['code'],
  decode: (item: unknown, itemPath: string, context: DecodeContext) => T | undefined,
): DecodedCollection<T> {
  const result: T[] = [];
  const seen = new Map<EntityId, string>();
  const sourcePaths = new Map<EntityId, string>();
  for (let index = 0; index < input.length; index += 1) {
    const itemPath = pointer(path, index);
    const record = decode(input[index], itemPath, context);
    if (record === undefined) {
      continue;
    }
    const id = (record as { readonly id: EntityId }).id;
    const firstPath = seen.get(id);
    if (firstPath !== undefined) {
      diagnose(context, {
        code: duplicateCode,
        details: { firstPath },
        entityIds: [id],
        message: `Duplicate normalized ID "${id}" was omitted.`,
        path: pointer(itemPath, 'id'),
      });
      continue;
    }
    seen.set(id, pointer(itemPath, 'id'));
    sourcePaths.set(id, itemPath);
    result.push(record);
  }
  return Object.freeze({
    records: Object.freeze(result),
    sourcePaths,
  });
}

export function normalizeGanttRecordInput(
  collection: 'assignments' | 'dependencies' | 'lanes' | 'placements' | 'resources' | 'tasks',
  input: unknown,
  path: string,
): NormalizeRecordInputResult {
  const context: DecodeContext = { diagnostics: [] };
  const decoders = {
    assignments: decodeAssignment,
    dependencies: decodeDependency,
    lanes: decodeLane,
    placements: decodePlacement,
    resources: decodeResource,
    tasks: decodeTask,
  } as const;
  const record = decoders[collection](input, path, context) as NormalizedRecord | undefined;
  return Object.freeze({
    diagnostics: Object.freeze(context.diagnostics),
    ...(record === undefined ? {} : { record }),
  });
}

export function parseGanttDocument(input: unknown): ParseDocumentResult {
  const migration = migrateWireDocument(input);
  if (migration.value === undefined) {
    return migration;
  }

  const root = migration.value;
  const context: DecodeContext = { diagnostics: [...migration.diagnostics] };
  unknownProperties(root, ROOT_KEYS, '', context);

  let fatalCollection = false;
  const collections = new Map<(typeof COLLECTION_NAMES)[number], readonly unknown[]>();
  for (const name of COLLECTION_NAMES) {
    const inputCollection = root[name];
    if (!Object.hasOwn(root, name)) {
      collections.set(name, Object.freeze([]));
      continue;
    }
    if (!Array.isArray(inputCollection)) {
      diagnose(context, {
        code: 'document.invalid-collection',
        details: { collection: name },
        message: `Document collection "${name}" must be an array.`,
        path: pointer('', name),
      });
      fatalCollection = true;
      continue;
    }
    collections.set(name, inputCollection);
  }
  if (fatalCollection) {
    return {
      diagnostics: Object.freeze(context.diagnostics),
      ...(migration.sourceSchemaVersion === undefined
        ? {}
        : { sourceSchemaVersion: migration.sourceSchemaVersion }),
    };
  }

  const revision =
    typeof root.revision === 'string' ||
    (typeof root.revision === 'number' && Number.isFinite(root.revision))
      ? root.revision
      : undefined;
  if (Object.hasOwn(root, 'revision') && revision === undefined) {
    diagnose(context, {
      code: 'value.invalid-json',
      message: 'Document revision must be a string or finite number and was omitted.',
      path: '/revision',
    });
  }

  const metadata = Object.hasOwn(root, 'metadata')
    ? decodeJsonObject(root.metadata, '/metadata', context)
    : undefined;

  const tasks = decodeCollection(
    collections.get('tasks') ?? [],
    '/tasks',
    context,
    'record.duplicate-task',
    decodeTask,
  );
  const resources = decodeCollection(
    collections.get('resources') ?? [],
    '/resources',
    context,
    'record.duplicate-resource',
    decodeResource,
  );
  const lanes = decodeCollection(
    collections.get('lanes') ?? [],
    '/lanes',
    context,
    'record.duplicate-lane',
    decodeLane,
  );
  const assignments = decodeCollection(
    collections.get('assignments') ?? [],
    '/assignments',
    context,
    'record.duplicate-assignment',
    decodeAssignment,
  );
  const placements = decodeCollection(
    collections.get('placements') ?? [],
    '/placements',
    context,
    'record.duplicate-placement',
    decodePlacement,
  );
  const dependencies = decodeCollection(
    collections.get('dependencies') ?? [],
    '/dependencies',
    context,
    'record.duplicate-dependency',
    decodeDependency,
  );

  const structurallyValidDocument: GanttDocument = Object.freeze({
    assignments: assignments.records,
    dependencies: dependencies.records,
    lanes: lanes.records,
    ...(metadata === undefined ? {} : { metadata }),
    placements: placements.records,
    resources: resources.records,
    ...(revision === undefined ? {} : { revision }),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: tasks.records,
  });
  const sourcePaths: DocumentSourcePaths = {
    assignments: assignments.sourcePaths,
    dependencies: dependencies.sourcePaths,
    lanes: lanes.sourcePaths,
    placements: placements.sourcePaths,
    resources: resources.sourcePaths,
    tasks: tasks.sourcePaths,
  };
  const validation = validateDocumentReferences(structurallyValidDocument, sourcePaths);
  context.diagnostics.push(...validation.diagnostics);

  return {
    diagnostics: Object.freeze(context.diagnostics),
    document: validation.document,
    ...(migration.sourceSchemaVersion === undefined
      ? {}
      : { sourceSchemaVersion: migration.sourceSchemaVersion }),
  };
}

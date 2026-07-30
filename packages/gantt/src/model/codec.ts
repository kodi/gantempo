import type { Diagnostic } from './diagnostics';
import type { JsonObject } from './json';
import { CURRENT_SCHEMA_VERSION, migrateWireDocument } from './migrations';
import { issuesToDiagnostics, pointer } from './schema/issues';
import { jsonObjectSchema } from './schema/json';
import {
  wireAppearanceDefinition,
  recordKnownKeys,
  wireRecordSchemas,
  wireTaskSegmentDefinition,
  wireTaskSegmentSchema,
} from './schema/records';
import { revisionSchema, wireEntityIdSchema } from './schema/scalars';
import {
  wireEffortDurationDefinition,
  wireAllDayScheduleDefinition,
  wireInstantScheduleDefinition,
} from './schema/schedules';
import type {
  AssignmentRecord,
  DependencyRecord,
  EntityId,
  GanttDocument,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
  TaskSegment,
} from './types';
import { validateDocumentReferences, type DocumentSourcePaths } from './validate';

type WireObject = Record<string, unknown>;
type CollectionName =
  | 'assignments'
  | 'dependencies'
  | 'lanes'
  | 'placements'
  | 'resources'
  | 'tasks';
type NonTaskCollection = Exclude<CollectionName, 'tasks'>;

interface RecordByCollection {
  readonly assignments: AssignmentRecord;
  readonly dependencies: DependencyRecord;
  readonly lanes: LaneRecord;
  readonly placements: PlacementRecord;
  readonly resources: ResourceRecord;
  readonly tasks: TaskRecord;
}

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

type NormalizedRecord = RecordByCollection[CollectionName];

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
const RECORD_CODES = {
  assignments: 'record.invalid-assignment',
  dependencies: 'record.invalid-dependency',
  lanes: 'record.invalid-lane',
  placements: 'record.invalid-placement',
  resources: 'record.invalid-resource',
  tasks: 'record.invalid-task',
} as const satisfies Readonly<Record<CollectionName, Diagnostic['code']>>;

function isWireObject(input: unknown): input is WireObject {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
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
      path: pointer(path, [key]),
      severity: 'warning',
    });
  }
}

function addSchemaIssues(
  context: DecodeContext,
  issues: readonly {
    readonly code: string;
    readonly keys?: readonly string[];
    readonly message: string;
    readonly path?: readonly PropertyKey[];
  }[],
  code: Diagnostic['code'],
  path: string,
  entityIds?: readonly EntityId[],
): void {
  context.diagnostics.push(
    ...issuesToDiagnostics(issues, {
      code,
      ...(entityIds === undefined ? {} : { entityIds }),
      path,
    }),
  );
}

function freezeRecord<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const item of Object.values(value)) {
    freezeRecord(item);
  }
  return Object.freeze(value);
}

function normalizedId(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityIds?: readonly EntityId[],
): EntityId | undefined {
  const result = wireEntityIdSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  addSchemaIssues(context, result.error.issues, 'value.invalid-id', path, entityIds);
  return undefined;
}

function warnScheduleProperties(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
): void {
  if (!isWireObject(input)) {
    return;
  }
  if (input.mode === 'instant') {
    unknownProperties(input, wireInstantScheduleDefinition.knownKeys, path, context, entityId);
  } else if (input.mode === 'all-day') {
    unknownProperties(input, wireAllDayScheduleDefinition.knownKeys, path, context, entityId);
  }
}

function warnDurationProperties(
  input: unknown,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
): void {
  if (isWireObject(input)) {
    unknownProperties(input, wireEffortDurationDefinition.knownKeys, path, context, entityId);
  }
}

function warnNestedRecordProperties(
  collection: CollectionName,
  input: WireObject,
  path: string,
  context: DecodeContext,
  entityId: EntityId,
): void {
  if (
    (collection === 'tasks' || collection === 'lanes') &&
    Object.hasOwn(input, 'appearance') &&
    isWireObject(input.appearance)
  ) {
    unknownProperties(
      input.appearance,
      wireAppearanceDefinition.knownKeys,
      pointer(path, ['appearance']),
      context,
      entityId,
    );
  }
  if (collection === 'tasks' && Object.hasOwn(input, 'schedule')) {
    warnScheduleProperties(input.schedule, pointer(path, ['schedule']), context, entityId);
  }
  if (collection === 'assignments' && Object.hasOwn(input, 'effort')) {
    warnDurationProperties(input.effort, pointer(path, ['effort']), context, entityId);
  }
  if (collection === 'dependencies' && Object.hasOwn(input, 'lag')) {
    warnDurationProperties(input.lag, pointer(path, ['lag']), context, entityId);
  }
}

function invalidRecord(
  collection: CollectionName,
  path: string,
  context: DecodeContext,
  entityId?: EntityId,
): void {
  diagnose(context, {
    code: RECORD_CODES[collection],
    ...(entityId === undefined ? {} : { entityIds: [entityId] }),
    message:
      entityId === undefined
        ? `A ${collection} record must be a plain object.`
        : `${collection} record "${entityId}" was omitted because it is malformed.`,
    path,
  });
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

  const segments: TaskSegment[] = [];
  const seen = new Map<EntityId, string>();
  for (let index = 0; index < input.length; index += 1) {
    const segmentPath = pointer(path, [index]);
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
    const id = normalizedId(candidate.id, pointer(segmentPath, ['id']), context, [taskId]);
    if (id === undefined) {
      continue;
    }
    unknownProperties(candidate, wireTaskSegmentDefinition.knownKeys, segmentPath, context, id);
    warnScheduleProperties(candidate.schedule, pointer(segmentPath, ['schedule']), context, id);

    const result = wireTaskSegmentSchema.safeParse(candidate);
    if (!result.success) {
      addSchemaIssues(context, result.error.issues, 'record.invalid-segment', segmentPath, [
        taskId,
        id,
      ]);
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
        path: pointer(segmentPath, ['id']),
      });
      continue;
    }
    seen.set(id, pointer(segmentPath, ['id']));
    segments.push(Object.freeze(result.data));
  }
  return Object.freeze(segments);
}

function decodeTask(input: unknown, path: string, context: DecodeContext): TaskRecord | undefined {
  if (!isWireObject(input)) {
    invalidRecord('tasks', path, context);
    return undefined;
  }
  const id = normalizedId(input.id, pointer(path, ['id']), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(input, recordKnownKeys.tasks, path, context, id);
  warnNestedRecordProperties('tasks', input, path, context, id);

  const shell = wireRecordSchemas.tasks.safeParse(input);
  if (!shell.success) {
    addSchemaIssues(context, shell.error.issues, RECORD_CODES.tasks, path, [id]);
    invalidRecord('tasks', path, context, id);
    return undefined;
  }

  const segments = Object.hasOwn(input, 'segments')
    ? decodeSegments(input.segments, pointer(path, ['segments']), context, id)
    : Object.freeze([]);
  if (segments === undefined) {
    invalidRecord('tasks', path, context, id);
    return undefined;
  }

  return freezeRecord({ ...shell.data, segments }) as TaskRecord;
}

function decodeNonTask<C extends NonTaskCollection>(
  collection: C,
  input: unknown,
  path: string,
  context: DecodeContext,
): RecordByCollection[C] | undefined {
  if (!isWireObject(input)) {
    invalidRecord(collection, path, context);
    return undefined;
  }
  const id = normalizedId(input.id, pointer(path, ['id']), context);
  if (id === undefined) {
    return undefined;
  }
  unknownProperties(input, recordKnownKeys[collection], path, context, id);
  warnNestedRecordProperties(collection, input, path, context, id);

  const wireSchema = wireRecordSchemas[collection];
  const wire = wireSchema.safeParse(input);
  if (!wire.success) {
    addSchemaIssues(context, wire.error.issues, RECORD_CODES[collection], path, [id]);
    invalidRecord(collection, path, context, id);
    return undefined;
  }

  return freezeRecord(wire.data) as RecordByCollection[C];
}

const decodeAssignment = (input: unknown, path: string, context: DecodeContext) =>
  decodeNonTask('assignments', input, path, context);
const decodeDependency = (input: unknown, path: string, context: DecodeContext) =>
  decodeNonTask('dependencies', input, path, context);
const decodeLane = (input: unknown, path: string, context: DecodeContext) =>
  decodeNonTask('lanes', input, path, context);
const decodePlacement = (input: unknown, path: string, context: DecodeContext) =>
  decodeNonTask('placements', input, path, context);
const decodeResource = (input: unknown, path: string, context: DecodeContext) =>
  decodeNonTask('resources', input, path, context);

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
    const itemPath = pointer(path, [index]);
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
        path: pointer(itemPath, ['id']),
      });
      continue;
    }
    seen.set(id, pointer(itemPath, ['id']));
    sourcePaths.set(id, itemPath);
    result.push(record);
  }
  return Object.freeze({
    records: Object.freeze(result),
    sourcePaths,
  });
}

export function normalizeGanttRecordInput(
  collection: CollectionName,
  input: unknown,
  path: string,
): NormalizeRecordInputResult {
  const context: DecodeContext = { diagnostics: [] };
  const record =
    collection === 'tasks'
      ? decodeTask(input, path, context)
      : decodeNonTask(collection, input, path, context);
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
        path: pointer('', [name]),
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

  let revision: number | string | undefined;
  if (Object.hasOwn(root, 'revision')) {
    const result = revisionSchema.safeParse(root.revision);
    if (result.success) {
      revision = result.data;
    } else {
      addSchemaIssues(context, result.error.issues, 'value.invalid-json', '/revision');
    }
  }

  let metadata: JsonObject | undefined;
  if (Object.hasOwn(root, 'metadata')) {
    const result = jsonObjectSchema.safeParse(root.metadata);
    if (result.success) {
      metadata = result.data;
    } else {
      addSchemaIssues(context, result.error.issues, 'value.invalid-json', '/metadata');
    }
  }

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

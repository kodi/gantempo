import type {
  DocumentCollection,
  GanttDocumentChange,
  GanttEntityChange,
  TaskRecord,
  TaskSchedule,
} from '@gantempo/gantt';

const ENTITY_BY_COLLECTION = {
  assignments: 'assignment',
  dependencies: 'dependency',
  lanes: 'lane',
  placements: 'placement',
  resources: 'resource',
  tasks: 'task',
} as const satisfies Record<DocumentCollection, string>;

type ExampleEntity = (typeof ENTITY_BY_COLLECTION)[DocumentCollection];
type ExampleRecord = Readonly<Record<string, unknown>>;

export const EXAMPLE_API_LOG_LIMIT = 10;

interface ExampleEntityReference {
  readonly id: string;
  readonly title?: string;
  readonly type: ExampleEntity;
}

interface ExampleTaskScheduleChange {
  readonly before: ExampleRecord;
  readonly task: {
    readonly id: string;
    readonly title: string;
  };
  readonly type: 'task.schedule.updated';
  readonly update: ExampleRecord;
}

interface ExampleEntityCreate {
  readonly entity: ExampleEntityReference;
  readonly type: `${ExampleEntity}.created`;
  readonly value: ExampleRecord;
}

interface ExampleEntityUpdate {
  readonly before: ExampleRecord;
  readonly entity: ExampleEntityReference;
  readonly type: `${ExampleEntity}.updated`;
  readonly update: ExampleRecord;
}

interface ExampleEntityDelete {
  readonly before: ExampleRecord;
  readonly entity: ExampleEntityReference;
  readonly type: `${ExampleEntity}.deleted`;
}

export type ExampleApiChange =
  | ExampleEntityCreate
  | ExampleEntityDelete
  | ExampleEntityUpdate
  | ExampleTaskScheduleChange;

export interface ExampleApiWrite {
  readonly baseRevision: number | string | null;
  readonly changes: readonly ExampleApiChange[];
  readonly operationId: string;
}

function structurallyEqual(left: unknown, right: unknown): boolean {
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
      left.every((item, index) => structurallyEqual(item, right[index]))
    );
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        structurallyEqual(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function exampleSchedule(schedule: TaskSchedule, includeMode = true): ExampleRecord {
  if (schedule.mode === 'all-day') {
    return Object.freeze({
      endDate: schedule.endDate,
      ...(includeMode ? { mode: schedule.mode } : {}),
      startDate: schedule.startDate,
    });
  }
  return Object.freeze({
    end: new Date(schedule.end).toISOString(),
    ...(includeMode ? { mode: schedule.mode } : {}),
    start: new Date(schedule.start).toISOString(),
  });
}

function exampleValue(collection: DocumentCollection, key: string, value: unknown): unknown {
  if (collection !== 'tasks') {
    return value;
  }
  if (key === 'schedule' && value !== undefined) {
    return exampleSchedule(value as TaskSchedule);
  }
  if (key === 'segments' && Array.isArray(value)) {
    return Object.freeze(
      value.map((segment) => {
        const record = segment as TaskRecord['segments'][number];
        return Object.freeze({
          ...record,
          schedule: exampleSchedule(record.schedule),
        });
      }),
    );
  }
  return value;
}

function exampleRecord(collection: DocumentCollection, value: object): ExampleRecord {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, exampleValue(collection, key, item)]),
    ),
  );
}

function exampleEntity(
  collection: DocumentCollection,
  record: Readonly<{ readonly id: string; readonly title?: string }>,
): ExampleEntityReference {
  return Object.freeze({
    id: record.id,
    ...(record.title === undefined ? {} : { title: record.title }),
    type: ENTITY_BY_COLLECTION[collection],
  });
}

function changedFields(
  collection: DocumentCollection,
  before: object,
  after: object,
): { readonly before: ExampleRecord; readonly update: ExampleRecord } {
  const beforeRecord = before as ExampleRecord;
  const afterRecord = after as ExampleRecord;
  const previous: Record<string, unknown> = {};
  const update: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  keys.delete('id');
  for (const key of keys) {
    const beforeValue = beforeRecord[key];
    const afterValue = afterRecord[key];
    if (structurallyEqual(beforeValue, afterValue)) {
      continue;
    }
    previous[key] = Object.hasOwn(beforeRecord, key)
      ? exampleValue(collection, key, beforeValue)
      : null;
    update[key] = Object.hasOwn(afterRecord, key)
      ? exampleValue(collection, key, afterValue)
      : null;
  }
  return Object.freeze({
    before: Object.freeze(previous),
    update: Object.freeze(update),
  });
}

function taskScheduleChange(
  change: Extract<GanttEntityChange, { readonly collection: 'tasks'; readonly kind: 'update' }>,
): ExampleTaskScheduleChange | undefined {
  const fields = changedFields('tasks', change.before, change.after);
  if (
    Object.keys(fields.update).length !== 1 ||
    !Object.hasOwn(fields.update, 'schedule') ||
    change.before.schedule === undefined ||
    change.after.schedule === undefined ||
    change.before.schedule.mode !== change.after.schedule.mode
  ) {
    return undefined;
  }
  return Object.freeze({
    before: exampleSchedule(change.before.schedule, false),
    task: Object.freeze({ id: change.id, title: change.after.title }),
    type: 'task.schedule.updated',
    update: exampleSchedule(change.after.schedule, false),
  });
}

function exampleChange(change: GanttEntityChange): ExampleApiChange {
  const entity = ENTITY_BY_COLLECTION[change.collection];
  if (change.kind === 'create') {
    return Object.freeze({
      entity: exampleEntity(change.collection, change.after),
      type: `${entity}.created`,
      value: exampleRecord(change.collection, change.after),
    });
  }
  if (change.kind === 'delete') {
    return Object.freeze({
      before: exampleRecord(change.collection, change.before),
      entity: exampleEntity(change.collection, change.before),
      type: `${entity}.deleted`,
    });
  }
  if (change.collection === 'tasks') {
    const schedule = taskScheduleChange(change);
    if (schedule !== undefined) {
      return schedule;
    }
  }
  const fields = changedFields(change.collection, change.before, change.after);
  return Object.freeze({
    before: fields.before,
    entity: exampleEntity(change.collection, change.after),
    type: `${entity}.updated`,
    update: fields.update,
  });
}

export function createExampleApiWrite(
  change: Pick<GanttDocumentChange, 'baseRevision' | 'entityChanges'>,
  operationId: string,
): ExampleApiWrite {
  return Object.freeze({
    baseRevision: change.baseRevision ?? null,
    changes: Object.freeze(change.entityChanges.map(exampleChange)),
    operationId,
  });
}

export function appendExampleApiWrite(
  entries: readonly ExampleApiWrite[],
  write: ExampleApiWrite,
): readonly ExampleApiWrite[] {
  return Object.freeze([...entries, write].slice(-EXAMPLE_API_LOG_LIMIT));
}

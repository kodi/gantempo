import { CURRENT_SCHEMA_VERSION } from './migrations';
import { isCanonicalAppearanceVariant } from './appearance';
import type {
  AssignmentRecord,
  DependencyRecord,
  DurationValue,
  GanttDocument,
  GanttAppearanceReference,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
  TaskSchedule,
  TaskSegment,
} from './types';

type SerializedEntry = readonly [key: string, value: string | undefined];

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(path: string, expectation: string): never {
  throw new TypeError(`Cannot serialize ${path}: ${expectation}.`);
}

function serializeObject(entries: readonly SerializedEntry[]): string {
  return `{${entries
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${JSON.stringify(key)}:${value}`)
    .join(',')}}`;
}

function serializeString(input: unknown, path: string): string {
  if (typeof input !== 'string') {
    return fail(path, 'expected a string');
  }
  return JSON.stringify(input);
}

function serializeAppearance(appearance: GanttAppearanceReference, path: string): string {
  if (!isCanonicalAppearanceVariant(appearance.variant)) {
    return fail(`${path}/variant`, 'expected a canonical semantic appearance variant');
  }
  return serializeObject([['variant', JSON.stringify(appearance.variant)]]);
}

function serializeId(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return fail(path, 'expected a non-empty canonical string ID');
  }
  return JSON.stringify(input);
}

function serializeNumber(
  input: unknown,
  path: string,
  options: { readonly maximum?: number; readonly minimum?: number } = {},
): string {
  if (
    typeof input !== 'number' ||
    !Number.isFinite(input) ||
    (options.minimum !== undefined && input < options.minimum) ||
    (options.maximum !== undefined && input > options.maximum)
  ) {
    return fail(path, 'expected a finite canonical number');
  }
  return JSON.stringify(input);
}

function serializeEnum(input: unknown, values: readonly string[], path: string): string {
  if (typeof input !== 'string' || !values.includes(input)) {
    return fail(path, `expected one of ${values.join(', ')}`);
  }
  return JSON.stringify(input);
}

function isPlainObject(input: object): input is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function serializeJsonValue(input: unknown, path: string, ancestors: WeakSet<object>): string {
  if (input === null || typeof input === 'boolean' || typeof input === 'string') {
    return JSON.stringify(input);
  }
  if (typeof input === 'number') {
    return serializeNumber(input, path);
  }
  if (typeof input !== 'object') {
    return fail(path, 'expected a JSON-compatible value');
  }
  if (ancestors.has(input)) {
    return fail(path, 'cyclic values are not JSON-compatible');
  }

  ancestors.add(input);
  if (Array.isArray(input)) {
    const values: string[] = [];
    for (let index = 0; index < input.length; index += 1) {
      if (!Object.hasOwn(input, index)) {
        ancestors.delete(input);
        return fail(`${path}/${index}`, 'sparse arrays are not JSON-compatible');
      }
      values.push(serializeJsonValue(input[index], `${path}/${index}`, ancestors));
    }
    ancestors.delete(input);
    return `[${values.join(',')}]`;
  }
  if (!isPlainObject(input)) {
    ancestors.delete(input);
    return fail(path, 'expected a plain JSON object');
  }

  const entries = Object.keys(input)
    .sort()
    .map(
      (key) =>
        [
          key,
          serializeJsonValue(
            input[key],
            `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
            ancestors,
          ),
        ] as const,
    );
  ancestors.delete(input);
  return serializeObject(entries);
}

function serializeExtensionObject(input: unknown, path: string): string {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    !isPlainObject(input)
  ) {
    return fail(path, 'expected a plain JSON object');
  }
  return serializeJsonValue(input, path, new WeakSet());
}

function serializeDuration(duration: DurationValue, path: string): string {
  return serializeObject([
    ['value', serializeNumber(duration.value, `${path}/value`)],
    [
      'unit',
      serializeEnum(duration.unit, ['millisecond', 'minute', 'hour', 'day'], `${path}/unit`),
    ],
    [
      'mode',
      duration.mode === undefined
        ? undefined
        : serializeEnum(duration.mode, ['elapsed', 'working'], `${path}/mode`),
    ],
  ]);
}

function serializeSchedule(schedule: TaskSchedule, path: string): string {
  if (schedule.mode === 'instant') {
    return serializeObject([
      ['mode', JSON.stringify('instant')],
      ['start', serializeNumber(schedule.start, `${path}/start`)],
      ['end', serializeNumber(schedule.end, `${path}/end`)],
    ]);
  }
  if (schedule.mode !== 'all-day') {
    return fail(`${path}/mode`, 'expected instant or all-day');
  }
  if (!LOCAL_DATE_PATTERN.test(schedule.startDate) || !LOCAL_DATE_PATTERN.test(schedule.endDate)) {
    return fail(path, 'expected canonical YYYY-MM-DD all-day boundaries');
  }
  return serializeObject([
    ['mode', JSON.stringify('all-day')],
    ['startDate', JSON.stringify(schedule.startDate)],
    ['endDate', JSON.stringify(schedule.endDate)],
  ]);
}

function serializeSegment(segment: TaskSegment, path: string): string {
  return serializeObject([
    ['id', serializeId(segment.id, `${path}/id`)],
    ['schedule', serializeSchedule(segment.schedule, `${path}/schedule`)],
    [
      'fields',
      segment.fields === undefined
        ? undefined
        : serializeExtensionObject(segment.fields, `${path}/fields`),
    ],
  ]);
}

function serializeArray<T>(
  input: readonly T[],
  path: string,
  serialize: (item: T, path: string) => string,
): string {
  if (!Array.isArray(input)) {
    return fail(path, 'expected an array');
  }
  return `[${input.map((item, index) => serialize(item, `${path}/${index}`)).join(',')}]`;
}

function serializeTask(task: TaskRecord, path: string): string {
  return serializeObject([
    ['id', serializeId(task.id, `${path}/id`)],
    ['title', serializeString(task.title, `${path}/title`)],
    [
      'description',
      task.description === undefined
        ? undefined
        : serializeString(task.description, `${path}/description`),
    ],
    ['kind', serializeEnum(task.kind, ['task', 'summary', 'milestone'], `${path}/kind`)],
    [
      'appearance',
      task.appearance === undefined
        ? undefined
        : serializeAppearance(task.appearance, `${path}/appearance`),
    ],
    [
      'parentId',
      task.parentId === undefined ? undefined : serializeId(task.parentId, `${path}/parentId`),
    ],
    [
      'schedule',
      task.schedule === undefined
        ? undefined
        : serializeSchedule(task.schedule, `${path}/schedule`),
    ],
    [
      'progress',
      task.progress === undefined
        ? undefined
        : serializeNumber(task.progress, `${path}/progress`, { maximum: 1, minimum: 0 }),
    ],
    ['segments', serializeArray(task.segments, `${path}/segments`, serializeSegment)],
    [
      'fields',
      task.fields === undefined
        ? undefined
        : serializeExtensionObject(task.fields, `${path}/fields`),
    ],
  ]);
}

function serializeResource(resource: ResourceRecord, path: string): string {
  return serializeObject([
    ['id', serializeId(resource.id, `${path}/id`)],
    ['title', serializeString(resource.title, `${path}/title`)],
    [
      'parentId',
      resource.parentId === undefined
        ? undefined
        : serializeId(resource.parentId, `${path}/parentId`),
    ],
    [
      'capacity',
      resource.capacity === undefined
        ? undefined
        : serializeNumber(resource.capacity, `${path}/capacity`, { minimum: 0 }),
    ],
    [
      'fields',
      resource.fields === undefined
        ? undefined
        : serializeExtensionObject(resource.fields, `${path}/fields`),
    ],
  ]);
}

function serializeLane(lane: LaneRecord, path: string): string {
  return serializeObject([
    ['id', serializeId(lane.id, `${path}/id`)],
    ['title', serializeString(lane.title, `${path}/title`)],
    [
      'appearance',
      lane.appearance === undefined
        ? undefined
        : serializeAppearance(lane.appearance, `${path}/appearance`),
    ],
    [
      'parentId',
      lane.parentId === undefined ? undefined : serializeId(lane.parentId, `${path}/parentId`),
    ],
    [
      'resourceId',
      lane.resourceId === undefined
        ? undefined
        : serializeId(lane.resourceId, `${path}/resourceId`),
    ],
    ['order', lane.order === undefined ? undefined : serializeNumber(lane.order, `${path}/order`)],
    [
      'height',
      lane.height === undefined
        ? undefined
        : serializeNumber(lane.height, `${path}/height`, { minimum: Number.MIN_VALUE }),
    ],
    [
      'fields',
      lane.fields === undefined
        ? undefined
        : serializeExtensionObject(lane.fields, `${path}/fields`),
    ],
  ]);
}

function serializeAssignment(assignment: AssignmentRecord, path: string): string {
  return serializeObject([
    ['id', serializeId(assignment.id, `${path}/id`)],
    ['taskId', serializeId(assignment.taskId, `${path}/taskId`)],
    ['resourceId', serializeId(assignment.resourceId, `${path}/resourceId`)],
    [
      'allocation',
      assignment.allocation === undefined
        ? undefined
        : serializeNumber(assignment.allocation, `${path}/allocation`, { minimum: 0 }),
    ],
    [
      'effort',
      assignment.effort === undefined
        ? undefined
        : serializeDuration(assignment.effort, `${path}/effort`),
    ],
    [
      'role',
      assignment.role === undefined ? undefined : serializeString(assignment.role, `${path}/role`),
    ],
    [
      'fields',
      assignment.fields === undefined
        ? undefined
        : serializeExtensionObject(assignment.fields, `${path}/fields`),
    ],
  ]);
}

function serializePlacement(placement: PlacementRecord, path: string): string {
  return serializeObject([
    ['id', serializeId(placement.id, `${path}/id`)],
    ['taskId', serializeId(placement.taskId, `${path}/taskId`)],
    ['laneId', serializeId(placement.laneId, `${path}/laneId`)],
    [
      'assignmentId',
      placement.assignmentId === undefined
        ? undefined
        : serializeId(placement.assignmentId, `${path}/assignmentId`),
    ],
    [
      'segmentId',
      placement.segmentId === undefined
        ? undefined
        : serializeId(placement.segmentId, `${path}/segmentId`),
    ],
    [
      'order',
      placement.order === undefined ? undefined : serializeNumber(placement.order, `${path}/order`),
    ],
    [
      'fields',
      placement.fields === undefined
        ? undefined
        : serializeExtensionObject(placement.fields, `${path}/fields`),
    ],
  ]);
}

function serializeDependency(dependency: DependencyRecord, path: string): string {
  return serializeObject([
    ['id', serializeId(dependency.id, `${path}/id`)],
    ['fromTaskId', serializeId(dependency.fromTaskId, `${path}/fromTaskId`)],
    ['toTaskId', serializeId(dependency.toTaskId, `${path}/toTaskId`)],
    [
      'type',
      serializeEnum(
        dependency.type,
        ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'],
        `${path}/type`,
      ),
    ],
    [
      'lag',
      dependency.lag === undefined ? undefined : serializeDuration(dependency.lag, `${path}/lag`),
    ],
    [
      'fields',
      dependency.fields === undefined
        ? undefined
        : serializeExtensionObject(dependency.fields, `${path}/fields`),
    ],
  ]);
}

export function serializeGanttDocument(document: GanttDocument): string {
  if (document.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return fail('/schemaVersion', 'expected current schema version 1');
  }

  return serializeObject([
    ['schemaVersion', String(CURRENT_SCHEMA_VERSION)],
    [
      'revision',
      document.revision === undefined
        ? undefined
        : typeof document.revision === 'string'
          ? JSON.stringify(document.revision)
          : serializeNumber(document.revision, '/revision'),
    ],
    ['tasks', serializeArray(document.tasks, '/tasks', serializeTask)],
    ['resources', serializeArray(document.resources, '/resources', serializeResource)],
    ['lanes', serializeArray(document.lanes, '/lanes', serializeLane)],
    ['assignments', serializeArray(document.assignments, '/assignments', serializeAssignment)],
    ['placements', serializeArray(document.placements, '/placements', serializePlacement)],
    ['dependencies', serializeArray(document.dependencies, '/dependencies', serializeDependency)],
    [
      'metadata',
      document.metadata === undefined
        ? undefined
        : serializeExtensionObject(document.metadata, '/metadata'),
    ],
  ]);
}

import type { Diagnostic } from '../model/diagnostics';
import type { JsonObject } from '../model/json';
import type {
  AssignmentRecord,
  DependencyRecord,
  DependencyType,
  DurationMode,
  DurationUnit,
  EntityId,
  EpochMilliseconds,
  GanttDocument,
  GanttAppearanceReference,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
} from '../model/types';

export const DOCUMENT_COLLECTIONS = [
  'tasks',
  'resources',
  'lanes',
  'assignments',
  'placements',
  'dependencies',
] as const;

export type DocumentCollection = (typeof DOCUMENT_COLLECTIONS)[number];

export interface DomainRecordByCollection {
  readonly assignments: AssignmentRecord;
  readonly dependencies: DependencyRecord;
  readonly lanes: LaneRecord;
  readonly placements: PlacementRecord;
  readonly resources: ResourceRecord;
  readonly tasks: TaskRecord;
}

export interface EntityReference<C extends DocumentCollection = DocumentCollection> {
  readonly collection: C;
  readonly id: EntityId;
}

export type AddEntityPatch = {
  readonly [C in DocumentCollection]: {
    readonly index: number;
    readonly op: 'add';
    readonly patchVersion: 1;
    readonly target: EntityReference<C>;
    readonly value: DomainRecordByCollection[C];
  };
}[DocumentCollection];

export type ReplaceEntityPatch = {
  readonly [C in DocumentCollection]: {
    readonly op: 'replace';
    readonly patchVersion: 1;
    readonly target: EntityReference<C>;
    readonly value: DomainRecordByCollection[C];
  };
}[DocumentCollection];

export interface RemoveEntityPatch {
  readonly op: 'remove';
  readonly patchVersion: 1;
  readonly target: EntityReference;
}

export type GanttPatch = AddEntityPatch | RemoveEntityPatch | ReplaceEntityPatch;

export type EntityIdInput = EntityId | number;

export interface InstantScheduleInput {
  readonly end: number | string;
  readonly mode: 'instant';
  readonly start: number | string;
}

export interface AllDayScheduleInput {
  readonly endDate: string;
  readonly mode: 'all-day';
  readonly startDate: string;
}

export type TaskScheduleInput = AllDayScheduleInput | InstantScheduleInput;

export interface DurationInput {
  readonly mode?: DurationMode;
  readonly unit: DurationUnit;
  readonly value: number;
}

export interface TaskSegmentInput {
  readonly fields?: JsonObject;
  readonly id: EntityIdInput;
  readonly schedule: TaskScheduleInput;
}

export interface TaskInput {
  readonly appearance?: GanttAppearanceReference;
  readonly description?: string;
  readonly fields?: JsonObject;
  readonly id: EntityIdInput;
  readonly kind?: TaskRecord['kind'];
  readonly parentId?: EntityIdInput;
  readonly order?: number;
  readonly progress?: number;
  readonly schedule?: TaskScheduleInput;
  readonly segments?: readonly TaskSegmentInput[];
  readonly title: string;
}

export interface ResourceInput {
  readonly capacity?: number;
  readonly fields?: JsonObject;
  readonly id: EntityIdInput;
  readonly parentId?: EntityIdInput;
  readonly title: string;
}

export interface LaneInput {
  readonly appearance?: GanttAppearanceReference;
  readonly fields?: JsonObject;
  readonly height?: number;
  readonly id: EntityIdInput;
  readonly order?: number;
  readonly parentId?: EntityIdInput;
  readonly resourceId?: EntityIdInput;
  readonly title: string;
}

export interface AssignmentInput {
  readonly allocation?: number;
  readonly effort?: DurationInput;
  readonly fields?: JsonObject;
  readonly id: EntityIdInput;
  readonly resourceId: EntityIdInput;
  readonly role?: string;
  readonly taskId: EntityIdInput;
}

export interface PlacementInput {
  readonly assignmentId?: EntityIdInput;
  readonly fields?: JsonObject;
  readonly id: EntityIdInput;
  readonly laneId: EntityIdInput;
  readonly order?: number;
  readonly segmentId?: EntityIdInput;
  readonly taskId: EntityIdInput;
}

export interface DependencyInput {
  readonly fields?: JsonObject;
  readonly fromTaskId: EntityIdInput;
  readonly id: EntityIdInput;
  readonly lag?: DurationInput;
  readonly toTaskId: EntityIdInput;
  readonly type: DependencyType;
}

export interface TaskAddCommand {
  readonly index?: number;
  readonly type: 'task.add';
  readonly value: TaskInput;
}

export interface TaskUpdateCommand {
  readonly changes: Readonly<{
    appearance?: GanttAppearanceReference | null;
    description?: string | null;
    fields?: JsonObject | null;
    kind?: TaskRecord['kind'];
    parentId?: EntityIdInput | null;
    order?: number | null;
    progress?: number | null;
    schedule?: TaskScheduleInput | null;
    segments?: readonly TaskSegmentInput[];
    title?: string;
  }>;
  readonly id: EntityId;
  readonly type: 'task.update';
}

interface TaskMoveByDeltaCommand {
  readonly delta: number;
  readonly id: EntityId;
  readonly start?: never;
  readonly type: 'task.move';
}

interface TaskMoveToStartCommand {
  readonly delta?: never;
  readonly id: EntityId;
  readonly start: EpochMilliseconds;
  readonly type: 'task.move';
}

export type TaskMoveCommand = TaskMoveByDeltaCommand | TaskMoveToStartCommand;

export interface TaskResizeCommand {
  readonly edge: 'end' | 'start';
  readonly id: EntityId;
  readonly time: EpochMilliseconds;
  readonly type: 'task.resize';
}

export interface TaskDeleteCommand {
  readonly cascade?: boolean;
  readonly id: EntityId;
  readonly type: 'task.delete';
}

export interface ResourceAddCommand {
  readonly index?: number;
  readonly type: 'resource.add';
  readonly value: ResourceInput;
}

export interface ResourceUpdateCommand {
  readonly changes: Readonly<{
    capacity?: number | null;
    fields?: JsonObject | null;
    parentId?: EntityIdInput | null;
    title?: string;
  }>;
  readonly id: EntityId;
  readonly type: 'resource.update';
}

export interface LaneAddCommand {
  readonly index?: number;
  readonly type: 'lane.add';
  readonly value: LaneInput;
}

export interface LaneUpdateCommand {
  readonly changes: Readonly<{
    appearance?: GanttAppearanceReference | null;
    fields?: JsonObject | null;
    height?: number | null;
    order?: number | null;
    parentId?: EntityIdInput | null;
    resourceId?: EntityIdInput | null;
    title?: string;
  }>;
  readonly id: EntityId;
  readonly type: 'lane.update';
}

export interface AssignmentSetCommand {
  readonly type: 'assignment.set';
  readonly value: AssignmentInput;
}

export interface AssignmentDeleteCommand {
  readonly id: EntityId;
  readonly type: 'assignment.delete';
}

export interface PlacementAddCommand {
  readonly index?: number;
  readonly type: 'placement.add';
  readonly value: PlacementInput;
}

export interface PlacementMoveCommand {
  readonly assignmentId?: EntityIdInput | null;
  readonly id: EntityId;
  readonly laneId: EntityIdInput;
  readonly order?: number | null;
  readonly segmentId?: EntityIdInput | null;
  readonly type: 'placement.move';
}

export interface PlacementDeleteCommand {
  readonly id: EntityId;
  readonly type: 'placement.delete';
}

export interface DependencyAddCommand {
  readonly index?: number;
  readonly type: 'dependency.add';
  readonly value: DependencyInput;
}

export interface DependencyDeleteCommand {
  readonly id: EntityId;
  readonly type: 'dependency.delete';
}

export interface DependencyUpdateCommand {
  readonly changes: Readonly<{
    fields?: JsonObject | null;
    fromTaskId?: EntityIdInput;
    lag?: DurationInput | null;
    toTaskId?: EntityIdInput;
    type?: DependencyType;
  }>;
  readonly id: EntityId;
  readonly type: 'dependency.update';
}

export interface TransactionCommand {
  readonly commands: readonly GanttCommand[];
  readonly type: 'transaction';
}

export type GanttCommand =
  | AssignmentDeleteCommand
  | AssignmentSetCommand
  | DependencyAddCommand
  | DependencyDeleteCommand
  | DependencyUpdateCommand
  | LaneAddCommand
  | LaneUpdateCommand
  | PlacementAddCommand
  | PlacementDeleteCommand
  | PlacementMoveCommand
  | ResourceAddCommand
  | ResourceUpdateCommand
  | TaskAddCommand
  | TaskDeleteCommand
  | TaskMoveCommand
  | TaskResizeCommand
  | TaskUpdateCommand
  | TransactionCommand;

export type CommandOutcome =
  | {
      readonly affected: readonly EntityReference[];
      readonly diagnostics: readonly Diagnostic[];
      readonly document: GanttDocument;
      readonly inversePatches: readonly GanttPatch[];
      readonly patches: readonly GanttPatch[];
      readonly status: 'committed';
    }
  | {
      readonly affected: readonly [];
      readonly diagnostics: readonly Diagnostic[];
      readonly document: GanttDocument;
      readonly inversePatches: readonly [];
      readonly patches: readonly [];
      readonly status: 'rejected';
    };

export type PatchApplicationResult =
  | {
      readonly diagnostics: readonly [];
      readonly document: GanttDocument;
      readonly inversePatches: readonly GanttPatch[];
      readonly patches: readonly GanttPatch[];
      readonly status: 'applied';
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly document: GanttDocument;
      readonly inversePatches: readonly [];
      readonly patches: readonly [];
      readonly status: 'rejected';
    };

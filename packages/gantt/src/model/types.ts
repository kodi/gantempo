export type EntityId = string;
export type EpochMilliseconds = number;
export type LocalDateString = string;
export type SchemaVersion = 1;

import type { JsonObject } from './json';

export interface TimeRange {
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
}

export interface InstantTaskSchedule {
  readonly mode: 'instant';
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
}

export interface AllDayTaskSchedule {
  readonly mode: 'all-day';
  readonly startDate: LocalDateString;
  readonly endDate: LocalDateString;
}

export type TaskSchedule = AllDayTaskSchedule | InstantTaskSchedule;
export type TaskKind = 'milestone' | 'summary' | 'task';
export type DurationMode = 'elapsed' | 'working';
export type DurationUnit = 'day' | 'hour' | 'millisecond' | 'minute';

export interface DurationValue {
  readonly value: number;
  readonly unit: DurationUnit;
  readonly mode?: DurationMode;
}

export interface TaskSegment {
  readonly id: EntityId;
  readonly schedule: TaskSchedule;
  readonly fields?: JsonObject;
}

export interface GanttAppearanceReference {
  readonly variant: string;
}

export interface TaskRecord {
  readonly appearance?: GanttAppearanceReference;
  readonly description?: string;
  readonly id: EntityId;
  readonly title: string;
  readonly kind: TaskKind;
  readonly parentId?: EntityId;
  readonly order?: number;
  readonly schedule?: TaskSchedule;
  readonly progress?: number;
  readonly segments: readonly TaskSegment[];
  readonly fields?: JsonObject;
}

export interface ResourceRecord {
  readonly id: EntityId;
  readonly title: string;
  readonly parentId?: EntityId;
  readonly capacity?: number;
  readonly fields?: JsonObject;
}

export interface LaneRecord {
  readonly appearance?: GanttAppearanceReference;
  readonly id: EntityId;
  readonly title: string;
  readonly parentId?: EntityId;
  readonly resourceId?: EntityId;
  readonly order?: number;
  readonly height?: number;
  readonly fields?: JsonObject;
}

export interface AssignmentRecord {
  readonly id: EntityId;
  readonly taskId: EntityId;
  readonly resourceId: EntityId;
  readonly allocation?: number;
  readonly effort?: DurationValue;
  readonly role?: string;
  readonly fields?: JsonObject;
}

export interface PlacementRecord {
  readonly id: EntityId;
  readonly taskId: EntityId;
  readonly laneId: EntityId;
  readonly assignmentId?: EntityId;
  readonly segmentId?: EntityId;
  readonly order?: number;
  readonly fields?: JsonObject;
}

export type DependencyType =
  | 'finish-to-finish'
  | 'finish-to-start'
  | 'start-to-finish'
  | 'start-to-start';

export interface DependencyRecord {
  readonly id: EntityId;
  readonly fromTaskId: EntityId;
  readonly toTaskId: EntityId;
  readonly type: DependencyType;
  readonly lag?: DurationValue;
  readonly fields?: JsonObject;
}

export interface GanttDocument {
  readonly schemaVersion: SchemaVersion;
  readonly revision?: number | string;
  readonly tasks: readonly TaskRecord[];
  readonly resources: readonly ResourceRecord[];
  readonly lanes: readonly LaneRecord[];
  readonly assignments: readonly AssignmentRecord[];
  readonly placements: readonly PlacementRecord[];
  readonly dependencies: readonly DependencyRecord[];
  readonly metadata?: JsonObject;
}

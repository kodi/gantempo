export type EntityId = string;
export type EpochMilliseconds = number;

export interface TimeRange {
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
}

export interface InstantTaskSchedule {
  readonly mode: 'instant';
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
}

export interface TaskRecord {
  readonly id: EntityId;
  readonly title: string;
  readonly schedule?: InstantTaskSchedule;
}

export interface LaneRecord {
  readonly id: EntityId;
  readonly title: string;
}

export interface PlacementRecord {
  readonly id: EntityId;
  readonly taskId: EntityId;
  readonly laneId: EntityId;
}

export interface GanttDocument {
  readonly schemaVersion: number;
  readonly tasks: readonly TaskRecord[];
  readonly lanes: readonly LaneRecord[];
  readonly placements: readonly PlacementRecord[];
}

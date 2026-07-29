import type { Diagnostic, DiagnosticCode } from './diagnostics';
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

interface IdentifiedRecord {
  readonly id: EntityId;
}

export interface RecordIndex<T extends IdentifiedRecord> {
  readonly byId: ReadonlyMap<EntityId, T>;
  readonly ordered: readonly T[];
  readonly diagnostics: readonly Diagnostic[];
}

function indexRecords<T extends IdentifiedRecord>(
  records: readonly T[],
  duplicateCode: DiagnosticCode,
  recordName: string,
): RecordIndex<T> {
  const byId = new Map<EntityId, T>();
  const ordered: T[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const record of records) {
    if (byId.has(record.id)) {
      diagnostics.push({
        code: duplicateCode,
        severity: 'error',
        entityIds: [record.id],
        message: `Duplicate ${recordName} ID "${record.id}" was omitted.`,
      });
      continue;
    }

    byId.set(record.id, record);
    ordered.push(record);
  }

  return { byId, ordered, diagnostics };
}

export function indexTasks(records: readonly TaskRecord[]): RecordIndex<TaskRecord> {
  return indexRecords(records, 'record.duplicate-task', 'task');
}

export function indexLanes(records: readonly LaneRecord[]): RecordIndex<LaneRecord> {
  return indexRecords(records, 'record.duplicate-lane', 'lane');
}

export function indexPlacements(records: readonly PlacementRecord[]): RecordIndex<PlacementRecord> {
  return indexRecords(records, 'record.duplicate-placement', 'placement');
}

export interface DocumentIndexes {
  readonly assignmentsById: ReadonlyMap<EntityId, AssignmentRecord>;
  readonly assignmentsByResourceId: ReadonlyMap<EntityId, readonly AssignmentRecord[]>;
  readonly assignmentsByTaskId: ReadonlyMap<EntityId, readonly AssignmentRecord[]>;
  readonly dependenciesById: ReadonlyMap<EntityId, DependencyRecord>;
  readonly dependenciesBySourceTaskId: ReadonlyMap<EntityId, readonly DependencyRecord[]>;
  readonly dependenciesByTargetTaskId: ReadonlyMap<EntityId, readonly DependencyRecord[]>;
  readonly laneChildrenByParentId: ReadonlyMap<EntityId, readonly LaneRecord[]>;
  readonly lanesById: ReadonlyMap<EntityId, LaneRecord>;
  readonly placementsByAssignmentId: ReadonlyMap<EntityId, readonly PlacementRecord[]>;
  readonly placementsById: ReadonlyMap<EntityId, PlacementRecord>;
  readonly placementsByLaneId: ReadonlyMap<EntityId, readonly PlacementRecord[]>;
  readonly placementsByTaskId: ReadonlyMap<EntityId, readonly PlacementRecord[]>;
  readonly resourceChildrenByParentId: ReadonlyMap<EntityId, readonly ResourceRecord[]>;
  readonly resourcesById: ReadonlyMap<EntityId, ResourceRecord>;
  readonly segmentsByTaskId: ReadonlyMap<EntityId, ReadonlyMap<EntityId, TaskSegment>>;
  readonly taskChildrenByParentId: ReadonlyMap<EntityId, readonly TaskRecord[]>;
  readonly tasksById: ReadonlyMap<EntityId, TaskRecord>;
}

function primaryMap<T extends IdentifiedRecord>(records: readonly T[]): ReadonlyMap<EntityId, T> {
  return new Map(records.map((record) => [record.id, record]));
}

function groupBy<T>(
  records: readonly T[],
  key: (record: T) => EntityId | undefined,
): ReadonlyMap<EntityId, readonly T[]> {
  const groups = new Map<EntityId, T[]>();
  for (const record of records) {
    const id = key(record);
    if (id === undefined) {
      continue;
    }
    const group = groups.get(id);
    if (group) {
      group.push(record);
    } else {
      groups.set(id, [record]);
    }
  }
  return new Map(
    [...groups].map(([id, group]) => [id, Object.freeze(group)] satisfies [EntityId, readonly T[]]),
  );
}

export function buildDocumentIndexes(document: GanttDocument): DocumentIndexes {
  return Object.freeze({
    assignmentsById: primaryMap(document.assignments),
    assignmentsByResourceId: groupBy(document.assignments, (assignment) => assignment.resourceId),
    assignmentsByTaskId: groupBy(document.assignments, (assignment) => assignment.taskId),
    dependenciesById: primaryMap(document.dependencies),
    dependenciesBySourceTaskId: groupBy(
      document.dependencies,
      (dependency) => dependency.fromTaskId,
    ),
    dependenciesByTargetTaskId: groupBy(document.dependencies, (dependency) => dependency.toTaskId),
    laneChildrenByParentId: groupBy(document.lanes, (lane) => lane.parentId),
    lanesById: primaryMap(document.lanes),
    placementsByAssignmentId: groupBy(document.placements, (placement) => placement.assignmentId),
    placementsById: primaryMap(document.placements),
    placementsByLaneId: groupBy(document.placements, (placement) => placement.laneId),
    placementsByTaskId: groupBy(document.placements, (placement) => placement.taskId),
    resourceChildrenByParentId: groupBy(document.resources, (resource) => resource.parentId),
    resourcesById: primaryMap(document.resources),
    segmentsByTaskId: new Map(
      document.tasks.map((task) => [
        task.id,
        new Map(task.segments.map((segment) => [segment.id, segment])),
      ]),
    ),
    taskChildrenByParentId: groupBy(document.tasks, (task) => task.parentId),
    tasksById: primaryMap(document.tasks),
  });
}

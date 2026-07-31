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
import { buildTaskHierarchyIndexes, type TaskHierarchyIndexes } from '../hierarchy/task-hierarchy';

interface IdentifiedRecord {
  readonly id: EntityId;
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
  readonly taskHierarchy: TaskHierarchyIndexes;
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
  const taskHierarchy = buildTaskHierarchyIndexes(document.tasks);
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
    taskChildrenByParentId: taskHierarchy.childrenByParentId,
    taskHierarchy,
    tasksById: primaryMap(document.tasks),
  });
}

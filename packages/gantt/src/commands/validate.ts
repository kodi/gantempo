import type { Diagnostic } from '../model/diagnostics';
import { canonicalRecordSchemas } from '../model/schema/records';
import { serializeGanttDocument } from '../model/serialize';
import type {
  AssignmentRecord,
  DependencyRecord,
  EntityId,
  GanttDocument,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
} from '../model/types';
import type { DocumentCollection, DomainRecordByCollection } from './types';

export function isCanonicalRecord<C extends DocumentCollection>(
  collection: C,
  input: unknown,
): input is DomainRecordByCollection[C] {
  return canonicalRecordSchemas[collection].safeParse(input).success;
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

function duplicateDiagnostics<T extends { readonly id: EntityId }>(
  collection: DocumentCollection,
  records: readonly T[],
  code: Diagnostic['code'],
): readonly Diagnostic[] {
  const seen = new Set<EntityId>();
  const diagnostics: Diagnostic[] = [];
  records.forEach((record, index) => {
    if (seen.has(record.id)) {
      diagnostics.push(
        diagnostic(
          code,
          `Duplicate ${collection} ID "${record.id}" is not canonical.`,
          `/${collection}/${index}/id`,
          [record.id],
        ),
      );
    }
    seen.add(record.id);
  });
  return diagnostics;
}

function validateRecordShapes(document: GanttDocument): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const collections = Object.keys(canonicalRecordSchemas) as DocumentCollection[];
  for (const collection of collections) {
    const records = document[collection] as readonly unknown[];
    records.forEach((record, index) => {
      if (!isCanonicalRecord(collection, record)) {
        diagnostics.push(
          diagnostic(
            'patch.invalid-value',
            `The ${collection} record is not a complete canonical record.`,
            `/${collection}/${index}`,
          ),
        );
      }
    });
  }
  if (diagnostics.length === 0) {
    try {
      serializeGanttDocument(document);
    } catch (error) {
      diagnostics.push(
        diagnostic(
          'patch.invalid-value',
          error instanceof Error ? error.message : 'The document contains a non-canonical value.',
          '/',
        ),
      );
    }
  }
  return diagnostics;
}

export function validateDocumentIntegrityStrict(document: GanttDocument): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [...validateRecordShapes(document)];
  if (diagnostics.length > 0) {
    return Object.freeze(diagnostics);
  }

  diagnostics.push(
    ...duplicateDiagnostics('tasks', document.tasks, 'record.duplicate-task'),
    ...duplicateDiagnostics('resources', document.resources, 'record.duplicate-resource'),
    ...duplicateDiagnostics('lanes', document.lanes, 'record.duplicate-lane'),
    ...duplicateDiagnostics('assignments', document.assignments, 'record.duplicate-assignment'),
    ...duplicateDiagnostics('placements', document.placements, 'record.duplicate-placement'),
    ...duplicateDiagnostics('dependencies', document.dependencies, 'record.duplicate-dependency'),
  );

  for (const [taskIndex, task] of document.tasks.entries()) {
    const segmentIds = new Set<EntityId>();
    for (const [segmentIndex, segment] of task.segments.entries()) {
      if (segmentIds.has(segment.id)) {
        diagnostics.push(
          diagnostic(
            'record.duplicate-segment',
            `Task "${task.id}" contains duplicate segment ID "${segment.id}".`,
            `/tasks/${taskIndex}/segments/${segmentIndex}/id`,
            [task.id, segment.id],
          ),
        );
      }
      segmentIds.add(segment.id);
    }
  }

  const taskIds = new Set(document.tasks.map((record) => record.id));
  const resourceIds = new Set(document.resources.map((record) => record.id));
  const laneIds = new Set(document.lanes.map((record) => record.id));
  const tasksById = new Map(document.tasks.map((record) => [record.id, record]));
  const assignmentsById = new Map(document.assignments.map((record) => [record.id, record]));

  document.tasks.forEach((task, index) => {
    if (task.parentId !== undefined && !taskIds.has(task.parentId)) {
      diagnostics.push(
        diagnostic(
          'reference.task-parent',
          `Task "${task.id}" references missing parent task "${task.parentId}".`,
          `/tasks/${index}/parentId`,
          [task.id, task.parentId],
        ),
      );
    }
  });
  document.resources.forEach((resource, index) => {
    if (resource.parentId !== undefined && !resourceIds.has(resource.parentId)) {
      diagnostics.push(
        diagnostic(
          'reference.resource-parent',
          `Resource "${resource.id}" references missing parent resource "${resource.parentId}".`,
          `/resources/${index}/parentId`,
          [resource.id, resource.parentId],
        ),
      );
    }
  });
  document.lanes.forEach((lane, index) => {
    if (lane.parentId !== undefined && !laneIds.has(lane.parentId)) {
      diagnostics.push(
        diagnostic(
          'reference.lane-parent',
          `Lane "${lane.id}" references missing parent lane "${lane.parentId}".`,
          `/lanes/${index}/parentId`,
          [lane.id, lane.parentId],
        ),
      );
    }
    if (lane.resourceId !== undefined && !resourceIds.has(lane.resourceId)) {
      diagnostics.push(
        diagnostic(
          'reference.lane-resource',
          `Lane "${lane.id}" references missing resource "${lane.resourceId}".`,
          `/lanes/${index}/resourceId`,
          [lane.id, lane.resourceId],
        ),
      );
    }
  });
  document.assignments.forEach((assignment, index) => {
    if (!taskIds.has(assignment.taskId)) {
      diagnostics.push(
        diagnostic(
          'reference.assignment-task',
          `Assignment "${assignment.id}" references missing task "${assignment.taskId}".`,
          `/assignments/${index}/taskId`,
          [assignment.id, assignment.taskId],
        ),
      );
    }
    if (!resourceIds.has(assignment.resourceId)) {
      diagnostics.push(
        diagnostic(
          'reference.assignment-resource',
          `Assignment "${assignment.id}" references missing resource "${assignment.resourceId}".`,
          `/assignments/${index}/resourceId`,
          [assignment.id, assignment.resourceId],
        ),
      );
    }
  });
  document.placements.forEach((placement, index) => {
    const task = tasksById.get(placement.taskId);
    if (!task) {
      diagnostics.push(
        diagnostic(
          'reference.placement-task',
          `Placement "${placement.id}" references missing task "${placement.taskId}".`,
          `/placements/${index}/taskId`,
          [placement.id, placement.taskId],
        ),
      );
    }
    if (!laneIds.has(placement.laneId)) {
      diagnostics.push(
        diagnostic(
          'reference.placement-lane',
          `Placement "${placement.id}" references missing lane "${placement.laneId}".`,
          `/placements/${index}/laneId`,
          [placement.id, placement.laneId],
        ),
      );
    }
    if (placement.assignmentId !== undefined) {
      const assignment = assignmentsById.get(placement.assignmentId);
      if (!assignment || assignment.taskId !== placement.taskId) {
        diagnostics.push(
          diagnostic(
            'reference.placement-assignment',
            `Placement "${placement.id}" references a missing or incompatible assignment "${placement.assignmentId}".`,
            `/placements/${index}/assignmentId`,
            [placement.id, placement.assignmentId],
          ),
        );
      }
    }
    if (
      placement.segmentId !== undefined &&
      (!task || !task.segments.some((segment) => segment.id === placement.segmentId))
    ) {
      diagnostics.push(
        diagnostic(
          'reference.placement-segment',
          `Placement "${placement.id}" references a segment not owned by task "${placement.taskId}".`,
          `/placements/${index}/segmentId`,
          [placement.id, placement.taskId, placement.segmentId],
        ),
      );
    }
  });
  document.dependencies.forEach((dependency, index) => {
    if (!taskIds.has(dependency.fromTaskId)) {
      diagnostics.push(
        diagnostic(
          'reference.dependency-source',
          `Dependency "${dependency.id}" references missing source task "${dependency.fromTaskId}".`,
          `/dependencies/${index}/fromTaskId`,
          [dependency.id, dependency.fromTaskId],
        ),
      );
    }
    if (!taskIds.has(dependency.toTaskId)) {
      diagnostics.push(
        diagnostic(
          'reference.dependency-target',
          `Dependency "${dependency.id}" references missing target task "${dependency.toTaskId}".`,
          `/dependencies/${index}/toTaskId`,
          [dependency.id, dependency.toTaskId],
        ),
      );
    }
    if (dependency.fromTaskId === dependency.toTaskId) {
      diagnostics.push(
        diagnostic(
          'reference.dependency-self',
          `Dependency "${dependency.id}" must connect two distinct tasks.`,
          `/dependencies/${index}/toTaskId`,
          [dependency.id, dependency.fromTaskId],
        ),
      );
    }
  });

  return Object.freeze(diagnostics);
}

export type StrictRecord =
  | AssignmentRecord
  | DependencyRecord
  | LaneRecord
  | PlacementRecord
  | ResourceRecord
  | TaskRecord;

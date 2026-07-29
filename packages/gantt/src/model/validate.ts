import type { Diagnostic } from './diagnostics';
import type {
  AssignmentRecord,
  DependencyRecord,
  EntityId,
  GanttDocument,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
} from './types';

type CollectionName =
  | 'assignments'
  | 'dependencies'
  | 'lanes'
  | 'placements'
  | 'resources'
  | 'tasks';

export type DocumentSourcePaths = Readonly<
  Partial<Record<CollectionName, ReadonlyMap<EntityId, string>>>
>;

export interface ValidateDocumentResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly document: GanttDocument;
}

function recordPath(
  sourcePaths: DocumentSourcePaths | undefined,
  collection: CollectionName,
  id: EntityId,
  fallbackIndex: number,
): string {
  return sourcePaths?.[collection]?.get(id) ?? `/${collection}/${fallbackIndex}`;
}

function omitProperty<T extends object, K extends keyof T>(record: T, key: K): T {
  const copy = { ...record } as Record<PropertyKey, unknown>;
  delete copy[key];
  return Object.freeze(copy) as T;
}

function referenceDiagnostic(
  code: Diagnostic['code'],
  message: string,
  path: string,
  entityIds: readonly EntityId[],
): Diagnostic {
  return Object.freeze({
    code,
    entityIds: Object.freeze([...entityIds]),
    message,
    path,
    severity: 'error',
  });
}

export function validateDocumentReferences(
  document: GanttDocument,
  sourcePaths?: DocumentSourcePaths,
): ValidateDocumentResult {
  const diagnostics: Diagnostic[] = [];
  const taskIds = new Set(document.tasks.map((task) => task.id));
  const resourceIds = new Set(document.resources.map((resource) => resource.id));
  const laneIds = new Set(document.lanes.map((lane) => lane.id));

  const tasks = document.tasks.map((task, index): TaskRecord => {
    if (task.parentId === undefined || taskIds.has(task.parentId)) {
      return task;
    }
    const path = `${recordPath(sourcePaths, 'tasks', task.id, index)}/parentId`;
    diagnostics.push(
      referenceDiagnostic(
        'reference.task-parent',
        `Task "${task.id}" references missing parent task "${task.parentId}"; the parent was cleared.`,
        path,
        [task.id, task.parentId],
      ),
    );
    return omitProperty(task, 'parentId');
  });

  const resources = document.resources.map((resource, index): ResourceRecord => {
    if (resource.parentId === undefined || resourceIds.has(resource.parentId)) {
      return resource;
    }
    const path = `${recordPath(sourcePaths, 'resources', resource.id, index)}/parentId`;
    diagnostics.push(
      referenceDiagnostic(
        'reference.resource-parent',
        `Resource "${resource.id}" references missing parent resource "${resource.parentId}"; the parent was cleared.`,
        path,
        [resource.id, resource.parentId],
      ),
    );
    return omitProperty(resource, 'parentId');
  });

  const lanes = document.lanes.map((lane, index): LaneRecord => {
    let validated = lane;
    const path = recordPath(sourcePaths, 'lanes', lane.id, index);
    if (validated.parentId !== undefined && !laneIds.has(validated.parentId)) {
      diagnostics.push(
        referenceDiagnostic(
          'reference.lane-parent',
          `Lane "${lane.id}" references missing parent lane "${validated.parentId}"; the parent was cleared.`,
          `${path}/parentId`,
          [lane.id, validated.parentId],
        ),
      );
      validated = omitProperty(validated, 'parentId');
    }
    if (validated.resourceId !== undefined && !resourceIds.has(validated.resourceId)) {
      diagnostics.push(
        referenceDiagnostic(
          'reference.lane-resource',
          `Lane "${lane.id}" references missing resource "${validated.resourceId}"; the resource was cleared.`,
          `${path}/resourceId`,
          [lane.id, validated.resourceId],
        ),
      );
      validated = omitProperty(validated, 'resourceId');
    }
    return validated;
  });

  const assignments = document.assignments.filter(
    (assignment, index): assignment is AssignmentRecord => {
      const path = recordPath(sourcePaths, 'assignments', assignment.id, index);
      let valid = true;
      if (!taskIds.has(assignment.taskId)) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.assignment-task',
            `Assignment "${assignment.id}" references missing task "${assignment.taskId}".`,
            `${path}/taskId`,
            [assignment.id, assignment.taskId],
          ),
        );
        valid = false;
      }
      if (!resourceIds.has(assignment.resourceId)) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.assignment-resource',
            `Assignment "${assignment.id}" references missing resource "${assignment.resourceId}".`,
            `${path}/resourceId`,
            [assignment.id, assignment.resourceId],
          ),
        );
        valid = false;
      }
      return valid;
    },
  );
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  const placements = document.placements.filter(
    (placement, index): placement is PlacementRecord => {
      const path = recordPath(sourcePaths, 'placements', placement.id, index);
      let valid = true;
      const task = tasksById.get(placement.taskId);
      if (!task) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.placement-task',
            `Placement "${placement.id}" references missing task "${placement.taskId}".`,
            `${path}/taskId`,
            [placement.id, placement.taskId],
          ),
        );
        valid = false;
      }
      if (!laneIds.has(placement.laneId)) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.placement-lane',
            `Placement "${placement.id}" references missing lane "${placement.laneId}".`,
            `${path}/laneId`,
            [placement.id, placement.laneId],
          ),
        );
        valid = false;
      }
      if (placement.assignmentId !== undefined) {
        const assignment = assignmentsById.get(placement.assignmentId);
        if (!assignment || assignment.taskId !== placement.taskId) {
          diagnostics.push(
            referenceDiagnostic(
              'reference.placement-assignment',
              `Placement "${placement.id}" references a missing or incompatible assignment "${placement.assignmentId}".`,
              `${path}/assignmentId`,
              [placement.id, placement.assignmentId],
            ),
          );
          valid = false;
        }
      }
      if (
        placement.segmentId !== undefined &&
        (!task || !task.segments.some((segment) => segment.id === placement.segmentId))
      ) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.placement-segment',
            `Placement "${placement.id}" references a segment not owned by task "${placement.taskId}".`,
            `${path}/segmentId`,
            [placement.id, placement.taskId, placement.segmentId],
          ),
        );
        valid = false;
      }
      return valid;
    },
  );

  const dependencies = document.dependencies.filter(
    (dependency, index): dependency is DependencyRecord => {
      const path = recordPath(sourcePaths, 'dependencies', dependency.id, index);
      let valid = true;
      if (!taskIds.has(dependency.fromTaskId)) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.dependency-source',
            `Dependency "${dependency.id}" references missing source task "${dependency.fromTaskId}".`,
            `${path}/fromTaskId`,
            [dependency.id, dependency.fromTaskId],
          ),
        );
        valid = false;
      }
      if (!taskIds.has(dependency.toTaskId)) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.dependency-target',
            `Dependency "${dependency.id}" references missing target task "${dependency.toTaskId}".`,
            `${path}/toTaskId`,
            [dependency.id, dependency.toTaskId],
          ),
        );
        valid = false;
      }
      if (dependency.fromTaskId === dependency.toTaskId) {
        diagnostics.push(
          referenceDiagnostic(
            'reference.dependency-self',
            `Dependency "${dependency.id}" must connect two distinct tasks.`,
            `${path}/toTaskId`,
            [dependency.id, dependency.fromTaskId],
          ),
        );
        valid = false;
      }
      return valid;
    },
  );

  const validatedDocument: GanttDocument = Object.freeze({
    assignments: Object.freeze(assignments),
    dependencies: Object.freeze(dependencies),
    lanes: Object.freeze(lanes),
    ...(document.metadata === undefined ? {} : { metadata: document.metadata }),
    placements: Object.freeze(placements),
    resources: Object.freeze(resources),
    ...(document.revision === undefined ? {} : { revision: document.revision }),
    schemaVersion: document.schemaVersion,
    tasks: Object.freeze(tasks),
  });

  return {
    diagnostics: Object.freeze(diagnostics),
    document: validatedDocument,
  };
}

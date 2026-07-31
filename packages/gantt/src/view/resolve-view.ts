import type { Diagnostic, DiagnosticCode } from '../model/diagnostics';
import { buildTaskHierarchyIndexes, getTaskAncestors } from '../hierarchy/task-hierarchy';
import { buildDocumentIndexes } from '../model/indexes';
import type { AssignmentRecord, EntityId, GanttDocument, TaskRecord } from '../model/types';
import type {
  CustomViewDefinition,
  GanttViewDefinition,
  ResolvedView,
  ResolvedViewLane,
  ResolvedViewPlacement,
  ResolveProjectViewQuery,
  ResolveViewOptions,
  ResolveViewResult,
  ViewLaneKey,
  ViewPlacementKey,
} from './types';

const DEFAULT_VIEW = Object.freeze({ kind: 'document' } as const);

function diagnostic(
  code: DiagnosticCode,
  message: string,
  path: string,
  entityIds?: readonly EntityId[],
): Diagnostic {
  return Object.freeze({
    code,
    severity: 'error',
    message,
    path,
    ...(entityIds === undefined ? {} : { entityIds: Object.freeze([...entityIds]) }),
  });
}

/**
 * JSON tuple encoding keeps arbitrary caller IDs collision-free without imposing
 * character restrictions on canonical or custom identity.
 */
function serializeViewKey(parts: readonly string[]): string {
  return `gt:v1:${JSON.stringify(parts)}`;
}

function laneKey(parts: readonly string[]): ViewLaneKey {
  return serializeViewKey(['lane', ...parts]) as ViewLaneKey;
}

function placementKey(parts: readonly string[]): ViewPlacementKey {
  return serializeViewKey(['placement', ...parts]) as ViewPlacementKey;
}

function freezeLane(lane: ResolvedViewLane): ResolvedViewLane {
  return Object.freeze({
    ...lane,
    ...(lane.project === undefined ? {} : { project: Object.freeze({ ...lane.project }) }),
    source: Object.freeze({ ...lane.source }),
  });
}

function freezePlacement(placement: ResolvedViewPlacement): ResolvedViewPlacement {
  return Object.freeze({ ...placement, source: Object.freeze({ ...placement.source }) });
}

function resolved(
  kind: GanttViewDefinition['kind'],
  lanes: readonly ResolvedViewLane[],
  placements: readonly ResolvedViewPlacement[],
  diagnostics: readonly Diagnostic[],
): ResolveViewResult {
  const view: ResolvedView = Object.freeze({
    kind,
    lanes: Object.freeze(lanes.map(freezeLane)),
    placements: Object.freeze(placements.map(freezePlacement)),
  });
  return Object.freeze({
    status: 'resolved',
    view,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function rejected(diagnostics: readonly Diagnostic[]): ResolveViewResult {
  return Object.freeze({
    status: 'rejected',
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function cloneFrozenSemanticValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneFrozenSemanticValue)) as T;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, cloneFrozenSemanticValue(item)]),
      ),
    ) as T;
  }
  return value;
}

function duplicateIds(
  records: readonly { readonly id: EntityId }[],
  path: string,
): readonly Diagnostic[] {
  const seen = new Set<EntityId>();
  const diagnostics: Diagnostic[] = [];
  records.forEach((record, index) => {
    if (seen.has(record.id)) {
      diagnostics.push(
        diagnostic(
          'view.duplicate-source-id',
          `Source ID "${record.id}" is not unique for this view.`,
          `${path}[${index}].id`,
          [record.id],
        ),
      );
    }
    seen.add(record.id);
  });
  return diagnostics;
}

function validatePlacementReference(
  task: TaskRecord | undefined,
  assignment: AssignmentRecord | undefined,
  placement: {
    readonly taskId: EntityId;
    readonly segmentId?: EntityId;
    readonly assignmentId?: EntityId;
  },
  path: string,
  expectedResourceId?: EntityId,
): readonly Diagnostic[] {
  if (!task) {
    return [
      diagnostic(
        'view.missing-task',
        `Placement references missing task "${placement.taskId}".`,
        `${path}.taskId`,
        [placement.taskId],
      ),
    ];
  }

  const diagnostics: Diagnostic[] = [];
  if (
    placement.segmentId !== undefined &&
    !task.segments.some((segment) => segment.id === placement.segmentId)
  ) {
    diagnostics.push(
      diagnostic(
        'view.missing-segment',
        `Placement references missing segment "${placement.segmentId}" on task "${task.id}".`,
        `${path}.segmentId`,
        [task.id, placement.segmentId],
      ),
    );
  }

  if (placement.assignmentId !== undefined) {
    if (!assignment) {
      diagnostics.push(
        diagnostic(
          'view.missing-assignment',
          `Placement references missing assignment "${placement.assignmentId}".`,
          `${path}.assignmentId`,
          [placement.assignmentId],
        ),
      );
    } else {
      if (assignment.taskId !== task.id) {
        diagnostics.push(
          diagnostic(
            'view.assignment-task',
            `Assignment "${assignment.id}" does not belong to task "${task.id}".`,
            `${path}.assignmentId`,
            [assignment.id, task.id],
          ),
        );
      }
      if (expectedResourceId !== undefined && assignment.resourceId !== expectedResourceId) {
        diagnostics.push(
          diagnostic(
            'view.assignment-resource',
            `Assignment "${assignment.id}" does not belong to resource "${expectedResourceId}".`,
            `${path}.assignmentId`,
            [assignment.id, expectedResourceId],
          ),
        );
      }
    }
  }

  return diagnostics;
}

function resolveDocumentView(document: GanttDocument): ResolveViewResult {
  const topologyDiagnostics = [
    ...duplicateIds(document.lanes, 'document.lanes'),
    ...duplicateIds(document.placements, 'document.placements'),
  ];
  if (topologyDiagnostics.length > 0) {
    return rejected(topologyDiagnostics);
  }

  const indexes = buildDocumentIndexes(document);
  const laneKeys = new Map(
    document.lanes.map((lane) => [lane.id, laneKey(['document', 'lane', lane.id])]),
  );
  const lanes = document.lanes.map((lane, sourceOrder) => ({
    key: laneKeys.get(lane.id)!,
    title: lane.title,
    sourceOrder,
    ...(lane.height === undefined ? {} : { minimumHeight: lane.height }),
    source: {
      kind: 'document-lane' as const,
      laneId: lane.id,
      ...(lane.resourceId === undefined ? {} : { resourceId: lane.resourceId }),
    },
  }));
  const placements: ResolvedViewPlacement[] = [];
  const diagnostics: Diagnostic[] = [];

  document.placements.forEach((placement, sourceOrder) => {
    const resolvedLaneKey = laneKeys.get(placement.laneId);
    if (!resolvedLaneKey) {
      diagnostics.push(
        diagnostic(
          'view.missing-lane',
          `Placement "${placement.id}" references missing lane "${placement.laneId}".`,
          `document.placements[${sourceOrder}].laneId`,
          [placement.id, placement.laneId],
        ),
      );
      return;
    }
    const lane = indexes.lanesById.get(placement.laneId);
    const referenceDiagnostics = validatePlacementReference(
      indexes.tasksById.get(placement.taskId),
      placement.assignmentId === undefined
        ? undefined
        : indexes.assignmentsById.get(placement.assignmentId),
      placement,
      `document.placements[${sourceOrder}]`,
      lane?.resourceId,
    );
    if (referenceDiagnostics.length > 0) {
      diagnostics.push(...referenceDiagnostics);
      return;
    }

    placements.push({
      key: placementKey(['document', 'placement', placement.id]),
      laneKey: resolvedLaneKey,
      taskId: placement.taskId,
      ...(placement.segmentId === undefined ? {} : { segmentId: placement.segmentId }),
      ...(placement.assignmentId === undefined ? {} : { assignmentId: placement.assignmentId }),
      sourceOrder,
      source: {
        kind: 'document-placement',
        placementId: placement.id,
        laneId: placement.laneId,
      },
    });
  });

  return resolved('document', lanes, placements, diagnostics);
}

function projectQueryCollapsedIds(
  document: GanttDocument,
  query: ResolveProjectViewQuery | undefined,
): readonly EntityId[] | ResolveViewResult {
  if (query === undefined) {
    return Object.freeze([]);
  }
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    return rejected([
      diagnostic('view.project-query', 'Project query must be an object.', 'view.query'),
    ]);
  }
  if (query.collapsedTaskIds === undefined) {
    return Object.freeze([]);
  }
  if (!Array.isArray(query.collapsedTaskIds)) {
    return rejected([
      diagnostic(
        'view.project-query',
        'Project collapsed task IDs must be an array.',
        'view.query.collapsedTaskIds',
      ),
    ]);
  }
  const taskIds = new Set(document.tasks.map((task) => task.id));
  const parentIds = new Set(
    document.tasks.flatMap((task) => (task.parentId === undefined ? [] : [task.parentId])),
  );
  const collapsed = new Set<EntityId>();
  for (const [index, id] of query.collapsedTaskIds.entries()) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return rejected([
        diagnostic(
          'view.project-query',
          'Project collapsed task IDs must be canonical non-empty strings.',
          `view.query.collapsedTaskIds[${index}]`,
        ),
      ]);
    }
    if (taskIds.has(id) && parentIds.has(id)) {
      collapsed.add(id);
    }
  }
  return Object.freeze([...collapsed]);
}

function resolveProjectView(
  document: GanttDocument,
  definition: Extract<GanttViewDefinition, { readonly kind: 'project' }>,
  query?: ResolveProjectViewQuery,
): ResolveViewResult {
  const topologyDiagnostics = duplicateIds(document.tasks, 'document.tasks');
  if (topologyDiagnostics.length > 0) {
    return rejected(topologyDiagnostics);
  }
  if (definition.filter !== undefined && typeof definition.filter !== 'function') {
    return rejected([
      diagnostic('view.project-filter', 'Project filter must be a function.', 'view.filter'),
    ]);
  }
  if (definition.sort !== undefined && typeof definition.sort !== 'function') {
    return rejected([
      diagnostic('view.project-sort', 'Project sort must be a function.', 'view.sort'),
    ]);
  }
  const collapsedResult = projectQueryCollapsedIds(document, query);
  if ('status' in collapsedResult) {
    return collapsedResult;
  }

  const hierarchy = buildTaskHierarchyIndexes(document.tasks);
  const hookTasksById =
    definition.filter === undefined && definition.sort === undefined
      ? undefined
      : new Map(document.tasks.map((task) => [task.id, cloneFrozenSemanticValue(task)]));
  const directMatches = new Set<EntityId>();
  const ancestorMatches = new Set<EntityId>();
  if (definition.filter !== undefined) {
    for (const task of document.tasks) {
      let matches: unknown;
      try {
        matches = definition.filter(hookTasksById!.get(task.id)!);
      } catch {
        return rejected([
          diagnostic(
            'view.project-filter',
            `Project filter threw for task "${task.id}".`,
            'view.filter',
            [task.id],
          ),
        ]);
      }
      if (typeof matches !== 'boolean') {
        return rejected([
          diagnostic(
            'view.project-filter',
            `Project filter must return a boolean for task "${task.id}".`,
            'view.filter',
            [task.id],
          ),
        ]);
      }
      if (matches) {
        directMatches.add(task.id);
        for (const ancestor of getTaskAncestors(hierarchy, task.id)) {
          ancestorMatches.add(ancestor.id);
        }
      }
    }
  }

  let sortFailure: Diagnostic | undefined;
  const sortGroup = (tasks: readonly TaskRecord[]): readonly TaskRecord[] => {
    if (definition.sort === undefined || tasks.length < 2) {
      return tasks;
    }
    const canonicalIndexById = new Map(tasks.map((task, index) => [task.id, index]));
    return [...tasks].sort((left, right) => {
      if (sortFailure !== undefined) {
        return 0;
      }
      let compared: unknown;
      try {
        compared = definition.sort!(hookTasksById!.get(left.id)!, hookTasksById!.get(right.id)!);
      } catch {
        sortFailure = diagnostic(
          'view.project-sort',
          `Project sort threw while comparing "${left.id}" and "${right.id}".`,
          'view.sort',
          [left.id, right.id],
        );
        return 0;
      }
      if (typeof compared !== 'number' || !Number.isFinite(compared)) {
        sortFailure = diagnostic(
          'view.project-sort',
          `Project sort must return a finite number for "${left.id}" and "${right.id}".`,
          'view.sort',
          [left.id, right.id],
        );
        return 0;
      }
      return compared || canonicalIndexById.get(left.id)! - canonicalIndexById.get(right.id)!;
    });
  };
  const roots = sortGroup(hierarchy.roots);
  const sortedChildren = new Map<EntityId, readonly TaskRecord[]>();
  for (const [parentId, children] of hierarchy.childrenByParentId) {
    sortedChildren.set(parentId, sortGroup(children));
  }
  if (sortFailure !== undefined) {
    return rejected([sortFailure]);
  }

  const filterActive = definition.filter !== undefined;
  const collapsed = new Set(collapsedResult);
  const visibleTasks: TaskRecord[] = [];
  const stack = [...roots].reverse();
  while (stack.length > 0) {
    const task = stack.pop()!;
    if (filterActive && !directMatches.has(task.id) && !ancestorMatches.has(task.id)) {
      continue;
    }
    visibleTasks.push(task);
    const children = sortedChildren.get(task.id) ?? [];
    const forceExpanded = ancestorMatches.has(task.id);
    if (children.length === 0 || (collapsed.has(task.id) && !forceExpanded)) {
      continue;
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]!);
    }
  }

  const laneKeys = new Map(
    visibleTasks.map((task) => [task.id, laneKey(['project', 'task', task.id])]),
  );
  const lanes = visibleTasks.map((task) => {
    const children = hierarchy.childrenByParentId.get(task.id) ?? [];
    const hasChildren = children.length > 0;
    const forceExpanded = ancestorMatches.has(task.id);
    return {
      key: laneKeys.get(task.id)!,
      project: {
        depth: hierarchy.depthByTaskId.get(task.id) ?? 0,
        ...(hasChildren ? { expanded: forceExpanded || !collapsed.has(task.id) } : {}),
        ...(directMatches.has(task.id)
          ? { filterMatch: 'direct' as const }
          : ancestorMatches.has(task.id)
            ? { filterMatch: 'ancestor' as const }
            : {}),
        hasChildren,
      },
      source: { kind: 'project-task' as const, taskId: task.id },
      sourceOrder: hierarchy.sourceIndexByTaskId.get(task.id)!,
      title: task.title,
    };
  });
  const lanesByTaskId = new Map(lanes.map((lane) => [lane.source.taskId, lane] as const));
  const placements = visibleTasks.map((task) => ({
    key: placementKey(['project', 'task', task.id]),
    laneKey: lanesByTaskId.get(task.id)!.key,
    taskId: task.id,
    sourceOrder: hierarchy.sourceIndexByTaskId.get(task.id)!,
    source: { kind: 'project-task' as const, taskId: task.id },
  }));
  return resolved('project', lanes, placements, []);
}

function resolveResourceView(document: GanttDocument): ResolveViewResult {
  const topologyDiagnostics = [
    ...duplicateIds(document.resources, 'document.resources'),
    ...duplicateIds(document.assignments, 'document.assignments'),
  ];
  if (topologyDiagnostics.length > 0) {
    return rejected(topologyDiagnostics);
  }

  const indexes = buildDocumentIndexes(document);
  const laneKeys = new Map(
    document.resources.map((resource) => [
      resource.id,
      laneKey(['resource', 'resource', resource.id]),
    ]),
  );
  const lanes = document.resources.map((resource, sourceOrder) => ({
    key: laneKeys.get(resource.id)!,
    title: resource.title,
    sourceOrder,
    source: { kind: 'resource' as const, resourceId: resource.id },
  }));
  const placements: ResolvedViewPlacement[] = [];
  const diagnostics: Diagnostic[] = [];

  document.assignments.forEach((assignment, sourceOrder) => {
    const resolvedLaneKey = laneKeys.get(assignment.resourceId);
    if (!resolvedLaneKey) {
      diagnostics.push(
        diagnostic(
          'view.missing-lane',
          `Assignment "${assignment.id}" references missing resource lane "${assignment.resourceId}".`,
          `document.assignments[${sourceOrder}].resourceId`,
          [assignment.id, assignment.resourceId],
        ),
      );
      return;
    }
    const referenceDiagnostics = validatePlacementReference(
      indexes.tasksById.get(assignment.taskId),
      assignment,
      {
        assignmentId: assignment.id,
        taskId: assignment.taskId,
      },
      `document.assignments[${sourceOrder}]`,
      assignment.resourceId,
    );
    if (referenceDiagnostics.length > 0) {
      diagnostics.push(...referenceDiagnostics);
      return;
    }

    placements.push({
      key: placementKey(['resource', 'assignment', assignment.id]),
      laneKey: resolvedLaneKey,
      taskId: assignment.taskId,
      assignmentId: assignment.id,
      sourceOrder,
      source: {
        kind: 'resource-assignment',
        assignmentId: assignment.id,
        resourceId: assignment.resourceId,
      },
    });
  });

  return resolved('resource', lanes, placements, diagnostics);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveCustomView(
  document: GanttDocument,
  definition: CustomViewDefinition,
): ResolveViewResult {
  const diagnostics: Diagnostic[] = [];
  if (!isNonEmptyString(definition.id)) {
    diagnostics.push(
      diagnostic('view.invalid-definition', 'Custom view ID must be non-empty.', 'view.id'),
    );
  }
  if (!Array.isArray(definition.lanes) || !Array.isArray(definition.placements)) {
    diagnostics.push(
      diagnostic(
        'view.invalid-definition',
        'Custom view lanes and placements must be arrays.',
        'view',
      ),
    );
    return rejected(diagnostics);
  }

  const laneKeyCounts = new Map<string, number>();
  definition.lanes.forEach((lane, index) => {
    if (!isNonEmptyString(lane?.key) || typeof lane?.title !== 'string') {
      diagnostics.push(
        diagnostic(
          'view.invalid-definition',
          'Custom lanes require a non-empty key and string title.',
          `view.lanes[${index}]`,
        ),
      );
      return;
    }
    if (
      lane.minimumHeight !== undefined &&
      (!Number.isFinite(lane.minimumHeight) || lane.minimumHeight <= 0)
    ) {
      diagnostics.push(
        diagnostic(
          'view.invalid-definition',
          'Custom lane minimum height must be a positive finite number.',
          `view.lanes[${index}].minimumHeight`,
        ),
      );
    }
    laneKeyCounts.set(lane.key, (laneKeyCounts.get(lane.key) ?? 0) + 1);
  });
  for (const [key, count] of laneKeyCounts) {
    if (count > 1) {
      diagnostics.push(
        diagnostic(
          'view.duplicate-lane-key',
          `Custom lane key "${key}" is not unique.`,
          'view.lanes',
        ),
      );
    }
  }

  const placementKeyCounts = new Map<string, number>();
  definition.placements.forEach((placement, index) => {
    if (
      !isNonEmptyString(placement?.key) ||
      !isNonEmptyString(placement?.laneKey) ||
      !isNonEmptyString(placement?.taskId)
    ) {
      diagnostics.push(
        diagnostic(
          'view.invalid-definition',
          'Custom placements require non-empty key, laneKey, and taskId values.',
          `view.placements[${index}]`,
        ),
      );
      return;
    }
    if (!laneKeyCounts.has(placement.laneKey)) {
      diagnostics.push(
        diagnostic(
          'view.missing-lane',
          `Custom placement "${placement.key}" references missing lane "${placement.laneKey}".`,
          `view.placements[${index}].laneKey`,
        ),
      );
    }
    placementKeyCounts.set(placement.key, (placementKeyCounts.get(placement.key) ?? 0) + 1);
  });
  for (const [key, count] of placementKeyCounts) {
    if (count > 1) {
      diagnostics.push(
        diagnostic(
          'view.duplicate-placement-key',
          `Custom placement key "${key}" is not unique.`,
          'view.placements',
        ),
      );
    }
  }
  if (diagnostics.length > 0) {
    return rejected(diagnostics);
  }

  const indexes = buildDocumentIndexes(document);
  const resolvedLaneKeys = new Map(
    definition.lanes.map((lane) => [
      lane.key,
      laneKey(['custom', definition.id, 'lane', lane.key]),
    ]),
  );
  const lanes = definition.lanes.map((lane, sourceOrder) => ({
    key: resolvedLaneKeys.get(lane.key)!,
    title: lane.title,
    sourceOrder,
    ...(lane.minimumHeight === undefined ? {} : { minimumHeight: lane.minimumHeight }),
    source: {
      kind: 'custom' as const,
      viewId: definition.id,
      customLaneKey: lane.key,
    },
  }));
  const placements: ResolvedViewPlacement[] = [];
  const referenceDiagnostics: Diagnostic[] = [];

  definition.placements.forEach((placement, sourceOrder) => {
    const placementDiagnostics = validatePlacementReference(
      indexes.tasksById.get(placement.taskId),
      placement.assignmentId === undefined
        ? undefined
        : indexes.assignmentsById.get(placement.assignmentId),
      placement,
      `view.placements[${sourceOrder}]`,
    );
    if (placementDiagnostics.length > 0) {
      referenceDiagnostics.push(...placementDiagnostics);
      return;
    }
    placements.push({
      key: placementKey(['custom', definition.id, 'placement', placement.key]),
      laneKey: resolvedLaneKeys.get(placement.laneKey)!,
      taskId: placement.taskId,
      ...(placement.segmentId === undefined ? {} : { segmentId: placement.segmentId }),
      ...(placement.assignmentId === undefined ? {} : { assignmentId: placement.assignmentId }),
      sourceOrder,
      source: {
        kind: 'custom',
        viewId: definition.id,
        customPlacementKey: placement.key,
      },
    });
  });

  return resolved('custom', lanes, placements, referenceDiagnostics);
}

/**
 * Resolves every supported view into one renderer-independent topology while
 * preserving canonical order and isolating invalid placement references.
 */
export function resolveView(
  document: GanttDocument,
  definition: GanttViewDefinition = DEFAULT_VIEW,
  options: ResolveViewOptions = {},
): ResolveViewResult {
  switch (definition.kind) {
    case 'document':
      return resolveDocumentView(document);
    case 'project':
      return resolveProjectView(document, definition, options.project);
    case 'resource':
      return resolveResourceView(document);
    case 'custom':
      return resolveCustomView(document, definition);
    default:
      return rejected([
        diagnostic('view.invalid-definition', 'Unsupported view definition.', 'view.kind'),
      ]);
  }
}

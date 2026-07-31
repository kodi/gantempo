import type { GanttDocument } from '../model/types';
import type {
  GanttInteractionTarget,
  GanttProjectSessionState,
  GanttRuntimeOccurrence,
  GanttSessionState,
} from './types';

const EMPTY_SELECTION = Object.freeze([]) as readonly GanttInteractionTarget[];

function requiredString(input: unknown, name: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return input;
}

function optionalString(input: Record<string, unknown>, key: string): { readonly value?: string } {
  if (!Object.hasOwn(input, key)) {
    return Object.freeze({});
  }
  return Object.freeze({ value: requiredString(input[key], key) });
}

export function cloneInteractionTarget(input: GanttInteractionTarget): GanttInteractionTarget {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('An interaction target must be a plain data object.');
  }
  const record = input as unknown as Record<string, unknown>;
  if (record.kind === 'dependency') {
    return Object.freeze({
      dependencyId: requiredString(record.dependencyId, 'dependencyId'),
      kind: 'dependency',
    });
  }
  if (record.kind === 'lane') {
    const laneId = optionalString(record, 'laneId').value;
    const resourceId = optionalString(record, 'resourceId').value;
    return Object.freeze({
      kind: 'lane',
      ...(laneId === undefined ? {} : { laneId }),
      ...(resourceId === undefined ? {} : { resourceId }),
      viewKey: requiredString(record.viewKey, 'viewKey'),
    });
  }
  if (record.kind !== 'task') {
    throw new TypeError('An interaction target kind must be dependency, lane, or task.');
  }
  const assignmentId = optionalString(record, 'assignmentId').value;
  const laneId = optionalString(record, 'laneId').value;
  const placementId = optionalString(record, 'placementId').value;
  const resourceId = optionalString(record, 'resourceId').value;
  const segmentId = optionalString(record, 'segmentId').value;
  return Object.freeze({
    ...(assignmentId === undefined ? {} : { assignmentId }),
    kind: 'task',
    ...(laneId === undefined ? {} : { laneId }),
    laneViewKey: requiredString(record.laneViewKey, 'laneViewKey'),
    ...(placementId === undefined ? {} : { placementId }),
    ...(resourceId === undefined ? {} : { resourceId }),
    ...(segmentId === undefined ? {} : { segmentId }),
    taskId: requiredString(record.taskId, 'taskId'),
    viewKey: requiredString(record.viewKey, 'viewKey'),
  });
}

export function interactionTargetIdentity(target: GanttInteractionTarget): string {
  return target.kind === 'dependency'
    ? `${target.kind}\u0000${target.dependencyId}`
    : `${target.kind}\u0000${target.viewKey}`;
}

function targetEqual(
  previous: GanttInteractionTarget | undefined,
  next: GanttInteractionTarget | undefined,
): boolean {
  if (previous === next) {
    return true;
  }
  if (previous === undefined || next === undefined || previous.kind !== next.kind) {
    return false;
  }
  if (previous.kind === 'lane' && next.kind === 'lane') {
    return (
      previous.viewKey === next.viewKey &&
      previous.laneId === next.laneId &&
      previous.resourceId === next.resourceId
    );
  }
  if (previous.kind === 'dependency' && next.kind === 'dependency') {
    return previous.dependencyId === next.dependencyId;
  }
  if (previous.kind !== 'task' || next.kind !== 'task') {
    return false;
  }
  return (
    previous.viewKey === next.viewKey &&
    previous.laneViewKey === next.laneViewKey &&
    previous.taskId === next.taskId &&
    previous.placementId === next.placementId &&
    previous.laneId === next.laneId &&
    previous.resourceId === next.resourceId &&
    previous.assignmentId === next.assignmentId &&
    previous.segmentId === next.segmentId
  );
}

export function sessionEqual(previous: GanttSessionState, next: GanttSessionState): boolean {
  return (
    previous.viewport.verticalStart === next.viewport.verticalStart &&
    (previous.project === next.project ||
      (previous.project !== undefined &&
        next.project !== undefined &&
        previous.project.collapsedTaskIds.length === next.project.collapsedTaskIds.length &&
        previous.project.collapsedTaskIds.every(
          (id, index) => id === next.project!.collapsedTaskIds[index],
        ))) &&
    targetEqual(previous.focused, next.focused) &&
    previous.selection.length === next.selection.length &&
    previous.selection.every((target, index) => targetEqual(target, next.selection[index]))
  );
}

function normalizeProjectSession(input: unknown): GanttProjectSessionState | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Session project state must be a plain data object.');
  }
  const collapsedInput = (input as Record<string, unknown>).collapsedTaskIds;
  if (!Array.isArray(collapsedInput)) {
    throw new TypeError('Session collapsedTaskIds must be an array.');
  }
  const collapsedTaskIds: string[] = [];
  const seen = new Set<string>();
  for (const id of collapsedInput) {
    const normalized = requiredString(id, 'collapsedTaskIds item');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      collapsedTaskIds.push(normalized);
    }
  }
  return Object.freeze({ collapsedTaskIds: Object.freeze(collapsedTaskIds) });
}

export function normalizeSessionState(
  input: Partial<GanttSessionState> | undefined,
): GanttSessionState {
  const selectionInput = input?.selection ?? EMPTY_SELECTION;
  if (!Array.isArray(selectionInput)) {
    throw new TypeError('Session selection must be an array.');
  }
  const selection: GanttInteractionTarget[] = [];
  const identities = new Set<string>();
  for (const targetInput of selectionInput) {
    const target = cloneInteractionTarget(targetInput);
    const identity = interactionTargetIdentity(target);
    if (!identities.has(identity)) {
      identities.add(identity);
      selection.push(target);
    }
  }

  const verticalStart = input?.viewport?.verticalStart ?? 0;
  if (typeof verticalStart !== 'number' || !Number.isFinite(verticalStart) || verticalStart < 0) {
    throw new RangeError('Session verticalStart must be a finite non-negative number.');
  }
  const focused = input?.focused === undefined ? undefined : cloneInteractionTarget(input.focused);
  const project = normalizeProjectSession(input?.project);
  return Object.freeze({
    ...(focused === undefined ? {} : { focused }),
    ...(project === undefined ? {} : { project }),
    selection: selection.length === 0 ? EMPTY_SELECTION : Object.freeze(selection),
    viewport: Object.freeze({ verticalStart }),
  });
}

export function reconcileSessionDocument(
  session: GanttSessionState,
  document: GanttDocument,
): GanttSessionState {
  const dependencyIds = new Set(document.dependencies.map((dependency) => dependency.id));
  const retainsTarget = (target: GanttInteractionTarget): boolean =>
    target.kind !== 'dependency' || dependencyIds.has(target.dependencyId);
  const parentIds = new Set(
    document.tasks.flatMap((task) => (task.parentId === undefined ? [] : [task.parentId])),
  );
  const collapsed = new Set(session.project?.collapsedTaskIds ?? []);
  const collapsedTaskIds =
    session.project === undefined
      ? undefined
      : document.tasks
          .filter((task) => parentIds.has(task.id) && collapsed.has(task.id))
          .map((task) => task.id);
  const focused =
    session.focused !== undefined && retainsTarget(session.focused) ? session.focused : undefined;
  const selection = session.selection.filter(retainsTarget);
  if (
    focused === session.focused &&
    selection.length === session.selection.length &&
    (collapsedTaskIds === undefined ||
      (collapsedTaskIds.length === session.project!.collapsedTaskIds.length &&
        collapsedTaskIds.every((id, index) => id === session.project!.collapsedTaskIds[index])))
  ) {
    return session;
  }
  return Object.freeze({
    ...(focused === undefined ? {} : { focused }),
    ...(collapsedTaskIds === undefined
      ? {}
      : { project: Object.freeze({ collapsedTaskIds: Object.freeze(collapsedTaskIds) }) }),
    selection: selection.length === 0 ? EMPTY_SELECTION : Object.freeze(selection),
    viewport: session.viewport,
  });
}

export function normalizeOccurrences(
  input: readonly GanttRuntimeOccurrence[],
): readonly GanttRuntimeOccurrence[] {
  if (!Array.isArray(input)) {
    throw new TypeError('Runtime occurrences must be an array.');
  }
  const identities = new Set<string>();
  const occurrences: GanttRuntimeOccurrence[] = [];
  for (const occurrence of input) {
    if (
      typeof occurrence !== 'object' ||
      occurrence === null ||
      !Number.isInteger(occurrence.laneIndex) ||
      occurrence.laneIndex < 0 ||
      typeof occurrence.horizontalCenter !== 'number' ||
      !Number.isFinite(occurrence.horizontalCenter)
    ) {
      throw new TypeError('A runtime occurrence requires finite geometry and a lane index.');
    }
    const target = cloneInteractionTarget(occurrence.target);
    const identity = interactionTargetIdentity(target);
    if (identities.has(identity)) {
      throw new TypeError(`Duplicate runtime occurrence identity "${identity}".`);
    }
    identities.add(identity);
    occurrences.push(
      Object.freeze({
        horizontalCenter: occurrence.horizontalCenter,
        laneIndex: occurrence.laneIndex,
        target,
      }),
    );
  }
  return Object.freeze(occurrences);
}

function laneViewKey(target: GanttInteractionTarget): string {
  return target.kind === 'task' ? target.laneViewKey : target.kind === 'lane' ? target.viewKey : '';
}

function nearestFocus(
  focused: GanttInteractionTarget,
  previous: readonly GanttRuntimeOccurrence[],
  current: readonly GanttRuntimeOccurrence[],
): GanttInteractionTarget | undefined {
  const previousOccurrence = previous.find(
    (occurrence) =>
      interactionTargetIdentity(occurrence.target) === interactionTargetIdentity(focused),
  );
  const taskOccurrences = current.filter(
    (
      occurrence,
    ): occurrence is GanttRuntimeOccurrence & {
      readonly target: Extract<GanttInteractionTarget, { readonly kind: 'task' }>;
    } => occurrence.target.kind === 'task',
  );
  if (taskOccurrences.length === 0) {
    return undefined;
  }
  const oldLaneKey = laneViewKey(focused);
  const oldCenter = previousOccurrence?.horizontalCenter ?? 0;
  const oldLaneIndex = previousOccurrence?.laneIndex ?? 0;
  const sameLane = taskOccurrences.filter(
    (occurrence) => occurrence.target.laneViewKey === oldLaneKey,
  );
  const candidates = sameLane.length > 0 ? sameLane : taskOccurrences;
  const ranked = candidates
    .map((occurrence, sourceOrder) => ({ occurrence, sourceOrder }))
    .sort((left, right) => {
      const leftLaneDistance = Math.abs(left.occurrence.laneIndex - oldLaneIndex);
      const rightLaneDistance = Math.abs(right.occurrence.laneIndex - oldLaneIndex);
      const leftHorizontalDistance = Math.abs(left.occurrence.horizontalCenter - oldCenter);
      const rightHorizontalDistance = Math.abs(right.occurrence.horizontalCenter - oldCenter);
      return (
        leftLaneDistance - rightLaneDistance ||
        leftHorizontalDistance - rightHorizontalDistance ||
        left.sourceOrder - right.sourceOrder
      );
    });
  return ranked[0]?.occurrence.target;
}

export function reconcileSessionOccurrences(
  session: GanttSessionState,
  previous: readonly GanttRuntimeOccurrence[],
  current: readonly GanttRuntimeOccurrence[],
): GanttSessionState {
  const currentByIdentity = new Map(
    current.map((occurrence) => [interactionTargetIdentity(occurrence.target), occurrence.target]),
  );
  const selection = session.selection.flatMap((target) => {
    const currentTarget = currentByIdentity.get(interactionTargetIdentity(target));
    return currentTarget === undefined ? [] : [currentTarget];
  });
  let focused: GanttInteractionTarget | undefined;
  if (session.focused !== undefined) {
    focused =
      currentByIdentity.get(interactionTargetIdentity(session.focused)) ??
      nearestFocus(session.focused, previous, current);
  }
  const reconciled = Object.freeze({
    ...(focused === undefined ? {} : { focused }),
    ...(session.project === undefined ? {} : { project: session.project }),
    selection: selection.length === 0 ? EMPTY_SELECTION : Object.freeze(selection),
    viewport: session.viewport,
  });
  return sessionEqual(session, reconciled) ? session : reconciled;
}

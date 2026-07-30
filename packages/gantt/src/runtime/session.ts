import type { GanttInteractionTarget, GanttRuntimeOccurrence, GanttSessionState } from './types';

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
    throw new TypeError('An interaction target kind must be lane or task.');
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
  return `${target.kind}\u0000${target.viewKey}`;
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
    targetEqual(previous.focused, next.focused) &&
    previous.selection.length === next.selection.length &&
    previous.selection.every((target, index) => targetEqual(target, next.selection[index]))
  );
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
  return Object.freeze({
    ...(focused === undefined ? {} : { focused }),
    selection: selection.length === 0 ? EMPTY_SELECTION : Object.freeze(selection),
    viewport: Object.freeze({ verticalStart }),
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
  return target.kind === 'task' ? target.laneViewKey : target.viewKey;
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
    selection: selection.length === 0 ? EMPTY_SELECTION : Object.freeze(selection),
    viewport: session.viewport,
  });
  return sessionEqual(session, reconciled) ? session : reconciled;
}

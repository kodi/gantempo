import {
  coordinateToTime,
  hitTestInteraction,
  snapInteractionTime,
  timeToCoordinate,
} from './hit-test';
import type {
  InteractionCreateIntent,
  InteractionGestureEvent,
  InteractionGestureOptions,
  InteractionGestureState,
  InteractionHit,
  InteractionIntent,
  InteractionMoveIntent,
  InteractionPoint,
  InteractionProgressIntent,
  InteractionPreviewPrimitive,
  InteractionResizeIntent,
} from './types';

export const IDLE_INTERACTION_GESTURE = Object.freeze({
  status: 'idle',
}) satisfies InteractionGestureState;

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return value;
}

function threshold(
  pointerType: Extract<InteractionGestureState, { readonly status: 'pressed' }>['pointerType'],
  options: InteractionGestureOptions,
): number {
  return positive(
    pointerType === 'touch'
      ? (options.touchThreshold ?? 10)
      : pointerType === 'pen'
        ? (options.penThreshold ?? 5)
        : (options.mouseThreshold ?? 4),
    `${pointerType} gesture threshold`,
  );
}

function distance(left: InteractionPoint, right: InteractionPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function description(intent: InteractionIntent): string {
  if (intent.kind === 'create') {
    return `Create a task in the destination lane at ${intent.start}.`;
  }
  const title = intent.task.primitive.title;
  if (intent.kind === 'resize') {
    return `Resize ${title} ${intent.edge} to ${intent.time}.`;
  }
  if (intent.kind === 'progress') {
    return `Set ${title} progress to ${Math.round(intent.value * 100)}%.`;
  }
  const laneChanged = intent.source.laneViewKey !== intent.destination.viewKey;
  return laneChanged
    ? `Move ${title} to ${intent.start} in ${intent.destination.viewKey}.`
    : `Move ${title} to ${intent.start}.`;
}

export function createInteractionPreview(
  intent: InteractionIntent,
  options: InteractionGestureOptions,
): InteractionPreviewPrimitive {
  if (intent.kind === 'progress') {
    return Object.freeze({
      description: description(intent),
      destination: intent.destination,
      end: intent.end,
      height: intent.task.rect.height,
      kind: intent.kind,
      progress: intent.value,
      source: intent.source,
      start: intent.start,
      width: intent.task.rect.width * intent.value,
      x: intent.task.rect.x,
      y: intent.task.rect.y,
    });
  }
  const timeline = options.index.timeline;
  const startX = timeToCoordinate(
    timeline,
    options.index.range,
    intent.start,
    options.index.direction,
  );
  const endX = timeToCoordinate(timeline, options.index.range, intent.end, options.index.direction);
  const lane = options.index.lanes.find(
    (candidate) => candidate.target.viewKey === intent.destination.viewKey,
  );
  if (lane === undefined) {
    throw new RangeError('Interaction preview destination lane is not visible.');
  }
  const taskHeight =
    intent.kind === 'create' ? Math.min(24, lane.rect.height) : intent.task.rect.height;
  const sourceOffset =
    intent.kind === 'create'
      ? (lane.rect.height - taskHeight) / 2
      : intent.task.rect.y - intent.task.lane.rect.y;
  return Object.freeze({
    description: description(intent),
    destination: intent.destination,
    end: intent.end,
    height: taskHeight,
    kind: intent.kind,
    ...(intent.kind === 'create' ? {} : { source: intent.source }),
    start: intent.start,
    width: Math.abs(endX - startX),
    x: Math.min(startX, endX),
    y: lane.rect.y + Math.max(0, Math.min(sourceOffset, lane.rect.height - taskHeight)),
  });
}

function progressIntent(
  origin: Extract<InteractionHit, { readonly kind: 'task-progress' }>,
  current: InteractionHit,
  options: InteractionGestureOptions,
): InteractionProgressIntent {
  const physicalRatio = (current.point.x - origin.task.rect.x) / origin.task.rect.width;
  const ratio = options.index.direction === 'rtl' ? 1 - physicalRatio : physicalRatio;
  const value = Math.round(Math.min(1, Math.max(0, ratio)) * 20) / 20;
  return Object.freeze({
    destination: origin.lane.target,
    end: origin.task.primitive.end,
    kind: 'progress',
    source: origin.task.target,
    sourceValue: origin.task.primitive.progress?.value ?? 0,
    start: origin.task.primitive.start,
    task: origin.task,
    value,
  });
}

function moveIntent(
  origin: Extract<InteractionHit, { readonly kind: 'task-body' }>,
  current: InteractionHit,
  options: InteractionGestureOptions,
): InteractionMoveIntent {
  const rawStart = origin.task.primitive.start + (current.time - origin.time);
  const start = snapInteractionTime(rawStart, options.snap);
  const duration = origin.task.primitive.end - origin.task.primitive.start;
  return Object.freeze({
    delta: start - origin.task.primitive.start,
    destination: current.lane.target,
    end: start + duration,
    kind: 'move',
    source: origin.task.target,
    sourceEnd: origin.task.primitive.end,
    sourceStart: origin.task.primitive.start,
    start,
    task: origin.task,
  });
}

function resizeIntent(
  origin: Extract<InteractionHit, { readonly kind: 'task-edge' }>,
  current: InteractionHit,
  options: InteractionGestureOptions,
): InteractionResizeIntent {
  const time = snapInteractionTime(current.time, options.snap);
  const start = origin.edge === 'start' ? time : origin.task.primitive.start;
  const end = origin.edge === 'end' ? time : origin.task.primitive.end;
  return Object.freeze({
    destination: origin.lane.target,
    edge: origin.edge,
    end,
    kind: 'resize',
    source: origin.task.target,
    sourceEnd: origin.task.primitive.end,
    sourceStart: origin.task.primitive.start,
    start,
    task: origin.task,
    time,
  });
}

function createIntent(
  current: InteractionHit,
  options: InteractionGestureOptions,
): InteractionCreateIntent {
  const duration = positive(
    options.creationDuration ?? options.snap.step,
    'Interaction creation duration',
  );
  const start = snapInteractionTime(current.time, options.snap);
  return Object.freeze({
    destination: current.lane.target,
    end: start + duration,
    kind: 'create',
    start,
  });
}

function intentFromHit(
  origin: InteractionHit,
  current: InteractionHit,
  options: InteractionGestureOptions,
): InteractionIntent {
  if (origin.kind === 'task-body') {
    return moveIntent(origin, current, options);
  }
  if (origin.kind === 'task-edge') {
    return resizeIntent(origin, current, options);
  }
  if (origin.kind === 'task-progress') {
    return progressIntent(origin, current, options);
  }
  return createIntent(current, options);
}

function activeState(
  origin: InteractionHit,
  current: InteractionHit,
  pointerId: number,
  pointerType: Extract<InteractionGestureState, { readonly status: 'pressed' }>['pointerType'],
  start: InteractionPoint,
  options: InteractionGestureOptions,
): InteractionGestureState {
  const intent = intentFromHit(origin, current, options);
  return Object.freeze({
    intent,
    origin,
    pointerId,
    pointerType,
    preview: createInteractionPreview(intent, options),
    start,
    status: 'active',
  });
}

export function reduceInteractionGesture(
  state: InteractionGestureState,
  event: InteractionGestureEvent,
  options: InteractionGestureOptions,
): InteractionGestureState {
  if (event.type === 'reset') {
    return IDLE_INTERACTION_GESTURE;
  }
  if (event.type === 'cancel') {
    return state.status === 'idle'
      ? state
      : Object.freeze({ reason: 'cancelled', status: 'cancelled' });
  }
  if (event.type === 'press') {
    if (!Number.isInteger(event.pointerId) || event.pointerId < 0) {
      throw new RangeError('Interaction pointerId must be a non-negative integer.');
    }
    const hit = hitTestInteraction(
      options.index,
      event.point,
      event.pointerType,
      event.candidateViewKey,
      event.progressCandidateViewKey,
    );
    return hit === undefined
      ? IDLE_INTERACTION_GESTURE
      : Object.freeze({
          hit,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          start: hit.point,
          status: 'pressed',
        });
  }
  if (state.status !== 'pressed' && state.status !== 'active') {
    return state;
  }
  if (event.pointerId !== state.pointerId) {
    return state;
  }
  if (event.type === 'release') {
    return state.status === 'pressed'
      ? Object.freeze({ reason: 'threshold-not-met', status: 'cancelled' })
      : Object.freeze({
          intent: state.intent,
          preview: state.preview,
          status: 'committed',
        });
  }

  const current = hitTestInteraction(
    options.index,
    event.point,
    state.pointerType,
    event.candidateViewKey,
    event.progressCandidateViewKey,
  );
  if (current === undefined) {
    return state;
  }
  if (state.status === 'pressed') {
    if (distance(state.start, event.point) < threshold(state.pointerType, options)) {
      return state;
    }
    return activeState(
      state.hit,
      current,
      state.pointerId,
      state.pointerType,
      state.start,
      options,
    );
  }
  return activeState(
    state.origin,
    current,
    state.pointerId,
    state.pointerType,
    state.start,
    options,
  );
}

export function interactionTimeAtPoint(
  options: InteractionGestureOptions,
  point: InteractionPoint,
): number {
  return snapInteractionTime(
    coordinateToTime(
      options.index.timeline,
      options.index.range,
      point.x,
      true,
      options.index.direction,
    ),
    options.snap,
  );
}

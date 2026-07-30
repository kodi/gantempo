import { createInteractionPreview } from './gesture';
import { snapInteractionTime } from './hit-test';
import type {
  InteractionCreateIntent,
  InteractionGestureOptions,
  InteractionKeyboardAdjustment,
  InteractionKeyboardMode,
  InteractionKeyboardState,
  InteractionMoveIntent,
  InteractionResizeIntent,
  InteractionTaskNode,
} from './types';
import type { GanttTaskTarget } from '../runtime/types';

function targetIdentity(target: GanttTaskTarget): string {
  return `task\u0000${target.viewKey}`;
}

function taskForTarget(
  options: InteractionGestureOptions,
  target: GanttTaskTarget,
): InteractionTaskNode | undefined {
  const identity = targetIdentity(target);
  return options.index.tasks.find((task) => targetIdentity(task.target) === identity);
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return value;
}

function moveIntent(
  task: InteractionTaskNode,
  start: number,
  destinationIndex: number,
  options: InteractionGestureOptions,
): InteractionMoveIntent {
  const duration = task.primitive.end - task.primitive.start;
  const destination = options.index.lanes[destinationIndex]?.target;
  if (destination === undefined) {
    throw new RangeError('Keyboard move destination lane is not visible.');
  }
  return Object.freeze({
    delta: start - task.primitive.start,
    destination,
    end: start + duration,
    kind: 'move',
    source: task.target,
    sourceEnd: task.primitive.end,
    sourceStart: task.primitive.start,
    start,
    task,
  });
}

function resizeIntent(
  task: InteractionTaskNode,
  edge: 'end' | 'start',
  time: number,
): InteractionResizeIntent {
  return Object.freeze({
    destination: task.lane.target,
    edge,
    end: edge === 'end' ? time : task.primitive.end,
    kind: 'resize',
    source: task.target,
    sourceEnd: task.primitive.end,
    sourceStart: task.primitive.start,
    start: edge === 'start' ? time : task.primitive.start,
    task,
    time,
  });
}

function withPreview(
  mode: InteractionKeyboardMode,
  intent: InteractionMoveIntent | InteractionResizeIntent,
  options: InteractionGestureOptions,
): InteractionKeyboardState {
  return Object.freeze({
    intent,
    mode,
    preview: createInteractionPreview(intent, options),
    status: 'active',
  });
}

export function beginKeyboardInteraction(
  target: GanttTaskTarget,
  mode: InteractionKeyboardMode,
  options: InteractionGestureOptions,
): InteractionKeyboardState | undefined {
  const task = taskForTarget(options, target);
  if (task === undefined) {
    return undefined;
  }
  const intent =
    mode === 'move'
      ? moveIntent(task, task.primitive.start, task.lane.index, options)
      : resizeIntent(
          task,
          mode === 'resize-start' ? 'start' : 'end',
          mode === 'resize-start' ? task.primitive.start : task.primitive.end,
        );
  return withPreview(mode, intent, options);
}

export function adjustKeyboardInteraction(
  state: InteractionKeyboardState,
  adjustment: InteractionKeyboardAdjustment,
  options: InteractionGestureOptions,
): InteractionKeyboardState {
  const step = positive(options.snap.step, 'Keyboard interaction snap step');
  if (state.intent.kind === 'move') {
    const horizontalDelta = adjustment === 'left' ? -step : adjustment === 'right' ? step : 0;
    const matchedLaneIndex = options.index.lanes.findIndex(
      (lane) => lane.target.viewKey === state.intent.destination.viewKey,
    );
    const currentLaneIndex = matchedLaneIndex < 0 ? 0 : matchedLaneIndex;
    const destinationIndex =
      adjustment === 'up'
        ? Math.max(0, currentLaneIndex - 1)
        : adjustment === 'down'
          ? Math.min(options.index.lanes.length - 1, currentLaneIndex + 1)
          : currentLaneIndex;
    const intent = moveIntent(
      state.intent.task,
      state.intent.start + horizontalDelta,
      destinationIndex,
      options,
    );
    return withPreview(state.mode, intent, options);
  }
  if (adjustment === 'up' || adjustment === 'down') {
    return state;
  }
  const delta = adjustment === 'left' ? -step : step;
  const time = state.intent.time + delta;
  if (
    (state.intent.edge === 'start' && time >= state.intent.end) ||
    (state.intent.edge === 'end' && time <= state.intent.start)
  ) {
    return state;
  }
  return withPreview(state.mode, resizeIntent(state.intent.task, state.intent.edge, time), options);
}

export function keyboardCreationIntent(
  target: GanttTaskTarget,
  options: InteractionGestureOptions,
): InteractionCreateIntent | undefined {
  const task = taskForTarget(options, target);
  if (task === undefined) {
    return undefined;
  }
  const duration = positive(
    options.creationDuration ?? options.snap.step,
    'Keyboard interaction creation duration',
  );
  const start = snapInteractionTime(task.primitive.start, options.snap);
  return Object.freeze({
    destination: task.lane.target,
    end: start + duration,
    kind: 'create',
    start,
  });
}

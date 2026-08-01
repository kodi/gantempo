import { IDLE_INTERACTION_GESTURE, reduceInteractionGesture } from '../../interaction/gesture';
import type {
  InteractionGestureEvent,
  InteractionGestureOptions,
  InteractionGestureState,
  InteractionKeyboardState,
  InteractionPointerType,
} from '../../interaction/types';
import type { GanttTaskTarget } from '../../runtime/types';

export interface PointerGestureController<TGeometry> {
  geometry: TGeometry | undefined;
  isActive(): boolean;
  isIdle(): boolean;
  reset(): void;
  set(state: InteractionGestureState, geometry: TGeometry): void;
  state: InteractionGestureState;
  transition(event: InteractionGestureEvent, options: InteractionGestureOptions): void;
}

export function createPointerGestureController<TGeometry>(): PointerGestureController<TGeometry> {
  let state: InteractionGestureState = IDLE_INTERACTION_GESTURE;
  let currentGeometry: TGeometry | undefined;

  const controller: PointerGestureController<TGeometry> = {
    get geometry() {
      return currentGeometry;
    },
    set geometry(next) {
      currentGeometry = next;
    },
    isActive: () => state.status === 'pressed' || state.status === 'active',
    isIdle: () => state.status === 'idle',
    reset() {
      state = IDLE_INTERACTION_GESTURE;
      currentGeometry = undefined;
    },
    set(next, geometry) {
      state = next;
      currentGeometry = geometry;
    },
    get state() {
      return state;
    },
    set state(next) {
      state = next;
    },
    transition(event, options) {
      state = reduceInteractionGesture(state, event, options);
    },
  };
  return Object.freeze(controller);
}

export interface KeyboardInteractionController {
  clear(): void;
  current(): InteractionKeyboardState | undefined;
  replace(state: InteractionKeyboardState): void;
  state: InteractionKeyboardState | undefined;
}

export function createKeyboardInteractionController(): KeyboardInteractionController {
  let state: InteractionKeyboardState | undefined;
  const controller: KeyboardInteractionController = {
    clear() {
      state = undefined;
    },
    current: () => state,
    get state() {
      return state;
    },
    set state(next) {
      state = next;
    },
    replace(next) {
      state = next;
    },
  };
  return Object.freeze(controller);
}

export interface DependencyLinkState {
  readonly candidate?: GanttTaskTarget;
  readonly pointerType?: InteractionPointerType;
  readonly source: GanttTaskTarget;
}

export interface DependencyLinkController {
  begin(source: GanttTaskTarget, pointerType?: InteractionPointerType): boolean;
  clear(): DependencyLinkState | undefined;
  current(): DependencyLinkState | undefined;
  state: DependencyLinkState | undefined;
  update(candidate?: GanttTaskTarget): boolean;
}

export function createDependencyLinkController(): DependencyLinkController {
  let state: DependencyLinkState | undefined;
  const controller: DependencyLinkController = {
    begin(source, pointerType) {
      if (state !== undefined) return false;
      state = Object.freeze({
        ...(pointerType === undefined ? {} : { pointerType }),
        source,
      });
      return true;
    },
    clear() {
      const previous = state;
      state = undefined;
      return previous;
    },
    current: () => state,
    get state() {
      return state;
    },
    set state(next) {
      state = next;
    },
    update(candidate) {
      if (state === undefined || state.candidate === candidate) return false;
      state = Object.freeze({
        ...(candidate === undefined ? {} : { candidate }),
        ...(state.pointerType === undefined ? {} : { pointerType: state.pointerType }),
        source: state.source,
      });
      return true;
    },
  };
  return Object.freeze(controller);
}

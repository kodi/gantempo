import type { InteractionPoint } from './types';

export type ViewportPanAxis = 'both' | 'horizontal';

export type ViewportPanGestureState =
  | { readonly status: 'idle' }
  | {
      readonly axis: ViewportPanAxis;
      readonly last: InteractionPoint;
      readonly origin: InteractionPoint;
      readonly pointerId: number;
      readonly status: 'pressed' | 'active';
    };

export interface ViewportPanMove {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly handled: boolean;
  readonly state: ViewportPanGestureState;
}

export const IDLE_VIEWPORT_PAN_GESTURE: ViewportPanGestureState = Object.freeze({
  status: 'idle',
});

function validPoint(point: InteractionPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function beginViewportPanGesture(
  pointerId: number,
  point: InteractionPoint,
  axis: ViewportPanAxis,
): ViewportPanGestureState {
  if (!Number.isInteger(pointerId) || pointerId < 0 || !validPoint(point)) {
    return IDLE_VIEWPORT_PAN_GESTURE;
  }
  return Object.freeze({
    axis,
    last: Object.freeze({ ...point }),
    origin: Object.freeze({ ...point }),
    pointerId,
    status: 'pressed',
  });
}

export function moveViewportPanGesture(
  state: ViewportPanGestureState,
  pointerId: number,
  point: InteractionPoint,
  threshold = 4,
): ViewportPanMove {
  if (
    state.status === 'idle' ||
    state.pointerId !== pointerId ||
    !validPoint(point) ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  ) {
    return Object.freeze({ deltaX: 0, deltaY: 0, handled: false, state });
  }
  if (
    state.status === 'pressed' &&
    Math.hypot(point.x - state.origin.x, point.y - state.origin.y) < threshold
  ) {
    return Object.freeze({ deltaX: 0, deltaY: 0, handled: true, state });
  }
  const deltaX = state.last.x - point.x;
  const deltaY = state.axis === 'both' ? state.last.y - point.y : 0;
  const next = Object.freeze({
    ...state,
    last: Object.freeze({ ...point }),
    status: 'active' as const,
  });
  return Object.freeze({ deltaX, deltaY, handled: true, state: next });
}

export function endViewportPanGesture(
  state: ViewportPanGestureState,
  pointerId: number,
): {
  readonly active: boolean;
  readonly handled: boolean;
  readonly state: ViewportPanGestureState;
} {
  if (state.status === 'idle' || state.pointerId !== pointerId) {
    return Object.freeze({ active: false, handled: false, state });
  }
  return Object.freeze({
    active: state.status === 'active',
    handled: true,
    state: IDLE_VIEWPORT_PAN_GESTURE,
  });
}

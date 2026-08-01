import {
  beginViewportPanGesture,
  endViewportPanGesture,
  IDLE_VIEWPORT_PAN_GESTURE,
  moveViewportPanGesture,
  type ViewportPanAxis,
  type ViewportPanGestureState,
} from '../../interaction/pan-gesture';
import type { InteractionPoint } from '../../interaction/types';

export interface ViewportPanController {
  begin(pointerId: number, point: InteractionPoint, axis: ViewportPanAxis): boolean;
  end(pointerId: number): ReturnType<typeof endViewportPanGesture>;
  isIdle(): boolean;
  move(pointerId: number, point: InteractionPoint): ReturnType<typeof moveViewportPanGesture>;
  reset(): void;
}

export function createViewportPanController(): ViewportPanController {
  let state: ViewportPanGestureState = IDLE_VIEWPORT_PAN_GESTURE;

  const controller: ViewportPanController = {
    begin(pointerId, point, axis) {
      state = beginViewportPanGesture(pointerId, point, axis);
      return state.status !== 'idle';
    },
    end(pointerId) {
      const result = endViewportPanGesture(state, pointerId);
      state = result.state;
      return result;
    },
    isIdle() {
      return state.status === 'idle';
    },
    move(pointerId, point) {
      const result = moveViewportPanGesture(state, pointerId, point);
      state = result.state;
      return result;
    },
    reset() {
      state = IDLE_VIEWPORT_PAN_GESTURE;
    },
  };
  return Object.freeze(controller);
}

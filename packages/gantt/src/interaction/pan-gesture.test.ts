import { describe, expect, it } from 'vite-plus/test';

import {
  beginViewportPanGesture,
  endViewportPanGesture,
  IDLE_VIEWPORT_PAN_GESTURE,
  moveViewportPanGesture,
} from './pan-gesture';

describe('viewport pan gesture', () => {
  it('activates only after threshold and reverses pointer motion for content-following pan', () => {
    const pressed = beginViewportPanGesture(1, { x: 100, y: 100 }, 'both');
    const below = moveViewportPanGesture(pressed, 1, { x: 102, y: 102 });
    expect(below).toMatchObject({ deltaX: 0, deltaY: 0, handled: true });
    expect(below.state).toBe(pressed);

    const active = moveViewportPanGesture(pressed, 1, { x: 110, y: 90 });
    expect(active).toMatchObject({ deltaX: -10, deltaY: 10, handled: true });
    expect(active.state.status).toBe('active');
    const continued = moveViewportPanGesture(active.state, 1, { x: 115, y: 95 });
    expect(continued).toMatchObject({ deltaX: -5, deltaY: -5, handled: true });
  });

  it('locks header gestures to the horizontal axis', () => {
    const pressed = beginViewportPanGesture(2, { x: 50, y: 50 }, 'horizontal');
    expect(moveViewportPanGesture(pressed, 2, { x: 40, y: 80 })).toMatchObject({
      deltaX: 10,
      deltaY: 0,
      handled: true,
      state: { status: 'active' },
    });
  });

  it('ignores foreign/invalid pointers and reports active completion', () => {
    expect(beginViewportPanGesture(-1, { x: 0, y: 0 }, 'both')).toBe(IDLE_VIEWPORT_PAN_GESTURE);
    const pressed = beginViewportPanGesture(3, { x: 0, y: 0 }, 'both');
    expect(moveViewportPanGesture(pressed, 4, { x: 10, y: 10 }).handled).toBe(false);
    expect(endViewportPanGesture(pressed, 4).handled).toBe(false);
    const active = moveViewportPanGesture(pressed, 3, { x: 10, y: 0 }).state;
    expect(endViewportPanGesture(active, 3)).toEqual({
      active: true,
      handled: true,
      state: IDLE_VIEWPORT_PAN_GESTURE,
    });
  });
});

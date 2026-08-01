import { describe, expect, it } from 'vite-plus/test';

import type { InteractionKeyboardState } from '../../interaction/types';
import type { GanttTaskTarget } from '../../runtime/types';
import {
  createDependencyLinkController,
  createKeyboardInteractionController,
  createPointerGestureController,
} from './interaction-controllers';

const source = Object.freeze({
  kind: 'task',
  laneViewKey: 'lane:a',
  taskId: 'task:a',
  viewKey: 'task:a@lane:a',
}) satisfies GanttTaskTarget;
const candidate = Object.freeze({
  kind: 'task',
  laneViewKey: 'lane:b',
  taskId: 'task:b',
  viewKey: 'task:b@lane:b',
}) satisfies GanttTaskTarget;

describe('runtime interaction controllers', () => {
  it('owns pointer gesture state and geometry until reset', () => {
    const controller = createPointerGestureController<{ readonly width: number }>();
    expect(controller.isIdle()).toBe(true);

    controller.set({ reason: 'cancelled', status: 'cancelled' }, { width: 640 });
    expect(controller.state.status).toBe('cancelled');
    expect(controller.geometry).toEqual({ width: 640 });

    controller.reset();
    expect(controller.isIdle()).toBe(true);
    expect(controller.geometry).toBeUndefined();
  });

  it('keeps keyboard interaction state instance-local', () => {
    const controller = createKeyboardInteractionController();
    const state = Object.freeze({ status: 'active' }) as InteractionKeyboardState;

    controller.replace(state);
    expect(controller.current()).toBe(state);
    controller.clear();
    expect(controller.current()).toBeUndefined();
  });

  it('owns dependency-link begin, candidate, and completion state', () => {
    const controller = createDependencyLinkController();

    expect(controller.begin(source, 'mouse')).toBe(true);
    expect(controller.begin(candidate)).toBe(false);
    expect(controller.update(candidate)).toBe(true);
    expect(controller.current()).toEqual({ candidate, pointerType: 'mouse', source });
    expect(controller.update()).toBe(true);
    expect(controller.clear()).toEqual({ pointerType: 'mouse', source });
    expect(controller.current()).toBeUndefined();
  });
});

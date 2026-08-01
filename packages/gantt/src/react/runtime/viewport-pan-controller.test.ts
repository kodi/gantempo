import { describe, expect, it } from 'vite-plus/test';

import { createViewportPanController } from './viewport-pan-controller';

describe('runtime viewport pan controller', () => {
  it('keeps pan state instance-local through activation and completion', () => {
    const first = createViewportPanController();
    const second = createViewportPanController();

    expect(first.begin(1, { x: 100, y: 100 }, 'both')).toBe(true);
    expect(first.isIdle()).toBe(false);
    expect(second.isIdle()).toBe(true);

    expect(first.move(1, { x: 110, y: 90 })).toMatchObject({
      deltaX: -10,
      deltaY: 10,
      handled: true,
      state: { status: 'active' },
    });
    expect(first.end(1)).toMatchObject({ active: true, handled: true });
    expect(first.isIdle()).toBe(true);
  });

  it('can reset an unfinished gesture during runtime disposal', () => {
    const controller = createViewportPanController();
    controller.begin(2, { x: 0, y: 0 }, 'horizontal');
    controller.reset();
    expect(controller.isIdle()).toBe(true);
    expect(controller.end(2).handled).toBe(false);
  });
});

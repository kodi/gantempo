import { describe, expect, it } from 'vite-plus/test';

import { createRuntimeRangeController } from './range-controller';

describe('runtime range controller', () => {
  it('publishes reason and anchor metadata while adopting uncontrolled ranges', () => {
    const adopted: unknown[] = [];
    const published: unknown[] = [];
    const controller = createRuntimeRangeController({
      adoptUncontrolledRange: (range) => adopted.push(range),
      canPublish: () => true,
      initialRange: { start: 0, end: 100 },
      isControlled: false,
      publish: (range, event) => published.push({ event, range }),
      schedule: (update) => {
        update();
        return undefined;
      },
    });

    expect(controller.request({ start: 20, end: 80 }, 'zoom', 'imperative', 50)).toBe(true);
    expect(adopted).toEqual([{ start: 20, end: 80 }]);
    expect(published).toEqual([
      {
        event: { anchorTime: 50, reason: 'zoom', source: 'imperative' },
        range: { start: 20, end: 80 },
      },
    ]);
  });

  it('retains pan context for scheduled pixel shifts', () => {
    let scheduled: (() => void) | undefined;
    const published: unknown[] = [];
    const controller = createRuntimeRangeController({
      adoptUncontrolledRange: () => undefined,
      canPublish: () => true,
      initialRange: { start: 0, end: 100 },
      isControlled: true,
      publish: (range, event) => published.push({ event, range }),
      schedule: (update) => {
        scheduled = update;
        return undefined;
      },
    });

    expect(controller.shiftByPixels(10, 100, 'runtime', 'pan')).toBe(true);
    scheduled?.();
    expect(published).toEqual([
      { event: { reason: 'pan', source: 'runtime' }, range: { start: 10, end: 110 } },
    ]);
  });
});

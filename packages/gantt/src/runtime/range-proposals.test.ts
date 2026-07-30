import { describe, expect, it } from 'vite-plus/test';

import { createRangeProposalController } from './range-proposals';

function scheduler() {
  const frames: { cancelled: boolean; publish: () => void }[] = [];
  return {
    frames,
    schedule: (publish: () => void) => {
      const frame = { cancelled: false, publish };
      frames.push(frame);
      return () => {
        frame.cancelled = true;
      };
    },
  };
}

describe('controlled range proposal controller', () => {
  it('coalesces one frame and rebases later deltas on the pending proposal', () => {
    const scheduled = scheduler();
    const published: unknown[] = [];
    const controller = createRangeProposalController({
      canPublish: () => true,
      initialRange: { start: 0, end: 100 },
      publish(range, source) {
        published.push({ range, source });
      },
      schedule: scheduled.schedule,
    });

    expect(controller.shiftByPixels(10, 100, 'runtime')).toBe(true);
    expect(controller.shiftByPixels(20, 100, 'runtime')).toBe(true);
    expect(scheduled.frames).toHaveLength(1);
    expect(controller.getPending()).toEqual({ start: 30, end: 130 });
    scheduled.frames[0]!.publish();
    expect(published).toEqual([{ range: { start: 30, end: 130 }, source: 'runtime' }]);

    expect(controller.shiftByTime(5, 'runtime')).toBe(true);
    expect(controller.getPending()).toEqual({ start: 35, end: 135 });
    scheduled.frames[1]!.publish();
    expect(published).toHaveLength(2);
  });

  it('clears matching acknowledgement and cancels stale work on external replacement', () => {
    const scheduled = scheduler();
    const published: unknown[] = [];
    const controller = createRangeProposalController({
      canPublish: () => true,
      initialRange: { start: 0, end: 100 },
      publish: (range) => published.push(range),
      schedule: scheduled.schedule,
    });

    controller.shiftByTime(10, 'runtime');
    controller.adopt({ start: 10, end: 110 });
    expect(controller.getPending()).toBeUndefined();
    expect(scheduled.frames[0]!.cancelled).toBe(true);

    controller.shiftByTime(20, 'runtime');
    controller.adopt({ start: 10, end: 110 });
    expect(controller.getPending()).toEqual({ start: 30, end: 130 });
    controller.adopt({ start: 500, end: 600 });
    expect(controller.getPending()).toBeUndefined();
    expect(scheduled.frames[1]!.cancelled).toBe(true);
    expect(published).toEqual([]);
  });

  it('supports immediate requests, callback absence, cancellation, and independent instances', () => {
    const firstSchedule = scheduler();
    const secondSchedule = scheduler();
    const firstPublished: unknown[] = [];
    const secondPublished: unknown[] = [];
    let enabled = false;
    const first = createRangeProposalController({
      canPublish: () => enabled,
      initialRange: { start: 0, end: 100 },
      publish: (range, source) => firstPublished.push({ range, source }),
      schedule: firstSchedule.schedule,
    });
    const second = createRangeProposalController({
      canPublish: () => true,
      initialRange: { start: 1_000, end: 1_100 },
      publish: (range) => secondPublished.push(range),
      schedule: secondSchedule.schedule,
    });

    expect(first.shiftByTime(10, 'runtime')).toBe(false);
    enabled = true;
    expect(first.requestRange({ start: 200, end: 300 }, 'imperative')).toBe(true);
    expect(firstPublished).toEqual([{ range: { start: 200, end: 300 }, source: 'imperative' }]);
    expect(second.shiftByTime(-10, 'runtime')).toBe(true);
    first.dispose();
    second.dispose();
    expect(secondSchedule.frames[0]!.cancelled).toBe(true);
    expect(first.shiftByTime(10, 'runtime')).toBe(false);
    expect(secondPublished).toEqual([]);
  });
});

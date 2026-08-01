import { describe, expect, it } from 'vite-plus/test';

import type { GanttSessionState } from '../../runtime/types';
import { createRuntimeViewportController } from './viewport-controller';

describe('runtime viewport controller', () => {
  it('maps RTL horizontal motion and vertical scrolling through explicit host callbacks', () => {
    const session: GanttSessionState = { selection: [], viewport: { verticalStart: 10 } };
    const shifts: number[] = [];
    const sessions: GanttSessionState[] = [];
    const controller = createRuntimeViewportController({
      announceEmpty: () => undefined,
      getDirection: () => 'rtl',
      getDocument: () => ({
        assignments: [],
        dependencies: [],
        lanes: [],
        placements: [],
        resources: [],
        schemaVersion: 1,
        tasks: [],
      }),
      getRange: () => ({ start: 0, end: 100 }),
      getSession: () => session,
      getTimeScale: () => ({ kind: 'fixed', tickAnchor: 0, tickInterval: 10 }),
      getTimelineHeight: () => 1_000,
      getTimeZone: () => 'UTC',
      getViewport: () => ({
        clientHeight: 200,
        clientWidth: 800,
        overscanAfter: 0,
        overscanBefore: 0,
        queryVerticalExtent: 200,
        queryVerticalStart: 0,
        status: 'measured',
        verticalStart: 10,
      }),
      requestRange: () => true,
      shiftRangeByPixels(delta) {
        shifts.push(delta);
        return true;
      },
      updateSession(next) {
        sessions.push(next);
        return true;
      },
    });

    expect(
      controller.navigate({
        horizontalDelta: 25,
        reason: 'pan',
        verticalDelta: 50,
        viewportHeight: 200,
        viewportWidth: 800,
      }),
    ).toEqual({ horizontal: true, vertical: true });
    expect(shifts).toEqual([-25]);
    expect(sessions[0]?.viewport.verticalStart).toBe(60);
  });
});

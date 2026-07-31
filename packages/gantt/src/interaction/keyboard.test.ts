import { describe, expect, it } from 'vite-plus/test';

import type { ChartScene } from '../render/primitives';
import { createInteractionHitTestIndex } from './hit-test';
import {
  adjustKeyboardInteraction,
  beginKeyboardInteraction,
  keyboardCreationIntent,
} from './keyboard';
import type { InteractionGestureOptions } from './types';

function fixture(): InteractionGestureOptions {
  const scene: ChartScene = {
    bounds: {
      defaultLaneHeight: 60,
      headerHeight: 40,
      laneColumnWidth: 160,
      timelineHeight: 120,
      totalHeight: 160,
    },
    diagnostics: [],
    gridLines: [],
    lanes: [
      {
        height: 60,
        laneId: 'lane-a',
        source: { kind: 'document-lane', laneId: 'lane-a' },
        title: 'Lane A',
        viewKey: 'lane-a-view',
        y: 0,
      },
      {
        height: 60,
        laneId: 'lane-b',
        source: { kind: 'document-lane', laneId: 'lane-b' },
        title: 'Lane B',
        viewKey: 'lane-b-view',
        y: 60,
      },
    ],
    range: { end: 1_000, start: 0 },
    taskBars: [
      {
        clippedEnd: false,
        clippedStart: false,
        end: 300,
        height: 24,
        laneId: 'lane-a',
        laneViewKey: 'lane-a-view',
        placementId: 'placement-a',
        presentation: { geometry: { kind: 'bar' }, intervalSource: 'canonical', kind: 'task' },
        progress: { value: 0.25, width: 0.05, x: 0.1 },
        source: {
          kind: 'document-placement',
          laneId: 'lane-a',
          placementId: 'placement-a',
        },
        start: 100,
        taskId: 'task-a',
        title: 'Task A',
        viewKey: 'task-a-view',
        width: 0.2,
        x: 0.1,
        y: 18,
      },
    ],
    ticks: [],
  };
  return {
    creationDuration: 200,
    index: createInteractionHitTestIndex(
      scene,
      {
        height: 120,
        verticalStart: 0,
        width: 1_000,
        x: 0,
        y: 0,
      },
      { progressTaskIds: ['task-a'] },
    ),
    snap: { anchor: 0, step: 100 },
  };
}

describe('pure keyboard interaction intent', () => {
  it('moves by the shared snap step and visible lane geometry', () => {
    const options = fixture();
    const target = options.index.tasks[0]!.target;
    const initial = beginKeyboardInteraction(target, 'move', options)!;
    const shifted = adjustKeyboardInteraction(initial, 'right', options);
    const moved = adjustKeyboardInteraction(shifted, 'down', options);

    expect(initial).toMatchObject({
      intent: { delta: 0, destination: { laneId: 'lane-a' }, start: 100 },
      mode: 'move',
      preview: { kind: 'move', x: 100, y: 18 },
    });
    expect(moved).toMatchObject({
      intent: {
        delta: 100,
        destination: { laneId: 'lane-b' },
        end: 400,
        start: 200,
      },
      preview: { x: 200, y: 78 },
    });
    expect(Object.isFrozen(moved)).toBe(true);
  });

  it('adjusts either resize edge without allowing a non-positive interval', () => {
    const options = fixture();
    const target = options.index.tasks[0]!.target;
    const start = beginKeyboardInteraction(target, 'resize-start', options)!;
    const narrowed = adjustKeyboardInteraction(start, 'right', options);
    const blocked = adjustKeyboardInteraction(narrowed, 'right', options);
    const end = beginKeyboardInteraction(target, 'resize-end', options)!;
    const extended = adjustKeyboardInteraction(end, 'right', options);

    expect(narrowed.intent).toMatchObject({ edge: 'start', start: 200, end: 300 });
    expect(blocked).toBe(narrowed);
    expect(adjustKeyboardInteraction(start, 'up', options)).toBe(start);
    expect(extended.intent).toMatchObject({ edge: 'end', start: 100, end: 400 });
  });

  it('creates in the focused task lane at its snapped viewport time', () => {
    const options = fixture();
    const intent = keyboardCreationIntent(options.index.tasks[0]!.target, options);

    expect(intent).toEqual({
      destination: expect.objectContaining({ laneId: 'lane-a' }),
      end: 300,
      kind: 'create',
      start: 100,
    });
    expect(
      keyboardCreationIntent(
        {
          kind: 'task',
          laneViewKey: 'missing',
          taskId: 'task-a',
          viewKey: 'missing',
        },
        options,
      ),
    ).toBeUndefined();
  });

  it('adjusts progress by one or ten percentage points and supports boundaries', () => {
    const options = fixture();
    const target = options.index.tasks[0]!.target;
    const initial = beginKeyboardInteraction(target, 'progress', options)!;
    const normal = adjustKeyboardInteraction(initial, 'right', options);
    const accelerated = adjustKeyboardInteraction(normal, 'up', options, {
      accelerated: true,
    });
    const home = adjustKeyboardInteraction(accelerated, 'left', options, {
      boundary: 'start',
    });
    const end = adjustKeyboardInteraction(home, 'right', options, { boundary: 'end' });

    expect(initial).toMatchObject({
      intent: { kind: 'progress', value: 0.25 },
      preview: { progress: 0.25, width: 50 },
    });
    expect(normal.intent).toMatchObject({ value: 0.26 });
    expect(accelerated).toMatchObject({
      intent: { value: 0.36 },
      preview: { description: 'Set Task A progress to 36%.' },
    });
    expect(home.intent).toMatchObject({ value: 0 });
    expect(end.intent).toMatchObject({ value: 1 });
    expect(adjustKeyboardInteraction(end, 'right', options)).toBe(end);
  });
});

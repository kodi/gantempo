import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { ChartScene } from '../render/primitives';
import { createInteractionHitTestIndex } from './hit-test';
import {
  IDLE_INTERACTION_GESTURE,
  interactionTimeAtPoint,
  reduceInteractionGesture,
} from './gesture';
import type { InteractionGestureOptions, InteractionGestureState } from './types';

function fixture(): {
  readonly document: GanttDocument;
  readonly options: InteractionGestureOptions;
} {
  const document: GanttDocument = {
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        title: 'Task A',
        segments: [],
        schedule: { mode: 'instant', start: 100, end: 300 },
      },
    ],
    resources: [],
    lanes: [
      { id: 'lane-a', title: 'Lane A' },
      { id: 'lane-b', title: 'Lane B' },
    ],
    assignments: [],
    placements: [{ id: 'placement-a', taskId: 'task-a', laneId: 'lane-a' }],
    dependencies: [],
  };
  const scene: ChartScene = {
    range: { start: 0, end: 1_000 },
    bounds: {
      headerHeight: 40,
      laneColumnWidth: 160,
      defaultLaneHeight: 60,
      timelineHeight: 120,
      totalHeight: 160,
    },
    ticks: [],
    gridLines: [],
    lanes: [
      {
        viewKey: 'lane-a-view',
        laneId: 'lane-a',
        source: { kind: 'document-lane', laneId: 'lane-a' },
        title: 'Lane A',
        y: 0,
        height: 60,
      },
      {
        viewKey: 'lane-b-view',
        laneId: 'lane-b',
        source: { kind: 'document-lane', laneId: 'lane-b' },
        title: 'Lane B',
        y: 60,
        height: 60,
      },
    ],
    taskBars: [
      {
        viewKey: 'task-a-view',
        laneViewKey: 'lane-a-view',
        placementId: 'placement-a',
        taskId: 'task-a',
        laneId: 'lane-a',
        source: {
          kind: 'document-placement',
          placementId: 'placement-a',
          laneId: 'lane-a',
        },
        title: 'Task A',
        start: 100,
        end: 300,
        x: 0.1,
        width: 0.2,
        y: 18,
        height: 24,
        clippedStart: false,
        clippedEnd: false,
      },
    ],
    diagnostics: [],
  };
  return {
    document,
    options: {
      index: createInteractionHitTestIndex(scene, {
        x: 0,
        y: 0,
        width: 1_000,
        height: 120,
        verticalStart: 0,
      }),
      snap: { anchor: 0, step: 100 },
    },
  };
}

function event(
  state: InteractionGestureState,
  input: Parameters<typeof reduceInteractionGesture>[1],
  options: InteractionGestureOptions,
) {
  return reduceInteractionGesture(state, input, options);
}

describe('pure interaction gesture state', () => {
  it('holds below threshold, previews a cross-lane move, and commits immutably', () => {
    const { document, options } = fixture();
    const documentSnapshot = structuredClone(document);
    let state = event(
      IDLE_INTERACTION_GESTURE,
      { type: 'press', pointerId: 1, pointerType: 'mouse', point: { x: 200, y: 30 } },
      options,
    );
    state = event(state, { type: 'move', pointerId: 1, point: { x: 203, y: 31 } }, options);
    expect(state.status).toBe('pressed');
    state = event(state, { type: 'move', pointerId: 1, point: { x: 300, y: 90 } }, options);

    expect(state).toMatchObject({
      status: 'active',
      intent: {
        kind: 'move',
        source: { taskId: 'task-a' },
        destination: { laneId: 'lane-b' },
        start: 200,
        end: 400,
        delta: 100,
      },
      preview: {
        kind: 'move',
        start: 200,
        end: 400,
        x: 200,
        y: 78,
        width: 200,
      },
    });
    expect(Object.isFrozen(state)).toBe(true);
    state = event(state, { type: 'release', pointerId: 1 }, options);
    expect(state).toMatchObject({ status: 'committed', intent: { kind: 'move' } });
    expect(document).toEqual(documentSnapshot);
  });

  it('supports resize and empty-lane creation previews through the same snap policy', () => {
    const { options } = fixture();
    let resize = event(
      IDLE_INTERACTION_GESTURE,
      { type: 'press', pointerId: 2, pointerType: 'pen', point: { x: 100, y: 30 } },
      options,
    );
    resize = event(resize, { type: 'move', pointerId: 2, point: { x: 200, y: 30 } }, options);
    expect(resize).toMatchObject({
      status: 'active',
      intent: { kind: 'resize', edge: 'start', time: 200, start: 200, end: 300 },
      preview: { x: 200, width: 100 },
    });

    let create = event(
      IDLE_INTERACTION_GESTURE,
      { type: 'press', pointerId: 3, pointerType: 'mouse', point: { x: 500, y: 90 } },
      options,
    );
    create = event(create, { type: 'move', pointerId: 3, point: { x: 600, y: 90 } }, options);
    expect(create).toMatchObject({
      status: 'active',
      intent: {
        kind: 'create',
        destination: { laneId: 'lane-b' },
        start: 600,
        end: 700,
      },
      preview: { kind: 'create', x: 600, width: 100 },
    });
    expect(interactionTimeAtPoint(options, { x: 650, y: 90 })).toBe(700);
  });

  it('cancels short presses, ignores other pointers, and restarts after cancel', () => {
    const { options } = fixture();
    let state = event(
      IDLE_INTERACTION_GESTURE,
      { type: 'press', pointerId: 4, pointerType: 'touch', point: { x: 200, y: 30 } },
      options,
    );
    const same = event(state, { type: 'move', pointerId: 99, point: { x: 500, y: 90 } }, options);
    expect(same).toBe(state);
    state = event(state, { type: 'release', pointerId: 4 }, options);
    expect(state).toEqual({ reason: 'threshold-not-met', status: 'cancelled' });

    state = event(
      state,
      { type: 'press', pointerId: 5, pointerType: 'mouse', point: { x: 200, y: 30 } },
      options,
    );
    state = event(state, { type: 'cancel' }, options);
    expect(state).toEqual({ reason: 'cancelled', status: 'cancelled' });
    expect(event(state, { type: 'reset' }, options)).toBe(IDLE_INTERACTION_GESTURE);
  });
});

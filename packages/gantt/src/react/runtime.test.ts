import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { createGanttReactRuntime } from './runtime';
import type { GanttProps } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function documentFixture(title = 'Task A'): GanttDocument {
  return {
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        title,
        segments: [],
        schedule: { mode: 'instant', start: START + DAY, end: START + 2 * DAY },
      },
    ],
    resources: [],
    lanes: [{ id: 'lane-a', title: 'Lane A' }],
    assignments: [],
    placements: [{ id: 'placement-a', taskId: 'task-a', laneId: 'lane-a' }],
    dependencies: [],
  };
}

function navigationDocumentFixture(): GanttDocument {
  return {
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        title: 'Task A',
        segments: [],
        schedule: { mode: 'instant', start: START + DAY, end: START + 2 * DAY },
      },
      {
        id: 'task-b',
        kind: 'task',
        title: 'Task B',
        segments: [],
        schedule: { mode: 'instant', start: START + 20 * DAY, end: START + 22 * DAY },
      },
    ],
    resources: [],
    lanes: [
      { id: 'lane-a', title: 'Lane A' },
      { id: 'lane-1', title: 'Lane 1' },
      { id: 'lane-2', title: 'Lane 2' },
      { id: 'lane-3', title: 'Lane 3' },
      { id: 'lane-b', title: 'Lane B' },
    ],
    assignments: [],
    placements: [
      { id: 'placement-a', taskId: 'task-a', laneId: 'lane-a' },
      { id: 'placement-b', taskId: 'task-b', laneId: 'lane-b' },
    ],
    dependencies: [],
  };
}

function commonProps() {
  return {
    range: { start: START, end: START + 7 * DAY },
    tickAnchor: START,
    tickInterval: DAY,
    timeZone: 'UTC',
  } as const;
}

describe('React runtime adapter', () => {
  it('adopts uncontrolled commands before immutable change and commit callbacks', async () => {
    const order: string[] = [];
    let runtime!: ReturnType<typeof createGanttReactRuntime>;
    const props: GanttProps = {
      ...commonProps(),
      defaultDocument: documentFixture(),
      onDocumentChange(change) {
        order.push(`change:${runtime.getHandle().getDocument().tasks[0]?.title}`);
        expect(Object.isFrozen(change)).toBe(true);
      },
      onCommandCommitted() {
        order.push(`commit:${runtime.getHandle().getDocument().tasks[0]?.title}`);
      },
    };
    runtime = createGanttReactRuntime(props);
    runtime.activate();
    const beforeScene = runtime.getSnapshot().scene;

    const result = await runtime.getHandle().dispatch({
      type: 'task.update',
      id: 'task-a',
      changes: { title: 'Updated' },
    });

    expect(result.status).toBe('committed');
    expect(runtime.getHandle().getDocument().tasks[0]?.title).toBe('Updated');
    expect(runtime.getSnapshot().scene.taskBars[0]?.title).toBe('Updated');
    expect(runtime.getSnapshot().scene).not.toBe(beforeScene);
    expect(order).toEqual(['change:Updated', 'commit:Updated']);
    runtime.dispose();
  });

  it('keeps controlled props authoritative until exact reconciliation', async () => {
    const base = documentFixture();
    const events: string[] = [];
    let candidate: GanttDocument | undefined;
    const initial: GanttProps = {
      ...commonProps(),
      document: base,
      onDocumentChange(change) {
        candidate = change.document;
        events.push('candidate');
      },
      onCommandCommitted() {
        events.push('committed');
      },
    };
    const runtime = createGanttReactRuntime(initial);
    runtime.activate();

    const result = await runtime.getHandle().dispatch({
      type: 'task.update',
      id: 'task-a',
      changes: { title: 'Proposed' },
    });
    expect(result.status).toBe('proposed');
    expect(runtime.getHandle().getDocument().tasks[0]?.title).toBe('Task A');
    expect(events).toEqual(['candidate']);

    runtime.updateCallbacks({ ...initial, document: candidate! });
    runtime.reconcile({ ...initial, document: candidate! });
    expect(runtime.getHandle().getDocument().tasks[0]?.title).toBe('Proposed');
    expect(events).toEqual(['candidate', 'committed']);
    runtime.dispose();
  });

  it('keeps controlled rendering read-only until a change callback is supplied', async () => {
    const props: GanttProps = { ...commonProps(), document: documentFixture() };
    const runtime = createGanttReactRuntime(props);
    runtime.activate();

    expect(
      await runtime.getHandle().dispatch({
        type: 'task.update',
        id: 'task-a',
        changes: { title: 'Blocked' },
      }),
    ).toMatchObject({
      status: 'rejected',
      diagnostics: [{ code: 'runtime.read-only' }],
    });

    let proposed = false;
    const writable: GanttProps = {
      ...props,
      onDocumentChange() {
        proposed = true;
      },
    };
    runtime.updateCallbacks(writable);
    runtime.reconcile(writable);
    expect(
      await runtime.getHandle().dispatch({
        type: 'task.update',
        id: 'task-a',
        changes: { title: 'Allowed' },
      }),
    ).toMatchObject({ status: 'proposed' });
    expect(proposed).toBe(true);
    runtime.dispose();
  });

  it('supports occurrence-aware focus, scrolling, range requests, and independent instances', () => {
    const sessions: number[] = [];
    const ranges: GanttDocument['tasks'][number]['schedule'][] = [];
    const first = createGanttReactRuntime({
      ...commonProps(),
      defaultDocument: documentFixture('First'),
      onSessionChange(session) {
        sessions.push(session.viewport.verticalStart);
      },
      onRangeChange(range) {
        ranges.push({ mode: 'instant', start: range.start, end: range.end });
      },
    });
    const second = createGanttReactRuntime({
      ...commonProps(),
      defaultDocument: documentFixture('Second'),
    });
    first.activate();
    second.activate();
    const target = first.getSnapshot().selector.occurrences[0]!.target;

    expect(first.getHandle().focusTask(target)).toBe(true);
    expect(first.getHandle().getSession().focused?.viewKey).toBe(target.viewKey);
    expect(first.getHandle().scrollToTask(target, { align: 'start' })).toBe(true);
    expect(first.getHandle().scrollToTime(START + 10 * DAY, { align: 'start' })).toBe(true);
    expect(ranges[0]).toEqual({
      mode: 'instant',
      start: START + 10 * DAY,
      end: START + 17 * DAY,
    });
    expect(first.getHandle().getDocument().tasks[0]?.title).toBe('First');
    expect(second.getHandle().getDocument().tasks[0]?.title).toBe('Second');
    expect(sessions.length).toBeGreaterThan(0);
    first.dispose();
    second.dispose();
  });

  it('retains offscreen session targets and reveals a known full-catalog occurrence', async () => {
    const ranges: { readonly end: number; readonly start: number }[] = [];
    const props: GanttProps = {
      ...commonProps(),
      defaultDocument: navigationDocumentFixture(),
      onRangeChange(range) {
        ranges.push(range);
      },
    };
    const runtime = createGanttReactRuntime(props);
    runtime.activate();
    runtime.measure({ clientHeight: 58, clientWidth: 700, verticalStart: 0 });
    const firstTarget = runtime.getSnapshot().selector.occurrences[0]!.target;
    const geometry = {
      height: 58,
      verticalStart: 0,
      width: 700,
      x: 160,
      y: 0,
    };

    expect(runtime.getSnapshot().occurrenceCatalog).toHaveLength(2);
    expect(runtime.getHandle().focusTask(firstTarget)).toBe(true);
    expect(
      runtime.keyboardAction({
        action: { type: 'toggle-selection' },
        geometry,
      }),
    ).toBe(true);
    runtime.measure({ clientHeight: 58, clientWidth: 700, verticalStart: 232 });
    expect(runtime.getSnapshot().selector.occurrences).toEqual([]);
    expect(runtime.getHandle().getSession()).toMatchObject({
      focused: { viewKey: firstTarget.viewKey },
      selection: [{ viewKey: firstTarget.viewKey }],
    });

    const offscreen = runtime
      .getSnapshot()
      .occurrenceCatalog.find((occurrence) => occurrence.taskId === 'task-b')!;
    const offscreenTarget = {
      kind: 'task' as const,
      laneViewKey: offscreen.laneViewKey,
      ...(offscreen.laneId === undefined ? {} : { laneId: offscreen.laneId }),
      ...(offscreen.placementId === undefined ? {} : { placementId: offscreen.placementId }),
      taskId: offscreen.taskId,
      viewKey: offscreen.viewKey,
    };
    expect(runtime.getHandle().scrollToTask(offscreenTarget, { align: 'start' })).toBe(true);
    expect(ranges).toEqual([
      {
        start: START + 20 * DAY,
        end: START + 27 * DAY,
      },
    ]);
    expect(runtime.getHandle().getSession().viewport.verticalStart).toBe(232);

    await runtime.getHandle().dispatch({
      type: 'task.delete',
      id: 'task-a',
      cascade: true,
    });
    expect(runtime.getHandle().getSession().selection).toEqual([]);
    expect(runtime.getHandle().getSession().focused?.viewKey).toBe(offscreenTarget.viewKey);
    runtime.dispose();
  });

  it('rejects an offscreen task reveal atomically when horizontal range cannot be acknowledged', () => {
    const runtime = createGanttReactRuntime({
      ...commonProps(),
      defaultDocument: navigationDocumentFixture(),
    });
    runtime.activate();
    runtime.measure({ clientHeight: 58, clientWidth: 700, verticalStart: 0 });
    const offscreen = runtime
      .getSnapshot()
      .occurrenceCatalog.find((occurrence) => occurrence.taskId === 'task-b')!;

    expect(
      runtime.getHandle().scrollToTask({
        kind: 'task',
        laneViewKey: offscreen.laneViewKey,
        ...(offscreen.laneId === undefined ? {} : { laneId: offscreen.laneId }),
        ...(offscreen.placementId === undefined ? {} : { placementId: offscreen.placementId }),
        taskId: offscreen.taskId,
        viewKey: offscreen.viewKey,
      }),
    ).toBe(false);
    expect(runtime.getHandle().getSession().viewport.verticalStart).toBe(0);
    expect(
      runtime.getHandle().scrollToTask({
        kind: 'task',
        laneViewKey: 'missing-lane',
        taskId: 'missing-task',
        viewKey: 'missing-occurrence',
      }),
    ).toBe(false);
    runtime.dispose();
  });

  it('reports controlled session proposals through semantic observation callbacks', () => {
    const events: string[] = [];
    let proposal: Parameters<NonNullable<GanttProps['onSessionChange']>>[0] | undefined;
    const props: GanttProps = {
      ...commonProps(),
      document: documentFixture(),
      session: { selection: [], viewport: { verticalStart: 0 } },
      onFocusChange(_focused, event) {
        events.push(`focus:${event.source}`);
      },
      onSessionChange(session, event) {
        proposal = session;
        events.push(`session:${event.source}`);
      },
    };
    const runtime = createGanttReactRuntime(props);
    runtime.activate();
    const target = runtime.getSnapshot().selector.occurrences[0]!.target;

    expect(runtime.getHandle().focusTask(target)).toBe(true);
    expect(runtime.getHandle().getSession().focused).toBeUndefined();
    expect(events).toEqual(['session:imperative']);
    runtime.updateCallbacks({ ...props, session: proposal! });
    runtime.reconcile({ ...props, session: proposal! });
    expect(events).toEqual([
      'session:imperative',
      'session:controlled-prop',
      'focus:controlled-prop',
    ]);
    runtime.dispose();
  });

  it('coalesces numeric measurement and cancels a scheduled frame on disposal', () => {
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    const frames = new Map<number, FrameRequestCallback>();
    const cancelled: number[] = [];
    let nextFrame = 1;
    globalThis.requestAnimationFrame = (callback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      frames.delete(id);
      cancelled.push(id);
    };
    try {
      const runtime = createGanttReactRuntime({
        ...commonProps(),
        defaultDocument: documentFixture(),
      });
      runtime.activate();
      runtime.measure({ clientHeight: 100, clientWidth: 700, verticalStart: 10 });
      runtime.measure({ clientHeight: 120, clientWidth: 900, verticalStart: 20 });
      expect(frames).toHaveLength(1);
      expect(runtime.getSnapshot().selector.viewport.status).toBe('unmeasured');
      const [frameId, frame] = [...frames][0]!;
      frames.delete(frameId);
      frame(0);
      expect(runtime.getSnapshot().selector.viewport).toMatchObject({
        status: 'measured',
        clientHeight: 120,
        clientWidth: 900,
        verticalStart: 20,
      });

      runtime.measure({ clientHeight: 80, clientWidth: 600, verticalStart: 5 });
      runtime.dispose();
      expect(cancelled).toContain(2);
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it('does not rebuild the scene for callback identity-only reconciliation', () => {
    const initial: GanttProps = {
      ...commonProps(),
      document: documentFixture(),
      onDiagnostics() {},
    };
    const runtime = createGanttReactRuntime(initial);
    const scene = runtime.getSnapshot().scene;
    const next = { ...initial, onDiagnostics() {} };

    runtime.updateCallbacks(next);
    runtime.reconcile(next);
    expect(runtime.getSnapshot().scene).toBe(scene);
    runtime.dispose();
  });

  it('does not restore pending preview after a synchronous controlled acknowledgement', async () => {
    let runtime!: ReturnType<typeof createGanttReactRuntime>;
    let props!: Extract<GanttProps, { readonly document: GanttDocument }>;
    props = {
      ...commonProps(),
      document: documentFixture(),
      onDocumentChange(change) {
        props = { ...props, document: change.document };
        runtime.updateCallbacks(props);
        runtime.reconcile(props);
      },
    };
    runtime = createGanttReactRuntime(props);
    runtime.activate();
    const geometry = {
      height: 58,
      verticalStart: 0,
      width: 700,
      x: 160,
      y: 0,
    };

    expect(
      runtime.pointerDown({
        geometry,
        point: { x: 310, y: 29 },
        pointerId: 1,
        pointerType: 'mouse',
      }),
    ).toBe(true);
    expect(
      runtime.pointerMove({
        geometry,
        point: { x: 410, y: 29 },
        pointerId: 1,
      }),
    ).toBe(true);
    await runtime.pointerUp(1);

    expect(runtime.getSnapshot().selector.interaction).toMatchObject({ status: 'idle' });
    expect(runtime.getHandle().getDocument().tasks[0]?.schedule).toMatchObject({
      start: START + 2 * DAY,
    });
    runtime.dispose();
  });
});

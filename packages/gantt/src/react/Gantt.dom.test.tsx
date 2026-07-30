// @vitest-environment jsdom

import { act, createRef, StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { GanttCommandInterception } from '../runtime/types';
import { Gantt } from './Gantt';
import type { GanttHandle, GanttProps } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const roots: Root[] = [];

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

function multiLaneDocument(laneCount = 2): GanttDocument {
  const lanes = Array.from({ length: laneCount }, (_, index) => ({
    id: `lane-${index}`,
    title: `Lane ${index}`,
  }));
  return {
    ...documentFixture(),
    lanes,
    placements: [{ id: 'placement-a', taskId: 'task-a', laneId: lanes[0]!.id }],
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

function container(): HTMLDivElement {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}

async function render(element: ReactNode): Promise<{
  readonly container: HTMLDivElement;
  readonly root: Root;
}> {
  const host = container();
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return { container: host, root };
}

function installPointerGeometry(
  host: HTMLDivElement,
  options: { readonly height?: number; readonly width?: number } = {},
): {
  readonly body: HTMLDivElement;
  readonly captured: number[];
  readonly timeline: HTMLDivElement;
} {
  const body = host.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = host.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
  const width = options.width ?? 700;
  const height = options.height ?? Math.min(116, body.scrollHeight || 116);
  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: height },
    clientWidth: { configurable: true, value: width + 160 },
  });
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: width });
  body.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width + 160,
      top: 0,
      width: width + 160,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  timeline.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 160,
      right: width + 160,
      top: 0,
      width,
      x: 160,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  const captured: number[] = [];
  const captures = new Set<number>();
  timeline.setPointerCapture = (pointerId) => {
    captured.push(pointerId);
    captures.add(pointerId);
  };
  timeline.hasPointerCapture = (pointerId) => captures.has(pointerId);
  timeline.releasePointerCapture = (pointerId) => {
    captures.delete(pointerId);
  };
  return { body, captured, timeline };
}

function dispatchPointer(
  target: Element,
  type: 'lostpointercapture' | 'pointercancel' | 'pointerdown' | 'pointermove' | 'pointerup',
  input: {
    readonly button?: number;
    readonly clientX: number;
    readonly clientY: number;
    readonly isPrimary?: boolean;
    readonly pointerId: number;
    readonly pointerType: 'mouse' | 'pen' | 'touch';
  },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: input.button ?? 0,
    cancelable: true,
    clientX: input.clientX,
    clientY: input.clientY,
  });
  Object.defineProperties(event, {
    isPrimary: { value: input.isPrimary ?? true },
    pointerId: { value: input.pointerId },
    pointerType: { value: input.pointerType },
  });
  target.dispatchEvent(event);
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) {
      root.unmount();
    }
  });
  document.body.replaceChildren();
});

describe('Gantt React facade in a DOM environment', () => {
  it('mounts one uncontrolled runtime and updates DOM through the imperative command path', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <Gantt {...commonProps()} defaultDocument={documentFixture()} ref={ref} />,
    );

    expect(mounted.container.querySelector('[data-task-id="task-a"]')?.textContent).toContain(
      'Task A',
    );
    await act(async () => {
      await ref.current?.dispatch({
        type: 'task.update',
        id: 'task-a',
        changes: { title: 'Updated through runtime' },
      });
    });
    expect(ref.current?.getDocument().tasks[0]?.title).toBe('Updated through runtime');
    expect(mounted.container.querySelector('[data-task-id="task-a"]')?.textContent).toContain(
      'Updated through runtime',
    );
  });

  it('acknowledges controlled candidates before commit observation', async () => {
    const ref = createRef<GanttHandle>();
    let document = documentFixture();
    const order: string[] = [];
    const props: GanttProps = {
      ...commonProps(),
      document,
      onDocumentChange(change) {
        order.push('candidate');
        document = change.document;
      },
      onCommandCommitted() {
        order.push('committed');
      },
    };
    const mounted = await render(<Gantt {...props} ref={ref} />);

    await act(async () => {
      await ref.current?.dispatch({
        type: 'task.update',
        id: 'task-a',
        changes: { title: 'Controlled update' },
      });
    });
    expect(order).toEqual(['candidate']);
    await act(async () => {
      mounted.root.render(<Gantt {...props} document={document} ref={ref} />);
    });

    expect(ref.current?.getDocument().tasks[0]?.title).toBe('Controlled update');
    expect(order).toEqual(['candidate', 'committed']);
  });

  it('updates selected/focused task state through isolated runtime selectors', async () => {
    const base: GanttProps = {
      ...commonProps(),
      document: documentFixture(),
      session: { selection: [], viewport: { verticalStart: 0 } },
    };
    const mounted = await render(<Gantt {...base} />);
    const task = mounted.container.querySelector<SVGGElement>('[data-task-id="task-a"]')!;
    const target = {
      kind: 'task' as const,
      laneId: task.dataset.laneId!,
      laneViewKey: task.dataset.laneViewKey!,
      placementId: task.dataset.placementId!,
      taskId: task.dataset.taskId!,
      viewKey: task.dataset.viewKey!,
    };

    await act(async () => {
      mounted.root.render(
        <Gantt
          {...base}
          session={{ focused: target, selection: [target], viewport: { verticalStart: 0 } }}
        />,
      );
    });
    const updated = mounted.container.querySelector('[data-task-id="task-a"]');
    expect(updated?.getAttribute('data-selected')).toBe('true');
    expect(updated?.getAttribute('data-focused')).toBe('true');
    expect(
      mounted.container.querySelector('[data-gt-part="root"]')?.getAttribute('data-disabled'),
    ).toBe('true');
  });

  it('keeps two mounted instances and imperative refs independent', async () => {
    const first = createRef<GanttHandle>();
    const second = createRef<GanttHandle>();
    const mounted = await render(
      <>
        <Gantt {...commonProps()} defaultDocument={documentFixture('First')} ref={first} />
        <Gantt {...commonProps()} defaultDocument={documentFixture('Second')} ref={second} />
      </>,
    );

    await act(async () => {
      await first.current?.dispatch({
        type: 'task.update',
        id: 'task-a',
        changes: { title: 'Changed first' },
      });
    });
    expect(first.current?.getDocument().tasks[0]?.title).toBe('Changed first');
    expect(second.current?.getDocument().tasks[0]?.title).toBe('Second');
    expect(mounted.container.querySelectorAll('[data-gantempo]')).toHaveLength(2);
  });

  it('retains the instance runtime through the Strict Mode effect replay', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <StrictMode>
        <Gantt {...commonProps()} defaultDocument={documentFixture()} ref={ref} />
      </StrictMode>,
    );

    await act(async () => {
      await ref.current?.dispatch({
        type: 'task.update',
        id: 'task-a',
        changes: { title: 'Strict update' },
      });
    });
    expect(mounted.container.querySelector('[data-task-id="task-a"]')?.textContent).toContain(
      'Strict update',
    );
  });

  it('hydrates deterministic pre-measurement markup without mismatch', async () => {
    const props: GanttProps = { ...commonProps(), document: documentFixture() };
    const markup = renderToString(<Gantt {...props} />);
    const host = container();
    host.innerHTML = markup;
    const errors: unknown[] = [];
    let root!: ReturnType<typeof hydrateRoot>;

    await act(async () => {
      root = hydrateRoot(host, <Gantt {...props} />, {
        onRecoverableError(error) {
          errors.push(error);
        },
      });
    });
    roots.push(root);
    expect(errors).toEqual([]);
    expect(host.querySelector('[data-task-id="task-a"]')?.textContent).toContain('Task A');
    expect(host.querySelector('[data-gt-part="live-region"]')?.getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('disconnects measurement observers and cancels queued frames on unmount', async () => {
    const originalObserver = globalThis.ResizeObserver;
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    let disconnected = 0;
    let frame = 0;
    const cancelled: number[] = [];
    class Observer {
      observe() {}
      disconnect() {
        disconnected += 1;
      }
      unobserve() {}
    }
    globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
    globalThis.requestAnimationFrame = () => {
      frame += 1;
      return frame;
    };
    globalThis.cancelAnimationFrame = (id) => {
      cancelled.push(id);
    };
    try {
      const mounted = await render(
        <Gantt {...commonProps()} defaultDocument={documentFixture()} />,
      );
      const viewport = mounted.container.querySelector('[data-gt-part="viewport"]')!;
      viewport.dispatchEvent(new Event('scroll'));
      await act(async () => {
        mounted.root.unmount();
      });
      roots.splice(roots.indexOf(mounted.root), 1);
      expect(disconnected).toBe(1);
      expect(cancelled.length).toBeGreaterThan(0);
    } finally {
      globalThis.ResizeObserver = originalObserver;
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it('selects, focuses, captures, and activates a task through delegated mouse events', async () => {
    const activated: string[] = [];
    const events: string[] = [];
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        onFocusChange={() => events.push('focus')}
        onSelectionChange={() => events.push('selection')}
        onSessionChange={() => events.push('session')}
        onTaskActivate={(target) => {
          activated.push(target.taskId);
          events.push('activate');
        }}
        ref={ref}
      />,
    );
    const { captured, timeline } = installPointerGeometry(mounted.container);
    const task = mounted.container.querySelector('[data-task-id="task-a"]')!;

    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        pointerId: 1,
        pointerType: 'mouse',
      });
    });
    expect(captured).toEqual([1]);
    expect(ref.current?.getSelection()[0]).toMatchObject({ taskId: 'task-a' });
    expect(task.getAttribute('data-selected')).toBe('true');
    expect(task.getAttribute('data-pressing')).toBe('true');
    expect(events).toEqual(['session', 'selection', 'focus']);

    await act(async () => {
      dispatchPointer(timeline, 'pointerup', {
        clientX: 310,
        clientY: 29,
        pointerId: 1,
        pointerType: 'mouse',
      });
    });
    expect(activated).toEqual(['task-a']);
    expect(events).toEqual(['session', 'selection', 'focus', 'activate']);
    expect(mounted.container.querySelector('[data-gt-part="live-region"]')?.textContent).toContain(
      'Task A activated',
    );
  });

  it('clears task selection and focus from an empty primary timeline press', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <Gantt {...commonProps()} defaultDocument={documentFixture()} ref={ref} />,
    );
    const { timeline } = installPointerGeometry(mounted.container);
    const task = mounted.container.querySelector<SVGGElement>('[data-task-id="task-a"]')!;

    await act(async () => {
      task.focus();
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        pointerId: 21,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointerup', {
        clientX: 310,
        clientY: 29,
        pointerId: 21,
        pointerType: 'mouse',
      });
    });
    expect(ref.current?.getSelection()).toHaveLength(1);
    expect(ref.current?.getSession().focused).toMatchObject({ taskId: 'task-a' });
    expect(document.activeElement).toBe(task);

    await act(async () => {
      dispatchPointer(timeline, 'pointerdown', {
        clientX: 710,
        clientY: 29,
        pointerId: 22,
        pointerType: 'mouse',
      });
    });
    expect(ref.current?.getSelection()).toEqual([]);
    expect(ref.current?.getSession().focused).toBeUndefined();
    expect(task.getAttribute('data-selected')).toBeNull();
    expect(document.activeElement).not.toBe(task);
  });

  it('clears stale DOM and runtime focus from an empty press in a read-only chart', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <Gantt {...commonProps()} document={documentFixture()} ref={ref} />,
    );
    const { timeline } = installPointerGeometry(mounted.container);
    const task = mounted.container.querySelector<SVGGElement>('[data-task-id="task-a"]')!;

    await act(async () => task.focus());
    expect(ref.current?.getSession().focused).toMatchObject({ taskId: 'task-a' });
    expect(document.activeElement).toBe(task);

    await act(async () => {
      dispatchPointer(timeline, 'pointerdown', {
        clientX: 710,
        clientY: 29,
        pointerId: 23,
        pointerType: 'mouse',
      });
    });
    expect(ref.current?.getSession().focused).toBeUndefined();
    expect(document.activeElement).not.toBe(task);
    expect(
      mounted.container.querySelector('[data-gt-part="root"]')?.getAttribute('data-disabled'),
    ).toBe('true');
  });

  it.each(['mouse', 'pen', 'touch'] as const)(
    'moves a task through the shared %s pointer command path',
    async (pointerType) => {
      const ref = createRef<GanttHandle>();
      const sources: string[] = [];
      const mounted = await render(
        <Gantt
          {...commonProps()}
          defaultDocument={documentFixture()}
          onDocumentChange={(change) => sources.push(change.source.kind)}
          ref={ref}
        />,
      );
      const { timeline } = installPointerGeometry(mounted.container);
      const task = mounted.container.querySelector('[data-task-id="task-a"]')!;

      await act(async () => {
        dispatchPointer(task, 'pointerdown', {
          clientX: 310,
          clientY: 29,
          pointerId: 2,
          pointerType,
        });
        dispatchPointer(timeline, 'pointermove', {
          clientX: 410,
          clientY: 29,
          pointerId: 2,
          pointerType,
        });
      });
      expect(
        mounted.container.querySelector('[data-gt-part="interaction-preview"]'),
      ).not.toBeNull();
      expect(task.getAttribute('data-dragging')).toBe('true');

      await act(async () => {
        dispatchPointer(timeline, 'pointerup', {
          clientX: 410,
          clientY: 29,
          pointerId: 2,
          pointerType,
        });
      });
      expect(ref.current?.getDocument().tasks[0]?.schedule).toMatchObject({
        start: START + 2 * DAY,
        end: START + 3 * DAY,
      });
      expect(sources).toEqual(['pointer']);
      expect(mounted.container.querySelector('[data-gt-part="interaction-preview"]')).toBeNull();
    },
  );

  it('resizes by an edge, moves a persisted placement, and maps empty-lane creation', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <Gantt
        {...commonProps()}
        defaultDocument={multiLaneDocument()}
        interactionMappers={{
          createTask(intent) {
            return {
              command: {
                commands: [
                  {
                    type: 'task.add',
                    value: {
                      id: 'created',
                      title: 'Created',
                      schedule: { mode: 'instant', start: intent.start, end: intent.end },
                    },
                  },
                  {
                    type: 'placement.add',
                    value: {
                      id: 'created-placement',
                      laneId: intent.destination.laneId!,
                      taskId: 'created',
                    },
                  },
                ],
                type: 'transaction',
              },
              status: 'mapped',
            };
          },
        }}
        ref={ref}
      />,
    );
    const { timeline } = installPointerGeometry(mounted.container, { height: 116 });
    const task = mounted.container.querySelector('[data-task-id="task-a"]')!;

    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 360,
        clientY: 29,
        pointerId: 3,
        pointerType: 'pen',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 460,
        clientY: 29,
        pointerId: 3,
        pointerType: 'pen',
      });
    });
    expect(task.getAttribute('data-resizing')).toBe('true');
    await act(async () => {
      dispatchPointer(timeline, 'pointerup', {
        clientX: 460,
        clientY: 29,
        pointerId: 3,
        pointerType: 'pen',
      });
    });
    expect(ref.current?.getDocument().tasks[0]?.schedule).toMatchObject({
      start: START + DAY,
      end: START + 3 * DAY,
    });

    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 360,
        clientY: 29,
        pointerId: 4,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 360,
        clientY: 87,
        pointerId: 4,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointerup', {
        clientX: 360,
        clientY: 87,
        pointerId: 4,
        pointerType: 'mouse',
      });
    });
    expect(ref.current?.getDocument().placements[0]?.laneId).toBe('lane-1');

    await act(async () => {
      dispatchPointer(timeline, 'pointerdown', {
        clientX: 660,
        clientY: 29,
        pointerId: 5,
        pointerType: 'touch',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 760,
        clientY: 87,
        pointerId: 5,
        pointerType: 'touch',
      });
      dispatchPointer(timeline, 'pointerup', {
        clientX: 760,
        clientY: 87,
        pointerId: 5,
        pointerType: 'touch',
      });
    });
    expect(ref.current?.getDocument().tasks.some((item) => item.id === 'created')).toBe(true);
    expect(ref.current?.getDocument().placements).toContainEqual(
      expect.objectContaining({ id: 'created-placement', laneId: 'lane-1' }),
    );
  });

  it('rejects secondary pointers, cancels capture loss, and holds async preview pending', async () => {
    let resolve!: (value: GanttCommandInterception) => void;
    const interception = new Promise<GanttCommandInterception>((accept) => {
      resolve = accept;
    });
    const ref = createRef<GanttHandle>();
    const mounted = await render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        interceptors={[() => interception]}
        ref={ref}
      />,
    );
    const { timeline } = installPointerGeometry(mounted.container);
    const task = mounted.container.querySelector('[data-task-id="task-a"]')!;

    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        pointerId: 6,
        pointerType: 'touch',
      });
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        isPrimary: false,
        pointerId: 7,
        pointerType: 'touch',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 410,
        clientY: 29,
        pointerId: 7,
        pointerType: 'touch',
      });
    });
    expect(task.getAttribute('data-dragging')).not.toBe('true');
    await act(async () => {
      dispatchPointer(timeline, 'pointercancel', {
        clientX: 310,
        clientY: 29,
        pointerId: 6,
        pointerType: 'touch',
      });
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('idle');

    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        pointerId: 10,
        pointerType: 'pen',
      });
      dispatchPointer(timeline, 'lostpointercapture', {
        clientX: 310,
        clientY: 29,
        pointerId: 10,
        pointerType: 'pen',
      });
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('idle');

    await act(async () => {
      dispatchPointer(timeline, 'pointerdown', {
        clientX: 660,
        clientY: 29,
        pointerId: 11,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 760,
        clientY: 29,
        pointerId: 11,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointerup', {
        clientX: 760,
        clientY: 29,
        pointerId: 11,
        pointerType: 'mouse',
      });
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('rejected');
    expect(mounted.container.querySelector('[data-gt-part="live-region"]')?.textContent).toContain(
      'Task creation requires an application command mapper',
    );

    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        pointerId: 8,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 410,
        clientY: 29,
        pointerId: 8,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointerup', {
        clientX: 410,
        clientY: 29,
        pointerId: 8,
        pointerType: 'mouse',
      });
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('pending');
    expect(mounted.container.querySelector('[data-gt-part="interaction-preview"]')).not.toBeNull();

    await act(async () => {
      resolve({ kind: 'allow' });
      await interception;
    });
    expect(ref.current?.getDocument().tasks[0]?.schedule).toMatchObject({
      start: START + 2 * DAY,
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('idle');
  });

  it('acknowledges a controlled pointer candidate and requests edge auto-pan', async () => {
    const ref = createRef<GanttHandle>();
    let document = multiLaneDocument(8);
    const ranges: GanttProps['range'][] = [];
    const props: GanttProps = {
      ...commonProps(),
      document,
      onDocumentChange(change) {
        document = change.document;
      },
      onRangeChange(range) {
        ranges.push(range);
      },
    };
    const mounted = await render(<Gantt {...props} ref={ref} />);
    const { body, timeline } = installPointerGeometry(mounted.container, { height: 100 });
    const task = mounted.container.querySelector('[data-task-id="task-a"]')!;

    await act(async () => {
      body.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    await act(async () => {
      dispatchPointer(task, 'pointerdown', {
        clientX: 310,
        clientY: 29,
        pointerId: 9,
        pointerType: 'mouse',
      });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 855,
        clientY: 99,
        pointerId: 9,
        pointerType: 'mouse',
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(ref.current?.getSession().viewport.verticalStart).toBeGreaterThan(0);
    expect(ranges).toHaveLength(1);
    await act(async () => {
      dispatchPointer(timeline, 'pointerup', {
        clientX: 855,
        clientY: 99,
        pointerId: 9,
        pointerType: 'mouse',
      });
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('pending');
    await act(async () => {
      mounted.root.render(<Gantt {...props} document={document} ref={ref} />);
    });
    expect(
      mounted.container
        .querySelector('[data-gt-part="root"]')
        ?.getAttribute('data-interaction-state'),
    ).toBe('idle');
  });
});

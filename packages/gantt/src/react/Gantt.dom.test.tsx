// @vitest-environment jsdom

import { act, createRef, StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
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
});

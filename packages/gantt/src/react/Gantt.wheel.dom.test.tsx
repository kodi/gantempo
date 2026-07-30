// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument, TimeRange } from '../model/types';
import { Gantt } from './Gantt';
import type { GanttProps } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const roots: Root[] = [];

function fixture(): GanttDocument {
  const lanes = Array.from({ length: 5 }, (_, index) => ({
    id: `lane-${index}`,
    title: `Lane ${index}`,
  }));
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
    ],
    resources: [],
    lanes,
    assignments: [],
    placements: [{ id: 'placement-a', taskId: 'task-a', laneId: lanes[0]!.id }],
    dependencies: [],
  };
}

function commonProps(): GanttProps {
  return {
    defaultDocument: fixture(),
    range: { start: START, end: START + 7 * DAY },
    tickAnchor: START,
    tickInterval: DAY,
    timeZone: 'UTC',
  };
}

async function render(element: ReactElement): Promise<{
  readonly container: HTMLDivElement;
  readonly root: Root;
}> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
  return { container, root };
}

function installGeometry(container: ParentNode): {
  readonly body: HTMLDivElement;
  readonly chart: HTMLDivElement;
  readonly timeline: HTMLDivElement;
} {
  const body = container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const chart = container.querySelector<HTMLDivElement>('[data-gt-part="chart"]')!;
  const timeline = container.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 290 },
  });
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: 700 });
  return { body, chart, timeline };
}

function wheel(target: Element, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function nextFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.replaceChildren();
});

describe('Gantt wheel and trackpad navigation', () => {
  it('accepts horizontal input while leaving ordinary vertical input native', async () => {
    const ranges: TimeRange[] = [];
    const mounted = await render(
      <Gantt {...commonProps()} onRangeChange={(range) => ranges.push(range)} />,
    );
    const { timeline } = installGeometry(mounted.container);

    const vertical = wheel(timeline, { deltaY: 40 });
    expect(vertical.defaultPrevented).toBe(false);
    expect(ranges).toEqual([]);

    const horizontal = wheel(timeline, { deltaX: 70 });
    expect(horizontal.defaultPrevented).toBe(true);
    await nextFrame();
    expect(ranges).toEqual([{ start: START + 0.7 * DAY, end: START + 7.7 * DAY }]);
  });

  it('preserves accepted diagonal vertical movement and supports the Shift fallback', async () => {
    const ranges: TimeRange[] = [];
    const mounted = await render(
      <Gantt {...commonProps()} onRangeChange={(range) => ranges.push(range)} />,
    );
    const { body, timeline } = installGeometry(mounted.container);
    await nextFrame();

    await act(async () => {
      const diagonal = wheel(timeline, { deltaX: 70, deltaY: 30 });
      expect(diagonal.defaultPrevented).toBe(true);
    });
    expect(body.scrollTop).toBe(30);
    await nextFrame();

    await act(async () => {
      const shifted = wheel(timeline, { deltaY: 70, shiftKey: true });
      expect(shifted.defaultPrevented).toBe(true);
    });
    expect(body.scrollTop).toBe(30);
    await nextFrame();
    expect(ranges.at(-1)).toEqual({
      start: START + 1.4 * DAY,
      end: START + 8.4 * DAY,
    });
  });

  it('normalizes line and page delta modes before semantic time conversion', async () => {
    const ranges: TimeRange[] = [];
    const mounted = await render(
      <Gantt {...commonProps()} onRangeChange={(range) => ranges.push(range)} />,
    );
    const { timeline } = installGeometry(mounted.container);

    expect(
      wheel(timeline, { deltaMode: WheelEvent.DOM_DELTA_LINE, deltaX: 2 }).defaultPrevented,
    ).toBe(true);
    await nextFrame();
    expect(ranges[0]).toEqual({
      start: START + 0.32 * DAY,
      end: START + 7.32 * DAY,
    });

    expect(
      wheel(timeline, { deltaMode: WheelEvent.DOM_DELTA_PAGE, deltaX: 1 }).defaultPrevented,
    ).toBe(true);
    await nextFrame();
    expect(ranges[1]).toEqual({
      start: START + 7.32 * DAY,
      end: START + 14.32 * DAY,
    });
  });

  it('passes browser zoom, zero input, and unacknowledgeable horizontal input through', async () => {
    const ranges: TimeRange[] = [];
    const withCallback = await render(
      <Gantt {...commonProps()} onRangeChange={(range) => ranges.push(range)} />,
    );
    const first = installGeometry(withCallback.container);
    expect(wheel(first.timeline, { ctrlKey: true, deltaX: 70 }).defaultPrevented).toBe(false);
    expect(wheel(first.timeline, { metaKey: true, deltaX: 70 }).defaultPrevented).toBe(false);
    expect(wheel(first.timeline, { deltaX: 0, deltaY: 0 }).defaultPrevented).toBe(false);
    const nonFinite = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    Object.defineProperty(nonFinite, 'deltaX', { value: Number.NaN });
    first.timeline.dispatchEvent(nonFinite);
    expect(nonFinite.defaultPrevented).toBe(false);

    const withoutCallback = await render(<Gantt {...commonProps()} />);
    const second = installGeometry(withoutCallback.container);
    expect(wheel(second.timeline, { deltaX: 70, deltaY: 30 }).defaultPrevented).toBe(false);
    expect(second.body.scrollTop).toBe(0);
    await nextFrame();
    expect(ranges).toEqual([]);
  });

  it('excludes form controls and removes its non-passive listener on unmount', async () => {
    const ranges: TimeRange[] = [];
    const mounted = await render(
      <Gantt {...commonProps()} onRangeChange={(range) => ranges.push(range)} />,
    );
    const { chart } = installGeometry(mounted.container);
    const input = document.createElement('input');
    chart.append(input);
    expect(wheel(input, { deltaX: 70 }).defaultPrevented).toBe(false);

    await act(async () => mounted.root.unmount());
    roots.splice(roots.indexOf(mounted.root), 1);
    expect(wheel(chart, { deltaX: 70 }).defaultPrevented).toBe(false);
    await nextFrame();
    expect(ranges).toEqual([]);
  });

  it('keeps two chart instances isolated', async () => {
    const first: TimeRange[] = [];
    const second: TimeRange[] = [];
    const mounted = await render(
      <div>
        <Gantt {...commonProps()} label="First" onRangeChange={(range) => first.push(range)} />
        <Gantt {...commonProps()} label="Second" onRangeChange={(range) => second.push(range)} />
      </div>,
    );
    const charts = mounted.container.querySelectorAll<HTMLElement>('[data-gt-part="root"]');
    const firstGeometry = installGeometry(charts[0]!);
    installGeometry(charts[1]!);

    expect(wheel(firstGeometry.timeline, { deltaX: 70 }).defaultPrevented).toBe(true);
    await nextFrame();
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });
});

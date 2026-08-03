// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Playground } from '../Playground';
import { ScenarioGantt } from '../ScenarioGantt';
import {
  NAVIGATION_EVENT_COUNT,
  NAVIGATION_INITIAL_RANGE,
  NAVIGATION_LANE_COUNT,
  NAVIGATION_PERIOD_END,
  NAVIGATION_PERIOD_START,
  mainScenario,
  navigationScenario,
} from '../scenarios';

const DAY = 24 * 60 * 60 * 1_000;

function installGeometry(root: HTMLElement, height = 232, width = 900): void {
  const body = root.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = root.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
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
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('navigation playground consumer', () => {
  it('publishes the deterministic 144-event, 36-lane, 18-month fixture', () => {
    const { document } = navigationScenario;
    const scheduled = document.tasks.map((task) => {
      if (task.schedule?.mode !== 'instant') {
        throw new Error(`Expected ${task.id} to have an instant schedule.`);
      }
      return { id: task.id, schedule: task.schedule };
    });
    const starts = scheduled.map((task) => task.schedule.start);
    const ends = scheduled.map((task) => task.schedule.end);

    expect(document.tasks).toHaveLength(NAVIGATION_EVENT_COUNT);
    expect(document.placements).toHaveLength(NAVIGATION_EVENT_COUNT);
    expect(document.lanes).toHaveLength(NAVIGATION_LANE_COUNT);
    expect(NAVIGATION_INITIAL_RANGE.end - NAVIGATION_INITIAL_RANGE.start).toBe(12 * 7 * DAY);
    expect(Math.min(...starts)).toBe(NAVIGATION_PERIOD_START);
    expect(Math.max(...ends)).toBe(NAVIGATION_PERIOD_END);
    expect(new Date(NAVIGATION_PERIOD_START).toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(new Date(NAVIGATION_PERIOD_END).toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(document.tasks[0]).toMatchObject({
      id: 'navigation-task-001',
      schedule: {
        end: Date.UTC(2025, 0, 7),
        start: Date.UTC(2025, 0, 1),
      },
    });
    expect(document.tasks.at(-1)).toMatchObject({
      id: 'navigation-task-144',
      schedule: {
        end: NAVIGATION_PERIOD_END,
        start: NAVIGATION_PERIOD_END - 14 * DAY,
      },
    });
    expect(scheduled.some((task) => task.schedule.end < NAVIGATION_INITIAL_RANGE.start)).toBe(true);
    expect(
      scheduled.some(
        (task) =>
          task.schedule.start < NAVIGATION_INITIAL_RANGE.end &&
          task.schedule.end > NAVIGATION_INITIAL_RANGE.start,
      ),
    ).toBe(true);
    expect(scheduled.some((task) => task.schedule.start > NAVIGATION_INITIAL_RANGE.end)).toBe(true);
    expect(
      scheduled.some(
        (task) =>
          task.schedule.start < NAVIGATION_INITIAL_RANGE.start &&
          task.schedule.end > NAVIGATION_INITIAL_RANGE.start,
      ),
    ).toBe(true);
    expect(
      scheduled.some(
        (task) =>
          task.schedule.start < NAVIGATION_INITIAL_RANGE.end &&
          task.schedule.end > NAVIGATION_INITIAL_RANGE.end,
      ),
    ).toBe(true);
    const firstLaneTaskIds = document.placements
      .filter((placement) => placement.laneId === 'navigation-lane-01')
      .map((placement) => placement.taskId);
    const firstLaneTasks = scheduled.filter((task) => firstLaneTaskIds.includes(task.id));
    expect(firstLaneTasks[1]!.schedule.start).toBeLessThan(firstLaneTasks[0]!.schedule.end);
  });

  it('routes from the top-level menu and updates the visible controlled range', () => {
    window.history.replaceState({}, '', '/navigation');
    const mounted = render(<Playground />);
    const navigationLink = screen.getByRole('link', { name: 'Navigation' });
    expect(navigationLink.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('144 events')).not.toBeNull();
    expect(screen.getByText('36 lanes')).not.toBeNull();
    expect(screen.getByText('12-week viewport')).not.toBeNull();
    const visibleRange = screen.getByTestId('navigation-visible-range');
    const before = visibleRange.textContent;
    const chart = screen.getByRole('region', { name: 'Long-range portfolio navigation chart' });
    installGeometry(chart);

    fireEvent.keyDown(chart, { altKey: true, key: 'PageDown' });

    expect(visibleRange.textContent).not.toBe(before);
    expect(
      mounted.container
        .querySelector('[data-scenario-size="navigation"]')
        ?.getAttribute('data-visible-range-start'),
    ).toBe(String(NAVIGATION_INITIAL_RANGE.start + 0.9 * 12 * 7 * DAY));
  });

  it('keeps sibling scenario ranges independent', () => {
    const mounted = render(
      <>
        <ScenarioGantt scenario={mainScenario} size="main" />
        <ScenarioGantt scenario={mainScenario} size="main" />
      </>,
    );
    const charts = screen.getAllByRole('region', { name: 'Website launch plan chart' });
    const frames = mounted.container.querySelectorAll('[data-scenario-size="main"]');
    installGeometry(charts[0]!);
    installGeometry(charts[1]!);

    fireEvent.keyDown(charts[0]!, { altKey: true, key: 'PageDown' });

    expect(frames[0]?.getAttribute('data-visible-range-start')).not.toBe(
      frames[1]?.getAttribute('data-visible-range-start'),
    );
    expect(frames[1]?.getAttribute('data-visible-range-start')).toBe(
      String(mainScenario.range.start),
    );
  });
});

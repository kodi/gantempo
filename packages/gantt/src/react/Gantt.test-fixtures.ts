import type { GanttDocument } from '../model/types';

export const REACT_TEST_DAY = 24 * 60 * 60 * 1_000;
export const REACT_TEST_START = Date.UTC(2026, 6, 29);

export function reactTestProps() {
  return {
    range: {
      end: REACT_TEST_START + 7 * REACT_TEST_DAY,
      start: REACT_TEST_START,
    },
    tickAnchor: REACT_TEST_START,
    tickInterval: REACT_TEST_DAY,
    timeZone: 'UTC',
  } as const;
}

export function reactTestDocument(): GanttDocument {
  return {
    assignments: [],
    dependencies: [
      {
        fromTaskId: 'task-a',
        id: 'dependency-a-b',
        toTaskId: 'task-b',
        type: 'finish-to-start',
      },
    ],
    lanes: [
      { id: 'lane-a', title: 'Lane A' },
      { id: 'lane-b', title: 'Lane B' },
    ],
    placements: [
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' },
      { id: 'placement-b', laneId: 'lane-a', taskId: 'task-b' },
    ],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        schedule: {
          end: REACT_TEST_START + 2 * REACT_TEST_DAY,
          mode: 'instant',
          start: REACT_TEST_START + REACT_TEST_DAY,
        },
        segments: [],
        title: 'Task A',
      },
      {
        id: 'task-b',
        kind: 'task',
        schedule: {
          end: REACT_TEST_START + 4 * REACT_TEST_DAY,
          mode: 'instant',
          start: REACT_TEST_START + 3 * REACT_TEST_DAY,
        },
        segments: [],
        title: 'Task B',
      },
    ],
  };
}

export function installReactTestGeometry(container: HTMLElement): void {
  const viewport = container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = container.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 116 },
    clientWidth: { configurable: true, value: 860 },
  });
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: 700 });
  viewport.getBoundingClientRect = () =>
    ({ bottom: 116, height: 116, left: 0, right: 860, top: 0, width: 860 }) as DOMRect;
  timeline.getBoundingClientRect = () =>
    ({ bottom: 116, height: 116, left: 160, right: 860, top: 0, width: 700 }) as DOMRect;
}

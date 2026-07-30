// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { GanttCommandInterception } from '../runtime/types';
import { Gantt } from './Gantt';
import type { GanttHandle } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function documentFixture(): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [
      { id: 'lane-a', title: 'Lane A' },
      { id: 'lane-b', title: 'Lane B' },
    ],
    placements: [
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' },
      { id: 'placement-b', laneId: 'lane-a', taskId: 'task-b' },
      { id: 'placement-c', laneId: 'lane-b', taskId: 'task-c' },
    ],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
        segments: [],
        title: 'Task A',
      },
      {
        id: 'task-b',
        kind: 'task',
        schedule: { end: START + 4 * DAY, mode: 'instant', start: START + 3 * DAY },
        segments: [],
        title: 'Task B',
      },
      {
        id: 'task-c',
        kind: 'task',
        schedule: { end: START + 3 * DAY, mode: 'instant', start: START + 2 * DAY },
        segments: [],
        title: 'Task C',
      },
    ],
  };
}

function commonProps() {
  return {
    range: { end: START + 7 * DAY, start: START },
    tickAnchor: START,
    tickInterval: DAY,
    timeZone: 'UTC',
  } as const;
}

function installGeometry(container: HTMLElement, height = 116, width = 700): void {
  const body = container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = container.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
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

function dispatchPointer(
  target: Element,
  type: 'pointercancel' | 'pointerdown' | 'pointermove',
  input: { readonly clientX: number; readonly clientY: number; readonly pointerId: number },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: input.clientX,
    clientY: input.clientY,
  });
  Object.defineProperties(event, {
    isPrimary: { value: true },
    pointerId: { value: input.pointerId },
    pointerType: { value: 'mouse' },
  });
  target.dispatchEvent(event);
}

function virtualizedDocument(): GanttDocument {
  const lanes = Array.from({ length: 12 }, (_, index) => ({
    id: `lane-${index}`,
    title: `Lane ${index}`,
  }));
  return {
    assignments: [],
    dependencies: [],
    lanes,
    placements: lanes.map((lane, index) => ({
      id: `placement-${index}`,
      laneId: lane.id,
      taskId: `task-${index}`,
    })),
    resources: [],
    schemaVersion: 1,
    tasks: lanes.map((_, index) => ({
      id: `task-${index}`,
      kind: 'task' as const,
      schedule: { end: START + 2 * DAY, mode: 'instant' as const, start: START + DAY },
      segments: [],
      title: `Task ${index}`,
    })),
  };
}

async function expectNoSemanticViolations(container: HTMLElement): Promise<void> {
  const result = await axe.run(container, {
    rules: {
      // jsdom has no layout/paint engine, so color contrast remains a live-browser gate.
      'color-contrast': { enabled: false },
    },
  });
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        failureSummary: node.failureSummary,
        target: node.target,
      })),
    })),
  ).toEqual([]);
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('Gantt keyboard and accessibility integration', () => {
  it('provides one roving task stop with geometric navigation, selection, and activation', async () => {
    const activated: string[] = [];
    const user = userEvent.setup();
    const mounted = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        onTaskActivate={(target) => activated.push(target.taskId)}
      />,
    );
    installGeometry(mounted.container);
    const taskA = mounted.container.querySelector<SVGGElement>('[data-task-id="task-a"]')!;
    const taskB = mounted.container.querySelector<SVGGElement>('[data-task-id="task-b"]')!;
    const taskC = mounted.container.querySelector<SVGGElement>('[data-task-id="task-c"]')!;

    expect(mounted.getByRole('region', { name: 'Gantt chart' })).toHaveProperty('tabIndex', -1);
    expect(taskA.tabIndex).toBe(0);
    expect(taskB.tabIndex).toBe(-1);
    await user.tab();
    expect(document.activeElement).toBe(taskA);

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(taskB);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(taskC);
    await user.keyboard('{ArrowUp}{Home}');
    expect(document.activeElement).toBe(taskA);

    await user.keyboard(' ');
    expect(taskA.getAttribute('aria-pressed')).toBe('true');
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain(
      'Task A selected',
    );
    await user.keyboard('{Enter}');
    expect(activated).toEqual(['task-a']);
    await expectNoSemanticViolations(mounted.container);
  });

  it('moves, resizes, creates, deletes, undoes, and redoes through keyboard commands', async () => {
    const ref = createRef<GanttHandle>();
    const sources: string[] = [];
    const user = userEvent.setup();
    const mounted = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        interactionMappers={{
          createTask(intent) {
            return {
              command: {
                commands: [
                  {
                    type: 'task.add',
                    value: {
                      id: 'created',
                      schedule: { end: intent.end, mode: 'instant', start: intent.start },
                      title: 'Created',
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
        onDocumentChange={(change) => sources.push(change.source.kind)}
        ref={ref}
      />,
    );
    installGeometry(mounted.container);
    await user.tab();

    await user.keyboard('m{ArrowRight}{ArrowDown}{Enter}');
    expect(ref.current?.getDocument().tasks[0]?.schedule).toMatchObject({
      end: START + 3 * DAY,
      start: START + 2 * DAY,
    });
    expect(ref.current?.getDocument().placements[0]?.laneId).toBe('lane-b');
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain('Move committed');

    await user.keyboard('e{ArrowRight}{Enter}');
    expect(ref.current?.getDocument().tasks[0]?.schedule).toMatchObject({
      end: START + 4 * DAY,
    });
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain(
      'Resize committed',
    );
    await user.keyboard('s{ArrowLeft}{Escape}');
    expect(ref.current?.getDocument().tasks[0]?.schedule).toMatchObject({
      start: START + 2 * DAY,
    });
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain(
      'Keyboard interaction cancelled',
    );

    await user.keyboard('n');
    expect(ref.current?.getDocument().tasks.some((task) => task.id === 'created')).toBe(true);
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain(
      'Create committed',
    );
    await user.keyboard('{Delete}');
    expect(ref.current?.getDocument().tasks.some((task) => task.id === 'task-a')).toBe(false);
    expect(document.activeElement?.getAttribute('data-task-id')).not.toBe('task-a');
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain(
      'Delete committed',
    );
    await user.keyboard('{Control>}z{/Control}');
    expect(ref.current?.getDocument().tasks.some((task) => task.id === 'task-a')).toBe(true);
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain('Undo committed');
    await user.keyboard('{Control>}y{/Control}');
    expect(ref.current?.getDocument().tasks.some((task) => task.id === 'task-a')).toBe(false);

    expect(sources).toEqual(['keyboard', 'keyboard', 'keyboard', 'keyboard', 'history', 'history']);
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain('Redo committed');
  });

  it('keeps empty and rejected states coherent for assistive technology', async () => {
    const empty = render(
      <Gantt
        {...commonProps()}
        defaultDocument={{
          assignments: [],
          dependencies: [],
          lanes: [],
          placements: [],
          resources: [],
          schemaVersion: 1,
          tasks: [],
        }}
      />,
    );
    expect(empty.getByRole('region', { name: 'Gantt chart' }).tabIndex).toBe(0);
    expect(empty.getByRole('rowheader', { name: 'No scheduled work' })).not.toBeNull();
    await expectNoSemanticViolations(empty.container);
    cleanup();

    const user = userEvent.setup();
    const populated = render(<Gantt {...commonProps()} defaultDocument={documentFixture()} />);
    installGeometry(populated.container);
    await user.tab();
    await user.keyboard('n');
    expect(populated.getByRole('region', { name: 'Gantt chart' }).dataset.interactionState).toBe(
      'rejected',
    );
    expect(populated.container.querySelector('[aria-live]')?.textContent).toContain(
      'Task creation requires an application command mapper',
    );
    await expectNoSemanticViolations(populated.container);
  });

  it('keeps keyboard pending and pointer dragging states accessible', async () => {
    let resolve!: (result: GanttCommandInterception) => void;
    const interception = new Promise<GanttCommandInterception>((accept) => {
      resolve = accept;
    });
    const user = userEvent.setup();
    const mounted = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        interceptors={[() => interception]}
      />,
    );
    installGeometry(mounted.container);
    const root = mounted.getByRole('region', { name: 'Gantt chart' });
    await user.tab();
    await user.keyboard('m{ArrowRight}{Enter}');
    expect(root.dataset.interactionState).toBe('pending');
    expect(mounted.container.querySelector('[data-gt-part="interaction-preview"]')).not.toBeNull();
    await expectNoSemanticViolations(mounted.container);

    await act(async () => {
      resolve({ kind: 'allow' });
      await interception;
    });
    expect(root.dataset.interactionState).toBe('idle');

    const timeline = mounted.container.querySelector('[data-gt-part="timeline"]')!;
    const task = mounted.container.querySelector('[data-task-id="task-a"]')!;
    await act(async () => {
      dispatchPointer(task, 'pointerdown', { clientX: 410, clientY: 29, pointerId: 41 });
      dispatchPointer(timeline, 'pointermove', {
        clientX: 510,
        clientY: 29,
        pointerId: 41,
      });
    });
    expect(root.dataset.interactionState).toBe('dragging');
    await expectNoSemanticViolations(mounted.container);
    await act(async () => {
      dispatchPointer(timeline, 'pointercancel', {
        clientX: 510,
        clientY: 29,
        pointerId: 41,
      });
    });
  });

  it('retains the focused task through a virtualized vertical scroll', async () => {
    const user = userEvent.setup();
    const mounted = render(<Gantt {...commonProps()} defaultDocument={virtualizedDocument()} />);
    installGeometry(mounted.container, 58);
    await user.tab();
    const focused = document.activeElement as SVGGElement;
    expect(focused.dataset.taskId).toBe('task-0');
    const viewport = mounted.container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;

    await act(async () => {
      viewport.scrollTop = 500;
      fireEvent.scroll(viewport);
    });
    expect(mounted.container.contains(focused)).toBe(true);
    expect(document.activeElement).toBe(focused);
    await expectNoSemanticViolations(mounted.container);
  });

  it('undoes deletion from the empty-chart fallback tab stop', async () => {
    const fixture = documentFixture();
    const ref = createRef<GanttHandle>();
    const user = userEvent.setup();
    const mounted = render(
      <Gantt
        {...commonProps()}
        defaultDocument={{
          ...fixture,
          lanes: fixture.lanes.slice(0, 1),
          placements: fixture.placements.slice(0, 1),
          tasks: fixture.tasks.slice(0, 1),
        }}
        ref={ref}
      />,
    );
    installGeometry(mounted.container);
    await user.tab();
    await user.keyboard('{Delete}');
    expect(ref.current?.getDocument().tasks).toHaveLength(0);
    const root = mounted.getByRole('region', { name: 'Gantt chart' });
    expect(document.activeElement).toBe(root);

    await user.keyboard('{Control>}z{/Control}');
    expect(ref.current?.getDocument().tasks.map((task) => task.id)).toEqual(['task-a']);
    expect(mounted.container.querySelector('[aria-live]')?.textContent).toContain('Undo committed');
  });
});

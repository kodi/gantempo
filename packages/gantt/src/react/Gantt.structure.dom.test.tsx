// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Gantt } from './Gantt';
import { installReactTestGeometry, reactTestDocument, reactTestProps } from './Gantt.test-fixtures';
import type { GanttLaneHeaderProps, GanttTaskContentProps } from './types';

afterEach(cleanup);

describe('Gantt structural and render-isolation contract', () => {
  it('keeps the chart layers, accessible ownership, and dependency summary linked', () => {
    const mounted = render(
      <Gantt
        {...reactTestProps()}
        defaultDocument={reactTestDocument()}
        view={{ kind: 'project' }}
      />,
    );
    const root = mounted.container.querySelector<HTMLElement>('[data-gt-part="root"]')!;
    const chart = root.querySelector<HTMLElement>('[data-gt-part="chart"]')!;
    const viewport = chart.querySelector<HTMLElement>('[data-gt-part="viewport"]')!;
    const timeline = viewport.querySelector<HTMLElement>('[data-gt-part="timeline"]')!;
    const svg = timeline.querySelector('svg')!;

    expect(Array.from(chart.children, (element) => element.getAttribute('data-gt-part'))).toEqual([
      'corner',
      'time-header',
      'viewport',
    ]);
    expect(Array.from(svg.children, (element) => element.getAttribute('data-gt-part'))).toEqual([
      null,
      'grid',
      'dependencies',
      'task',
      'task',
    ]);

    const taskIds = Array.from(
      root.querySelectorAll<SVGGElement>('[data-gt-part="task"]'),
      (task) => task.id,
    );
    const ownedTaskIds = Array.from(
      root.querySelectorAll<HTMLElement>('[role="treegrid"] [role="gridcell"][aria-owns]'),
      (cell) => cell.getAttribute('aria-owns'),
    ).flatMap((ids) => ids?.split(' ') ?? []);
    expect(ownedTaskIds).toEqual(taskIds);

    const dependency = root.querySelector<SVGGElement>(
      '[data-gt-part="dependency"][data-dependency-id="dependency-a-b"]',
    );
    const summary = root.querySelector<HTMLElement>(
      '[data-gt-part="dependency-summaries"] [data-dependency-id="dependency-a-b"]',
    );
    expect(dependency?.getAttribute('role')).toBe('button');
    expect(summary?.dataset.visualized).toBe('true');
    expect(summary?.textContent).toContain('Task A to Task B, finish to start');
  });

  it('owns overlays outside the chart and restores task focus when the editor closes', async () => {
    const user = userEvent.setup();
    const mounted = render(
      <Gantt
        {...reactTestProps()}
        defaultDocument={reactTestDocument()}
        features={{ editor: true, tooltip: true }}
      />,
    );
    const root = mounted.container.querySelector<HTMLElement>('[data-gt-part="root"]')!;
    installReactTestGeometry(mounted.container);
    const task = mounted.container.querySelector<SVGGElement>(
      '[data-gt-part="task"][data-task-id="task-a"]',
    )!;

    task.focus();
    const tooltip = await screen.findByRole('tooltip');
    const overlayOwner = tooltip.closest<HTMLElement>('[data-gt-overlay-owner]');
    expect(overlayOwner?.parentElement).toBe(document.body);
    expect(root.contains(tooltip)).toBe(false);

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Edit Task A' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(task);
  });

  it('server-renders deterministic structure without a browser-owned overlay host', () => {
    const first = renderToString(
      <Gantt {...reactTestProps()} defaultDocument={reactTestDocument()} />,
    );
    const second = renderToString(
      <Gantt {...reactTestProps()} defaultDocument={reactTestDocument()} />,
    );

    expect(second).toBe(first);
    expect(first).toContain('data-gt-part="root"');
    expect(first).toContain('role="treegrid"');
    expect(first).toContain('data-gt-part="dependency-summaries"');
    expect(first).not.toContain('data-gt-overlay-owner');
  });

  it('records the pre-boundary task-content and lane-cell render fan-out', async () => {
    const user = userEvent.setup();
    const taskRenders = new Map<string, number>();
    const laneRenders = new Map<string, number>();
    const TaskContent = ({ task }: GanttTaskContentProps) => {
      taskRenders.set(task.target.taskId, (taskRenders.get(task.target.taskId) ?? 0) + 1);
      return <span>{task.title}</span>;
    };
    const LaneHeader = ({ lane }: GanttLaneHeaderProps) => <span>{lane.title}</span>;
    const mounted = render(
      <Gantt
        {...reactTestProps()}
        columns={[
          { header: 'Lane', id: 'lane' },
          {
            header: 'Probe',
            id: 'probe',
            renderCell: ({ lane }) => {
              const laneId = lane.target.laneId!;
              laneRenders.set(laneId, (laneRenders.get(laneId) ?? 0) + 1);
              return lane.title;
            },
          },
        ]}
        defaultDocument={reactTestDocument()}
        slots={{ LaneHeader, TaskContent }}
      />,
    );
    installReactTestGeometry(mounted.container);
    taskRenders.clear();
    laneRenders.clear();

    const task = mounted.container.querySelector<SVGGElement>(
      '[data-gt-part="task"][data-task-id="task-a"]',
    )!;
    task.focus();
    await user.keyboard(' ');

    expect(taskRenders.get('task-a')).toBeGreaterThan(0);
    // These two assertions lock the pre-extraction baseline. Slice 4 converts them to
    // zero-render isolation assertions once item and lane inputs have stable identities.
    expect(taskRenders.get('task-b')).toBeGreaterThan(0);
    expect(laneRenders.get('lane-b')).toBeGreaterThan(0);
  });
});

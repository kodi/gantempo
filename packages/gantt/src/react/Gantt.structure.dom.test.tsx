// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('isolates task-content and lane-cell renders to the affected target', async () => {
    const user = userEvent.setup();
    const taskRenders = new Map<string, number>();
    const laneRenders = new Map<string, number>();
    const dependencyRenders = new Map<string, number>();
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
              laneRenders.set(lane.title, (laneRenders.get(lane.title) ?? 0) + 1);
              return lane.title;
            },
          },
        ]}
        classNames={{
          dependencyPath: ({ target }) => {
            if (target?.kind === 'dependency') {
              dependencyRenders.set(
                target.dependencyId,
                (dependencyRenders.get(target.dependencyId) ?? 0) + 1,
              );
            }
            return undefined;
          },
        }}
        defaultDocument={reactTestDocument()}
        slots={{ LaneHeader, TaskContent }}
        view={{ kind: 'project' }}
      />,
    );
    installReactTestGeometry(mounted.container);
    taskRenders.clear();
    laneRenders.clear();
    dependencyRenders.clear();

    const task = mounted.container.querySelector<SVGGElement>(
      '[data-gt-part="task"][data-task-id="task-a"]',
    )!;
    task.focus();
    await user.keyboard(' ');

    expect(taskRenders.get('task-a')).toBeGreaterThan(0);
    expect(taskRenders.get('task-b') ?? 0).toBe(0);
    expect(taskRenders.get('task-c') ?? 0).toBe(0);
    expect(laneRenders.get('Task B') ?? 0).toBe(0);
    expect(laneRenders.get('Task C') ?? 0).toBe(0);

    dependencyRenders.clear();
    expect(
      Array.from(
        mounted.container.querySelectorAll<SVGGElement>('[data-gt-part="dependency"]'),
        (element) => element.dataset.dependencyId,
      ),
    ).toContain('dependency-a-b');
    const dependency = mounted.container.querySelector<SVGGElement>(
      '[data-gt-part="dependency"][data-dependency-id="dependency-a-b"]',
    )!;
    fireEvent.focus(dependency);
    expect(dependency.getAttribute('data-selected')).toBe('true');
    expect(dependencyRenders.get('dependency-a-b')).toBeGreaterThan(0);
    expect(dependencyRenders.get('dependency-b-c') ?? 0).toBe(0);
  });

  it('propagates changed slot and class callbacks across memo boundaries', () => {
    const FirstTaskContent = ({ task }: GanttTaskContentProps) => <span>{task.title} first</span>;
    const SecondTaskContent = ({ task }: GanttTaskContentProps) => <span>{task.title} second</span>;
    const mounted = render(
      <Gantt
        {...reactTestProps()}
        classNames={{ task: 'task-first' }}
        defaultDocument={reactTestDocument()}
        slots={{ TaskContent: FirstTaskContent }}
      />,
    );
    const task = mounted.container.querySelector<SVGGElement>(
      '[data-gt-part="task"][data-task-id="task-a"]',
    )!;
    expect(task.classList.contains('task-first')).toBe(true);
    expect(task.textContent).toContain('Task A first');

    mounted.rerender(
      <Gantt
        {...reactTestProps()}
        classNames={{ task: 'task-second' }}
        defaultDocument={reactTestDocument()}
        slots={{ TaskContent: SecondTaskContent }}
      />,
    );
    expect(task.classList.contains('task-first')).toBe(false);
    expect(task.classList.contains('task-second')).toBe(true);
    expect(task.textContent).toContain('Task A second');
  });
});

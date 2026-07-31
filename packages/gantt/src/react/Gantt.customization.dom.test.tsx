// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { GanttCommandInterception } from '../runtime/types';
import { Gantt } from './Gantt';
import type {
  GanttContextMenuProps,
  GanttLaneHeaderProps,
  GanttTaskContentProps,
  GanttTooltipProps,
} from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function localEditorDate(epoch: number): string {
  const date = new Date(epoch);
  return new Date(epoch - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function documentFixture(title = 'Task A'): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [{ id: 'lane-a', title: 'Lane A' }],
    placements: [{ id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' }],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
        segments: [],
        title,
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

function installGeometry(container: HTMLElement): void {
  const body = container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = container.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 116 },
    clientWidth: { configurable: true, value: 860 },
  });
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: 700 });
  body.getBoundingClientRect = () =>
    ({
      bottom: 116,
      height: 116,
      left: 0,
      right: 860,
      top: 0,
      width: 860,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  timeline.getBoundingClientRect = () =>
    ({
      bottom: 116,
      height: 116,
      left: 160,
      right: 860,
      top: 0,
      width: 700,
      x: 160,
      y: 0,
      toJSON() {},
    }) as DOMRect;
}

async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const result = await axe.run(container, {
    rules: {
      // jsdom does not resolve the authored theme variables into reliable contrast values.
      'color-contrast': { enabled: false },
    },
  });
  expect(result.violations.map((violation) => violation.id)).toEqual([]);
}

afterEach(() => cleanup());

describe('Gantt customization surfaces', () => {
  it('renders typed content slots, class hooks, and aligned read-only lane columns', async () => {
    const user = userEvent.setup();
    const TaskContent = ({ selected, task }: GanttTaskContentProps) => (
      <span data-testid="task-content">
        {task.title}:{selected ? 'selected' : 'idle'}
      </span>
    );
    const LaneHeader = ({ lane }: GanttLaneHeaderProps) => (
      <span data-testid="lane-header">{lane.title.toUpperCase()}</span>
    );
    const view = render(
      <Gantt
        {...commonProps()}
        className="consumer-root"
        classNames={{
          chart: 'consumer-chart',
          laneHeader: 'consumer-lane-header',
          root: ({ disabled }) => (disabled ? 'consumer-readonly' : 'consumer-editable'),
          task: ({ selected }) => (selected ? 'consumer-selected' : 'consumer-task'),
          taskContent: 'consumer-task-content',
          timelineCell: 'consumer-timeline-cell',
        }}
        columns={[
          { header: 'Phase', id: 'phase', width: 150 },
          {
            header: 'Lane ID',
            id: 'id',
            renderCell: ({ lane }) => lane.target.laneId,
            width: 90,
          },
        ]}
        defaultDocument={documentFixture()}
        slots={{ LaneHeader, TaskContent }}
      />,
    );
    installGeometry(view.container);
    const root = screen.getByRole('region', { name: 'Gantt chart' });
    const task = screen.getByRole('button', { name: /Task A/ });

    expect(root.classList.contains('consumer-root')).toBe(true);
    expect(root.classList.contains('consumer-editable')).toBe(true);
    expect(
      view.container.querySelector('[data-gt-part="chart"]')?.classList.contains('consumer-chart'),
    ).toBe(true);
    expect(
      view.container.querySelector<HTMLElement>('[data-gt-part="corner"]')?.style
        .gridTemplateColumns,
    ).toBe('150px 90px');
    expect(screen.getAllByText('LANE A')).toHaveLength(2);
    expect(screen.getAllByText('lane-a')).toHaveLength(2);
    expect(screen.getByTestId('task-content').textContent).toBe('Task A:idle');
    expect(task.classList.contains('consumer-task')).toBe(true);

    task.focus();
    await user.keyboard(' ');

    expect(screen.getByTestId('task-content').textContent).toBe('Task A:selected');
    expect(task.classList.contains('consumer-selected')).toBe(true);
    expect(
      view.container
        .querySelector('[data-gt-part="lane-header"]')
        ?.classList.contains('consumer-lane-header'),
    ).toBe(true);
    expect(
      view.container
        .querySelector('[data-gt-part="timeline-cell"]')
        ?.classList.contains('consumer-timeline-cell'),
    ).toBe(true);
    await expectNoAxeViolations(view.container);
  });

  it('opens the default tooltip and editor, validates locally, commits one transaction, and returns focus', async () => {
    const user = userEvent.setup();
    const view = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        features={{ editor: true, tooltip: true }}
      />,
    );
    installGeometry(view.container);
    const task = screen.getByRole('button', { name: /Task A/ });
    task.focus();

    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText('Task A')).toBeTruthy();
    expect(within(tooltip).getByText('Jul 30 – Jul 31, 2026')).toBeTruthy();
    expect(within(tooltip).getByText('1 day')).toBeTruthy();
    expect(tooltip.textContent).not.toContain('T00:00:00.000Z');
    expect(tooltip.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog', { name: 'Edit Task A' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    expect(document.body.style.overflow).toBe('hidden');
    expect(view.container.hasAttribute('inert')).toBe(true);
    expect(view.container.getAttribute('aria-hidden')).toBe('true');
    const startInput = screen.getByLabelText<HTMLInputElement>('Start (ISO 8601)');
    const endInput = screen.getByLabelText<HTMLInputElement>('End (ISO 8601)');
    expect(startInput.type).toBe('datetime-local');
    expect(endInput.type).toBe('datetime-local');
    expect(Date.parse(startInput.value)).toBe(START + DAY);
    expect(Date.parse(endInput.value)).toBe(START + 2 * DAY);
    const lateBodyChild = document.createElement('div');
    document.body.append(lateBodyChild);
    await waitFor(() => {
      expect(lateBodyChild.hasAttribute('inert')).toBe(true);
      expect(lateBodyChild.getAttribute('aria-hidden')).toBe('true');
    });
    await user.clear(screen.getByLabelText('Title'));
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Title is required.');

    await user.type(screen.getByLabelText('Title'), 'Task A updated');
    fireEvent.change(startInput, { target: { value: localEditorDate(START + 2 * DAY) } });
    fireEvent.change(endInput, { target: { value: localEditorDate(START + 4 * DAY) } });
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const updated = screen.getByRole('button', { name: /Task A updated/ });
    expect(updated.getAttribute('aria-label')).toMatch(/Jul 31, 2026.*Aug 2, 2026/);
    expect(document.activeElement).toBe(updated);
    expect(screen.getByText('Edit committed.')).not.toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(view.container.hasAttribute('inert')).toBe(false);
    expect(view.container.hasAttribute('aria-hidden')).toBe(false);
    expect(lateBodyChild.hasAttribute('inert')).toBe(false);
    expect(lateBodyChild.hasAttribute('aria-hidden')).toBe(false);
    lateBodyChild.remove();
    await expectNoAxeViolations(view.container);
  });

  it('provides an accessible task menu with stable disabled reasons and typed commands', async () => {
    const user = userEvent.setup();
    const view = render(
      <Gantt
        {...commonProps()}
        contextMenuItems={[
          {
            command: {
              changes: { title: 'Command renamed' },
              id: 'task-a',
              type: 'task.update',
            },
            id: 'rename',
            label: 'Rename from command',
          },
        ]}
        defaultDocument={documentFixture()}
        features={{ contextMenu: true, editor: true }}
      />,
    );
    installGeometry(view.container);
    const task = screen.getByRole('button', { name: /Task A/ });
    task.focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');

    const menu = await screen.findByRole('menu', { name: 'Task A actions' });
    expect(menu.querySelector('.gt-gantt__context-menu-header')?.textContent).toContain('Task A');
    expect(menu.querySelectorAll('.gt-gantt__context-menu-icon svg')).toHaveLength(4);
    expect(
      Array.from(
        menu.querySelectorAll('[role="menuitem"]'),
        (item) => item.getAttribute('aria-label')?.split(':')[0],
      ),
    ).toEqual(['Create task', 'Edit task', 'Rename from command', 'Delete task']);
    const createItem = within(menu).getByRole<HTMLButtonElement>('menuitem', {
      name: /Create task/,
    });
    expect(createItem.disabled).toBe(true);
    expect(createItem.getAttribute('aria-label')).toBe(
      'Create task: Task creation requires a create-task mapper.',
    );
    expect(
      within(menu).getByRole<HTMLButtonElement>('menuitem', { name: 'Edit task' }).disabled,
    ).toBe(false);
    expect(
      within(menu)
        .getByRole<HTMLButtonElement>('menuitem', { name: 'Delete task' })
        .getAttribute('data-destructive'),
    ).toBe('true');
    await user.click(within(menu).getByRole('menuitem', { name: 'Rename from command' }));

    const renamed = await screen.findByRole('button', { name: /Command renamed/ });
    expect(document.activeElement).toBe(renamed);
    expect(screen.getByText('Command committed.')).not.toBeNull();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Delete task' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Command renamed/ })).toBeNull(),
    );
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Gantt chart' }));
    expect(screen.getByText('Delete committed.')).not.toBeNull();
    await expectNoAxeViolations(view.container);
  });

  it('keeps document-portalled surfaces isolated by owning instance', async () => {
    const Tooltip = ({ bindings, task }: GanttTooltipProps) => (
      <div {...bindings} data-testid={`tooltip-${task.target.viewKey}`}>
        Custom {task.title}
      </div>
    );
    const view = render(
      <div>
        <Gantt
          {...commonProps()}
          defaultDocument={documentFixture('First task')}
          label="First chart"
          slots={{ Tooltip }}
        />
        <Gantt
          {...commonProps()}
          defaultDocument={documentFixture('Second task')}
          label="Second chart"
          slots={{ Tooltip }}
        />
      </div>,
    );
    screen.getByRole('button', { name: /First task/ }).focus();

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Custom First task');
    expect(within(screen.getByRole('region', { name: 'First chart' })).queryByRole('tooltip')).toBe(
      null,
    );
    expect(tooltip.closest('[data-gt-overlay-boundary="viewport"]')?.parentElement).toBe(
      document.body,
    );
    expect(
      within(screen.getByRole('region', { name: 'Second chart' })).queryByRole('tooltip'),
    ).toBeNull();
    expect(document.querySelectorAll('[data-gt-overlay-boundary="viewport"]')).toHaveLength(2);
    await expectNoAxeViolations(view.container);
  });

  it('retains an explicit chart-local overlay boundary', async () => {
    const view = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        overlayContainer="root"
        features={{ tooltip: true }}
      />,
    );
    screen.getByRole('button', { name: /Task A/ }).focus();

    const tooltip = await screen.findByRole('tooltip');
    const region = screen.getByRole('region', { name: 'Gantt chart' });
    expect(within(region).getByRole('tooltip')).toBe(tooltip);
    expect(view.container.querySelector('[data-gt-overlay-boundary="viewport"]')).toBeNull();
    expect(
      region.querySelector('[data-gt-overlay-boundary="root"]')?.getAttribute('aria-hidden'),
    ).toBeNull();
  });

  it('owns and cleans up a wrapper in a supplied overlay container', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const view = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        overlayContainer={() => target}
      />,
    );

    expect(target.querySelectorAll('[data-gt-overlay-boundary="viewport"]')).toHaveLength(1);
    expect(target.querySelector('[data-gt-overlay-owner]')).not.toBeNull();

    view.unmount();
    expect(target.childElementCount).toBe(0);
    target.remove();
  });

  it('adjusts a context menu into the viewport safe area', async () => {
    const previousWidth = window.innerWidth;
    const previousHeight = window.innerHeight;
    Object.defineProperties(window, {
      innerHeight: { configurable: true, value: 240 },
      innerWidth: { configurable: true, value: 320 },
    });
    const ContextMenu = ({ bindings, items, onSelect }: GanttContextMenuProps) => {
      const { ref, ...attributes } = bindings;
      return (
        <div
          {...attributes}
          ref={(element) => {
            if (element !== null) {
              element.getBoundingClientRect = () => {
                const left = Number.parseFloat(element.style.left);
                const top = Number.parseFloat(element.style.top);
                return {
                  bottom: top + 80,
                  height: 80,
                  left,
                  right: left + 100,
                  top,
                  width: 100,
                  x: left,
                  y: top,
                  toJSON() {},
                } as DOMRect;
              };
            }
            ref(element);
          }}
        >
          {items.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)} role="menuitem" type="button">
              {item.label}
            </button>
          ))}
        </div>
      );
    };
    const view = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        features={{ contextMenu: true }}
        slots={{ ContextMenu }}
      />,
    );
    const task = screen.getByRole('button', { name: /Task A/ });
    task.getBoundingClientRect = () =>
      ({
        bottom: 230,
        height: 20,
        left: 280,
        right: 300,
        top: 210,
        width: 20,
        x: 280,
        y: 210,
        toJSON() {},
      }) as DOMRect;
    fireEvent.contextMenu(task, { clientX: 290, clientY: 228 });

    const menu = await screen.findByRole('menu');
    await waitFor(() => {
      expect(menu.style.left).toBe('212px');
      expect(menu.style.top).toBe('152px');
    });

    view.unmount();
    Object.defineProperties(window, {
      innerHeight: { configurable: true, value: previousHeight },
      innerWidth: { configurable: true, value: previousWidth },
    });
  });

  it('retains the editor with labelled rejection details while an interceptor settles', async () => {
    let settle!: (result: GanttCommandInterception) => void;
    const interception = new Promise<GanttCommandInterception>((resolve) => {
      settle = resolve;
    });
    const user = userEvent.setup();
    const view = render(
      <Gantt
        {...commonProps()}
        defaultDocument={documentFixture()}
        features={{ editor: true }}
        interceptors={[() => interception]}
      />,
    );
    installGeometry(view.container);
    screen.getByRole('button', { name: /Task A/ }).focus();
    await user.keyboard('{Enter}');
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Pending title');
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Saving…' }).disabled).toBe(true);
    settle({
      diagnostic: {
        code: 'command.unsupported-target',
        message: 'Editing is locked by policy.',
        path: '/editor',
        severity: 'error',
      },
      kind: 'reject',
    });

    expect((await screen.findByRole('alert')).textContent).toBe('Editing is locked by policy.');
    const dialog = screen.getByRole('dialog');
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(descriptionId).not.toBeNull();
    expect(document.getElementById(descriptionId!)?.textContent).toBe(
      'Editing is locked by policy.',
    );
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Pending title');
    await expectNoAxeViolations(view.container);
  });
});

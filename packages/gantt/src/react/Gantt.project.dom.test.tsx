// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { Gantt } from './Gantt';
import type { GanttHandle, GanttTaskContentProps } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function projectDocument(): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'summary',
        kind: 'summary',
        progress: 0.5,
        segments: [],
        title: 'Release',
      },
      {
        id: 'task',
        kind: 'task',
        parentId: 'summary',
        schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
        segments: [],
        title: 'Implementation',
      },
      {
        id: 'milestone',
        kind: 'milestone',
        parentId: 'summary',
        schedule: { end: START + 3 * DAY, mode: 'instant', start: START + 3 * DAY },
        segments: [],
        title: 'Launch',
      },
    ],
  };
}

const commonProps = {
  range: { end: START + 7 * DAY, start: START },
  tickAnchor: START,
  tickInterval: DAY,
  timeZone: 'UTC',
  view: { kind: 'project' as const },
};

function installGeometry(container: HTMLElement): void {
  const body = container.querySelector<HTMLDivElement>('[data-gt-part="viewport"]')!;
  const timeline = container.querySelector<HTMLDivElement>('[data-gt-part="timeline"]')!;
  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 174 },
    clientWidth: { configurable: true, value: 860 },
  });
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: 700 });
  body.getBoundingClientRect = () =>
    ({ bottom: 174, height: 174, left: 0, right: 860, top: 0, width: 860 }) as DOMRect;
  timeline.getBoundingClientRect = () =>
    ({ bottom: 174, height: 174, left: 160, right: 860, top: 0, width: 700 }) as DOMRect;
}

afterEach(cleanup);

describe('Gantt project tree integration', () => {
  it('renders hierarchical rows and kind-specific public summaries and SVG parts', () => {
    const summaries: GanttTaskContentProps['task'][] = [];
    const mounted = render(
      <Gantt
        {...commonProps}
        defaultDocument={projectDocument()}
        slots={{
          TaskContent({ task }) {
            summaries.push(task);
            return <span>{task.title}</span>;
          },
        }}
      />,
    );

    const rows = mounted.getByRole('treegrid').querySelectorAll('[role="row"][aria-level]');
    expect(Array.from(rows).map((row) => row.getAttribute('aria-level'))).toEqual(['1', '2', '2']);
    expect(rows[0]?.getAttribute('aria-expanded')).toBe('true');
    expect(mounted.container.querySelector('[data-gt-part="summary"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-gt-part="milestone"]')).not.toBeNull();
    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          depth: 0,
          descendantCount: 2,
          expanded: true,
          hasChildren: true,
          intervalSource: 'descendants',
          kind: 'summary',
        }),
        expect.objectContaining({ depth: 1, kind: 'milestone' }),
      ]),
    );
    expect(
      mounted.container.querySelector('[data-task-kind="summary"] [data-gt-part="resize-handle"]'),
    ).toBeNull();
    expect(
      mounted.container.querySelector(
        '[data-task-kind="milestone"] [data-gt-part="resize-handle"]',
      ),
    ).toBeNull();
  });

  it('renders semantic dependency routes and a pointer-independent relationship summary', async () => {
    const document: GanttDocument = {
      ...projectDocument(),
      dependencies: [
        {
          fromTaskId: 'task',
          id: 'implementation-launch',
          toTaskId: 'milestone',
          type: 'finish-to-start',
        },
      ],
    };
    const mounted = render(<Gantt {...commonProps} defaultDocument={document} />);
    const relationship = mounted.container.querySelector(
      '[data-gt-part="dependency"][data-dependency-id="implementation-launch"]',
    );
    expect(relationship).toMatchObject({
      dataset: expect.objectContaining({
        fromTaskId: 'task',
        status: 'valid',
        toTaskId: 'milestone',
        type: 'finish-to-start',
      }),
    });
    expect(relationship?.querySelectorAll('[data-gt-part="dependency-hit-target"]').length).toBe(5);
    expect(mounted.getByLabelText('Dependencies').textContent).toContain(
      'Implementation to Launch, finish to start',
    );
    expect((await axe.run(mounted.container)).violations).toEqual([]);
  });

  it('collapses from the accessible branch control and keeps the tree valid', async () => {
    const mounted = render(<Gantt {...commonProps} defaultDocument={projectDocument()} />);
    const toggle = mounted.getByRole('button', { name: 'Collapse Release' });
    fireEvent.click(toggle);

    expect(
      mounted.getByRole('button', { name: 'Expand Release' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(mounted.getByRole('treegrid').querySelectorAll('[role="row"][aria-level]')).toHaveLength(
      1,
    );
    expect(mounted.queryByLabelText(/^Implementation,/)).toBeNull();
    expect((await axe.run(mounted.container)).violations).toEqual([]);
  });

  it('publishes one complete controlled collapse proposal', () => {
    const proposals: unknown[] = [];
    const mounted = render(
      <Gantt
        {...commonProps}
        document={projectDocument()}
        onSessionChange={(session) => proposals.push(session)}
        session={{ selection: [], viewport: { verticalStart: 0 } }}
      />,
    );
    fireEvent.click(mounted.getByRole('button', { name: 'Collapse Release' }));

    expect(proposals).toEqual([
      expect.objectContaining({
        project: { collapsedTaskIds: ['summary'] },
        selection: [],
        viewport: { verticalStart: 0 },
      }),
    ]);
    expect(mounted.getByRole('button', { name: 'Collapse Release' })).not.toBeNull();
  });

  it('edits hierarchy, order, and milestone kind through the properties command path', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = render(
      <Gantt
        {...commonProps}
        defaultDocument={projectDocument()}
        features={{ properties: true }}
        ref={ref}
      />,
    );
    fireEvent.click(mounted.getByRole('button', { name: /^Implementation,/ }));
    const dialog = await mounted.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Kind'), {
      target: { value: 'milestone' },
    });
    expect(within(dialog).queryByLabelText('End (ISO 8601)')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Parent'), { target: { value: '' } });
    fireEvent.change(within(dialog).getByLabelText('Order'), { target: { value: '7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(mounted.queryByRole('dialog')).toBeNull());
    expect(ref.current?.getDocument().tasks.find((task) => task.id === 'task')).toMatchObject({
      kind: 'milestone',
      order: 7,
      schedule: { end: START + DAY, mode: 'instant', start: START + DAY },
    });
    expect(ref.current?.getDocument().tasks.find((task) => task.id === 'task')).not.toHaveProperty(
      'parentId',
    );
  });

  it('creates and selects a dependency with the keyboard linking workflow', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = render(
      <Gantt {...commonProps} defaultDocument={projectDocument()} ref={ref} />,
    );
    installGeometry(mounted.container);
    const source = mounted.getByRole('button', { name: /^Implementation,/ });
    fireEvent.focus(source);
    fireEvent.keyDown(source, { key: 'l' });
    expect(mounted.container.querySelector('[data-gt-part="dependency-preview"]')).not.toBeNull();
    fireEvent.keyDown(source, { key: 'ArrowDown' });
    fireEvent.keyDown(mounted.getByRole('button', { name: /^Launch,/ }), { key: 'Enter' });

    await waitFor(() => expect(ref.current?.getDocument().dependencies).toHaveLength(1));
    expect(ref.current?.getDocument().dependencies[0]).toMatchObject({
      fromTaskId: 'task',
      toTaskId: 'milestone',
      type: 'finish-to-start',
    });
    const path = mounted.container.querySelector<SVGGElement>('[data-gt-part="dependency"]');
    expect(path?.dataset.selected).toBe('true');
    expect(ref.current?.getSelection()[0]).toMatchObject({ kind: 'dependency' });
  });

  it('edits and deletes a dependency through the bounded properties overlay', async () => {
    const ref = createRef<GanttHandle>();
    const document: GanttDocument = {
      ...projectDocument(),
      dependencies: [
        {
          fromTaskId: 'task',
          id: 'implementation-launch',
          toTaskId: 'milestone',
          type: 'finish-to-start',
        },
      ],
    };
    const mounted = render(
      <Gantt
        {...commonProps}
        defaultDocument={document}
        features={{ properties: true }}
        ref={ref}
      />,
    );
    installGeometry(mounted.container);
    const path = mounted.container.querySelector<SVGGElement>(
      '[data-gt-part="dependency"][data-dependency-id="implementation-launch"]',
    )!;
    fireEvent.focus(path);
    fireEvent.keyDown(path, { key: 'Enter' });
    const dialog = await mounted.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Dependency type'), {
      target: { value: 'start-to-start' },
    });
    fireEvent.change(within(dialog).getByLabelText('Lag value'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Lag unit'), { target: { value: 'day' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save dependency' }));
    await waitFor(() =>
      expect(ref.current?.getDocument().dependencies[0]).toMatchObject({
        lag: { mode: 'elapsed', unit: 'day', value: 2 },
        type: 'start-to-start',
      }),
    );

    fireEvent.focus(path);
    fireEvent.keyDown(path, { key: 'Enter' });
    fireEvent.click(
      within(await mounted.findByRole('dialog')).getByRole('button', {
        name: 'Delete dependency',
      }),
    );
    await waitFor(() => expect(ref.current?.getDocument().dependencies).toEqual([]));
    expect(ref.current?.getSession().focused).toMatchObject({ taskId: 'task' });
  });

  it('creates one link from the coarse pointer handle and target task', async () => {
    const ref = createRef<GanttHandle>();
    const mounted = render(
      <Gantt {...commonProps} defaultDocument={projectDocument()} ref={ref} />,
    );
    installGeometry(mounted.container);
    const source = mounted.getByRole('button', { name: /^Implementation,/ });
    const target = mounted.getByRole('button', { name: /^Launch,/ });
    const handle = source.querySelector('[data-gt-part="link-handle-hit-target"]')!;
    const timeline = mounted.container.querySelector('[data-gt-part="timeline"]')!;
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 360,
      clientY: 87,
      isPrimary: true,
      pointerId: 7,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(target, {
      clientX: 460,
      clientY: 145,
      pointerId: 7,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(target, {
      clientX: 460,
      clientY: 145,
      pointerId: 7,
      pointerType: 'touch',
    });
    // React delegates the task events through the timeline in browsers; the explicit
    // timeline release keeps this jsdom proof independent of pointer-capture support.
    fireEvent.pointerUp(timeline, { pointerId: 7, pointerType: 'touch' });
    await waitFor(() => expect(ref.current?.getDocument().dependencies).toHaveLength(1));
  });

  it('keeps dependency inspection available while disabling edits in read-only mode', async () => {
    const document: GanttDocument = {
      ...projectDocument(),
      dependencies: [
        {
          fromTaskId: 'task',
          id: 'implementation-launch',
          toTaskId: 'milestone',
          type: 'finish-to-start',
        },
      ],
    };
    const mounted = render(
      <Gantt {...commonProps} document={document} features={{ properties: true }} />,
    );
    installGeometry(mounted.container);
    expect(mounted.container.querySelector('[data-gt-part="link-handle"]')).toBeNull();
    const path = mounted.container.querySelector<SVGGElement>('[data-gt-part="dependency"]')!;
    fireEvent.focus(path);
    fireEvent.keyDown(path, { key: 'Enter' });
    const dialog = await mounted.findByRole('dialog');
    expect(dialog.getAttribute('aria-readonly')).toBe('true');
    expect(
      (within(dialog).getByRole('button', { name: 'Delete dependency' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('supports a bounded custom dependency properties slot', async () => {
    const ref = createRef<GanttHandle>();
    const document: GanttDocument = {
      ...projectDocument(),
      dependencies: [
        {
          fromTaskId: 'task',
          id: 'implementation-launch',
          toTaskId: 'milestone',
          type: 'finish-to-start',
        },
      ],
    };
    const mounted = render(
      <Gantt
        {...commonProps}
        defaultDocument={document}
        ref={ref}
        slots={{
          DependencyProperties({ bindings, initialValue, onSubmit }) {
            return (
              <div {...bindings}>
                <span>{`${initialValue.fromTitle} custom ${initialValue.toTitle}`}</span>
                <button
                  onClick={() => onSubmit({ ...initialValue, type: 'finish-to-finish' })}
                  type="button"
                >
                  Apply custom dependency
                </button>
              </div>
            );
          },
        }}
      />,
    );
    installGeometry(mounted.container);
    const path = mounted.container.querySelector<SVGGElement>('[data-gt-part="dependency"]')!;
    fireEvent.focus(path);
    fireEvent.keyDown(path, { key: 'Enter' });
    expect(await mounted.findByText('Implementation custom Launch')).not.toBeNull();
    fireEvent.click(mounted.getByRole('button', { name: 'Apply custom dependency' }));
    await waitFor(() =>
      expect(ref.current?.getDocument().dependencies[0]?.type).toBe('finish-to-finish'),
    );
  });
});

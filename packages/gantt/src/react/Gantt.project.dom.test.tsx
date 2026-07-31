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
});

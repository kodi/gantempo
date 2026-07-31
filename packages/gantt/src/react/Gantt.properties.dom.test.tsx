// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { GanttCommandCommittedEvent, GanttTaskTarget } from '../runtime/types';
import { Gantt } from './Gantt';
import type { GanttHandle, GanttItemPropertiesProps, GanttProps } from './types';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const COMMON = {
  range: { end: START + 7 * DAY, start: START },
  tickAnchor: START,
  tickInterval: DAY,
  timeZone: 'UTC',
} as const;

function documentFixture(): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [
      {
        appearance: { variant: 'ready' },
        id: 'lane-a',
        resourceId: 'resource-a',
        title: 'Lane A',
      },
      { id: 'lane-b', title: 'Lane B' },
    ],
    placements: [
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' },
      { id: 'placement-b', laneId: 'lane-b', taskId: 'task-b' },
    ],
    resources: [{ id: 'resource-a', title: 'Resource A' }],
    schemaVersion: 1,
    tasks: [
      {
        description: 'Original description',
        id: 'task-a',
        kind: 'task',
        progress: 0.25,
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
    ],
  };
}

function appearanceVariants() {
  return [
    { id: 'ready', label: 'Ready' },
    { id: 'risk', label: 'At risk' },
  ] as const;
}

function taskTarget(element: Element): GanttTaskTarget {
  const task = element as SVGGElement;
  return {
    kind: 'task',
    laneId: task.dataset.laneId!,
    laneViewKey: task.dataset.laneViewKey!,
    placementId: task.dataset.placementId!,
    taskId: task.dataset.taskId!,
    viewKey: task.dataset.viewKey!,
  };
}

afterEach(() => cleanup());

describe('item properties surface', () => {
  it('commits task fields and an unambiguous lane move as one transaction', async () => {
    const ref = createRef<GanttHandle>();
    const committed: GanttCommandCommittedEvent[] = [];
    render(
      <Gantt
        {...COMMON}
        appearanceVariants={appearanceVariants()}
        defaultDocument={documentFixture()}
        features={{ properties: true }}
        onCommandCommitted={(event) => committed.push(event)}
        ref={ref}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Task A properties' });
    expect(within(dialog).getByText('task-a')).toBeTruthy();
    expect(within(dialog).getByText('1d')).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Updated task' },
    });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'Updated description' },
    });
    fireEvent.change(within(dialog).getByLabelText('Progress (percent)'), {
      target: { value: '75' },
    });
    fireEvent.change(within(dialog).getByLabelText('Appearance'), {
      target: { value: 'risk' },
    });
    fireEvent.change(within(dialog).getByLabelText('Current lane'), {
      target: { value: 'lane-b' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ref.current?.getDocument().tasks[0]).toMatchObject({
      appearance: { variant: 'risk' },
      description: 'Updated description',
      progress: 0.75,
      title: 'Updated task',
    });
    expect(ref.current?.getDocument().placements[0]?.laneId).toBe('lane-b');
    expect(committed).toHaveLength(1);
    expect(committed[0]?.command).toMatchObject({
      commands: [
        { id: 'task-a', type: 'task.update' },
        { id: 'placement-a', laneId: 'lane-b', type: 'placement.move' },
      ],
      type: 'transaction',
    });
  });

  it('edits a persisted lane and returns focus to its accessible trigger', async () => {
    const ref = createRef<GanttHandle>();
    render(
      <Gantt
        {...COMMON}
        appearanceVariants={appearanceVariants()}
        defaultDocument={documentFixture()}
        features={{ properties: true }}
        ref={ref}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Lane A properties' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Edit Lane A properties' });
    expect(within(dialog).getByText('resource-a')).toBeTruthy();
    expect(ref.current?.getSelection()).toEqual([
      expect.objectContaining({ kind: 'lane', laneId: 'lane-a' }),
    ]);

    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Updated lane' },
    });
    fireEvent.change(within(dialog).getByLabelText('Appearance'), {
      target: { value: 'risk' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save lane' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ref.current?.getDocument().lanes[0]).toMatchObject({
      appearance: { variant: 'risk' },
      title: 'Updated lane',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Updated lane properties' }),
      ),
    );
  });

  it('opens read-only inspection without exposing mutation actions', async () => {
    render(
      <Gantt
        {...COMMON}
        appearanceVariants={appearanceVariants()}
        document={documentFixture()}
        features={{ properties: true }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    const dialog = await screen.findByRole('dialog', { name: 'View Task A properties' });
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText('Progress (percent)') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(within(dialog).queryByRole('button', { name: 'Save task' })).toBeNull();
    expect(
      (within(dialog).getByRole('button', { name: 'Delete task' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('preserves an unavailable variant when another field is saved', async () => {
    const ref = createRef<GanttHandle>();
    const base = documentFixture();
    render(
      <Gantt
        {...COMMON}
        appearanceVariants={appearanceVariants()}
        defaultDocument={{
          ...base,
          tasks: [
            {
              ...base.tasks[0]!,
              appearance: { variant: 'customer:unknown' },
            },
            base.tasks[1]!,
          ],
        }}
        features={{ properties: true }}
        ref={ref}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole<HTMLOptionElement>('option', {
        name: 'customer:unknown (unavailable)',
      }).selected,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Renamed only' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ref.current?.getDocument().tasks[0]?.appearance).toEqual({
      variant: 'customer:unknown',
    });
  });

  it('gives a replacement slot immutable values and bounded dispatch callbacks', async () => {
    const ref = createRef<GanttHandle>();
    let received: GanttItemPropertiesProps | undefined;
    function ItemProperties(props: GanttItemPropertiesProps): ReactElement {
      received = props;
      return (
        <div {...props.bindings}>
          <span>Custom item properties</span>
          <button
            onClick={() =>
              props.initialValue.kind === 'task' &&
              props.onSubmit({ ...props.initialValue, title: 'Custom title' })
            }
            type="button"
          >
            Custom save
          </button>
        </div>
      );
    }
    render(
      <Gantt
        {...COMMON}
        defaultDocument={documentFixture()}
        ref={ref}
        slots={{ ItemProperties }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Custom item properties')).toBeTruthy();
    expect(Object.isFrozen(received?.initialValue)).toBe(true);
    expect(received).not.toHaveProperty('document');
    expect(received).not.toHaveProperty('record');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Custom save' }));

    await waitFor(() => expect(ref.current?.getDocument().tasks[0]?.title).toBe('Custom title'));
  });

  it('updates an open read-only inspector from controlled selection without auto-opening', async () => {
    const document = documentFixture();
    const base: GanttProps = {
      ...COMMON,
      document,
      features: { properties: true },
      session: { selection: [], viewport: { verticalStart: 0 } },
    };
    const mounted = render(<Gantt {...base} />);
    const taskA = screen.getByRole('button', { name: /^Task A,/ });
    const taskB = screen.getByRole('button', { name: /^Task B,/ });
    const targetA = taskTarget(taskA);
    const targetB = taskTarget(taskB);

    mounted.rerender(
      <Gantt
        {...base}
        session={{ focused: targetA, selection: [targetA], viewport: { verticalStart: 0 } }}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    expect(await screen.findByDisplayValue('Task A')).toBeTruthy();

    await act(async () => {
      mounted.rerender(
        <Gantt
          {...base}
          session={{ focused: targetB, selection: [targetB], viewport: { verticalStart: 0 } }}
        />,
      );
    });
    await waitFor(() => expect(screen.getByDisplayValue('Task B')).toBeTruthy());
  });

  it('keeps a controlled Save pending until the candidate document is acknowledged', async () => {
    let candidate: GanttDocument | undefined;
    const document = documentFixture();
    const props: GanttProps = {
      ...COMMON,
      document,
      features: { properties: true },
      onDocumentChange(change) {
        candidate = change.document;
      },
    };
    const mounted = render(<Gantt {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Acknowledged title' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));

    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByText('Saving…')).toBeTruthy(),
    );
    expect(candidate?.tasks[0]?.title).toBe('Acknowledged title');
    mounted.rerender(<Gantt {...props} document={candidate!} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps rejected properties editable and reports the command diagnostic', async () => {
    const ref = createRef<GanttHandle>();
    render(
      <Gantt
        {...COMMON}
        defaultDocument={documentFixture()}
        features={{ properties: true }}
        interceptors={[
          () => ({
            diagnostic: {
              code: 'command.unsupported-target',
              message: 'Properties rejected by the consumer.',
              severity: 'error',
            },
            kind: 'reject',
          }),
        ]}
        ref={ref}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Rejected title' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Properties rejected by the consumer.',
    );
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).disabled).toBe(false);
    expect(ref.current?.getDocument().tasks[0]?.title).toBe('Task A');
  });

  it('validates bounded fields and deletes through history-capable dispatch', async () => {
    const ref = createRef<GanttHandle>();
    render(
      <Gantt
        {...COMMON}
        defaultDocument={documentFixture()}
        features={{ properties: true }}
        ref={ref}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task B,/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: '  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Title is required.');

    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Task B' },
    });
    fireEvent.change(within(dialog).getByLabelText('Progress (percent)'), {
      target: { value: '101' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Progress must be between 0% and 100%.',
    );

    fireEvent.change(within(dialog).getByLabelText('Progress (percent)'), {
      target: { value: '' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ref.current?.getDocument().tasks.some((task) => task.id === 'task-b')).toBe(false);
    expect(ref.current?.canUndo()).toBe(true);

    await act(async () => {
      await ref.current?.undo();
    });
    expect(ref.current?.getDocument().tasks.some((task) => task.id === 'task-b')).toBe(true);
  });

  it('closes safely when the inspected task disappears and isolates two mounted instances', async () => {
    const firstDocument = documentFixture();
    const secondDocument = {
      ...documentFixture(),
      tasks: documentFixture().tasks.map((task) => ({
        ...task,
        title: task.id === 'task-a' ? 'Second Task' : task.title,
      })),
    };
    const first = render(
      <>
        <Gantt {...COMMON} document={firstDocument} features={{ properties: true }} />
        <Gantt {...COMMON} document={secondDocument} features={{ properties: true }} />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Task A,/ }));
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByDisplayValue('Task A')).toBeTruthy();

    first.rerender(
      <>
        <Gantt
          {...COMMON}
          document={{
            ...firstDocument,
            placements: firstDocument.placements.filter(
              (placement) => placement.taskId !== 'task-a',
            ),
            tasks: firstDocument.tasks.filter((task) => task.id !== 'task-a'),
          }}
          features={{ properties: true }}
        />
        <Gantt {...COMMON} document={secondDocument} features={{ properties: true }} />
      </>,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /^Second Task,/ }));
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByDisplayValue('Second Task')).toBeTruthy();
  });
});

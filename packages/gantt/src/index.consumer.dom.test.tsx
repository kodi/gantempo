// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { useState } from 'react';

import {
  Gantt,
  type GanttCommand,
  type GanttCommandCommittedEvent,
  type GanttCommandRejectedEvent,
  type GanttDocument,
  type GanttDocumentChange,
  type GanttHandle,
  type GanttTaskTarget,
} from './index';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);
const COMMON = {
  range: { end: START + 7 * DAY, start: START },
  tickAnchor: START,
  tickInterval: DAY,
  timeZone: 'UTC',
} as const;

function documentFixture(title = 'Task A'): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [{ id: 'lane-a', title: 'Lane A' }],
    placements: [
      { id: 'placement-a', laneId: 'lane-a', taskId: 'task-a' },
      { id: 'placement-b', laneId: 'lane-a', taskId: 'task-b' },
    ],
    resources: [],
    revision: 'server-r1',
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
        segments: [],
        title,
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

afterEach(() => cleanup());

describe('root-facade consumer workflows', () => {
  it('acknowledges controlled candidates immediately and derives a narrow API write', async () => {
    let handle: GanttHandle | null = null;
    const changes: GanttDocumentChange[] = [];
    const committed: GanttCommandCommittedEvent[] = [];

    function ControlledConsumer() {
      const [document, setDocument] = useState(documentFixture());
      return (
        <Gantt
          {...COMMON}
          document={document}
          onCommandCommitted={(event) => committed.push(event)}
          onDocumentChange={(change) => {
            changes.push(change);
            setDocument(change.document);
          }}
          ref={(value) => {
            handle = value;
          }}
        />
      );
    }

    render(<ControlledConsumer />);
    const command: GanttCommand = {
      commands: [
        {
          changes: { title: 'Updated through the facade' },
          id: 'task-a',
          type: 'task.update',
        },
        { delta: DAY, id: 'task-a', type: 'task.move' },
      ],
      type: 'transaction',
    };

    await act(async () => {
      await handle!.dispatch(command, { source: { kind: 'toolbar' } });
    });
    await waitFor(() => expect(committed).toHaveLength(1));

    const change = changes[0]!;
    const request = {
      baseRevision: change.baseRevision ?? null,
      changes: change.entityChanges,
      operationId: 'example-operation-001',
    };

    expect(request).toMatchObject({
      baseRevision: 'server-r1',
      operationId: 'example-operation-001',
    });
    expect(request.changes).toEqual([
      {
        after: expect.objectContaining({
          id: 'task-a',
          schedule: { end: START + 3 * DAY, mode: 'instant', start: START + 2 * DAY },
          title: 'Updated through the facade',
        }),
        before: expect.objectContaining({
          id: 'task-a',
          schedule: { end: START + 2 * DAY, mode: 'instant', start: START + DAY },
          title: 'Task A',
        }),
        collection: 'tasks',
        id: 'task-a',
        kind: 'update',
      },
    ]);
    expect(request).not.toHaveProperty('document');
    expect(request).not.toHaveProperty('runtime');
    expect(request).not.toHaveProperty('event');
    expect(request).not.toHaveProperty('patches');
    expect(request).not.toHaveProperty('proposalId');
    expect(request).not.toHaveProperty('source');
    expect(handle!.getDocument().tasks[0]).toMatchObject({
      schedule: { start: START + 2 * DAY },
      title: 'Updated through the facade',
    });
    expect(handle!.canUndo()).toBe(true);

    await act(async () => {
      await handle!.undo();
    });
    await waitFor(() => expect(committed).toHaveLength(2));
    expect(handle!.getDocument().tasks[0]?.title).toBe('Task A');
    expect(handle!.canRedo()).toBe(true);
  });

  it('owns default state while allowing async replacement, rejection, and imperative focus', async () => {
    let handle: GanttHandle | null = null;
    let focused: GanttTaskTarget | undefined;
    const committed: GanttCommandCommittedEvent[] = [];
    const rejected: GanttCommandRejectedEvent[] = [];
    const changes: GanttDocumentChange[] = [];

    render(
      <Gantt
        {...COMMON}
        defaultDocument={documentFixture()}
        defaultSession={{ selection: [], viewport: { verticalStart: 0 } }}
        interceptors={[
          async (proposal) => {
            await Promise.resolve();
            if (
              proposal.command.type === 'task.update' &&
              proposal.command.changes.title === 'Reject'
            ) {
              return {
                diagnostic: {
                  code: 'command.unsupported-target',
                  message: 'Rejected by the consumer.',
                  severity: 'error',
                },
                kind: 'reject',
              };
            }
            if (
              proposal.command.type === 'task.update' &&
              proposal.command.changes.title === 'Replace'
            ) {
              return {
                command: {
                  changes: { title: 'Replacement' },
                  id: proposal.command.id,
                  type: 'task.update',
                },
                kind: 'replace',
              };
            }
            return { kind: 'allow' };
          },
        ]}
        onCommandCommitted={(event) => committed.push(event)}
        onCommandRejected={(event) => rejected.push(event)}
        onDocumentChange={(change) => changes.push(change)}
        onFocusChange={(target) => {
          if (target?.kind === 'task') {
            focused = target;
          }
        }}
        ref={(value) => {
          handle = value;
        }}
        slots={{ TaskContent: ({ task }) => <span>Consumer {task.title}</span> }}
      />,
    );

    await act(async () => {
      await handle!.dispatch({
        changes: { title: 'Replace' },
        id: 'task-a',
        type: 'task.update',
      });
    });

    expect(committed).toHaveLength(1);
    expect(changes[0]?.originalCommand).toMatchObject({
      changes: { title: 'Replace' },
    });
    expect(changes[0]?.command).toMatchObject({
      changes: { title: 'Replacement' },
    });
    expect(handle!.getDocument().tasks[0]?.title).toBe('Replacement');

    await act(async () => {
      await handle!.dispatch({
        changes: { title: 'Reject' },
        id: 'task-a',
        type: 'task.update',
      });
    });
    expect(rejected[0]?.diagnostics[0]?.message).toBe('Rejected by the consumer.');
    expect(handle!.getDocument().tasks[0]?.title).toBe('Replacement');

    act(() => screen.getByRole('button', { name: /Task B/ }).focus());
    const taskBTarget = focused;
    act(() => screen.getByRole('button', { name: /Replacement/ }).focus());
    expect(taskBTarget).toBeDefined();
    expect(handle!.focusTask(taskBTarget!)).toBe(true);
    expect(handle!.scrollToTask(taskBTarget!, { align: 'center' })).toBe(true);
    expect(handle!.getSession().focused).toEqual(taskBTarget);
    expect(screen.getByText('Consumer Replacement')).not.toBeNull();
  });
});

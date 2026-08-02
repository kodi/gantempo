// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { GanttDocumentChange } from '../runtime/types';
import { useGanttDocument, type UseGanttDocumentOptions } from './useGanttDocument';

const API_DOCUMENT = {
  schemaVersion: 1,
  tasks: [
    {
      id: 'task-a',
      progress: 0.25,
      schedule: {
        end: '2026-08-05T17:00:00Z',
        mode: 'instant',
        start: '2026-08-03T09:00:00Z',
      },
      title: 'Task A',
    },
  ],
} satisfies unknown;

function TestController({ load, save }: UseGanttDocumentOptions) {
  const project = useGanttDocument({ load, ...(save === undefined ? {} : { save }) });

  function edit(progress: number): void {
    const document = project.ganttProps?.document;
    if (document === undefined) return;
    project.ganttProps?.onDocumentChange({
      document: {
        ...document,
        tasks: document.tasks.map((task) => (task.id === 'task-a' ? { ...task, progress } : task)),
      },
    } as unknown as GanttDocumentChange);
  }

  return (
    <div>
      <output aria-label="status">{project.status}</output>
      <output aria-label="dirty">{String(project.dirty)}</output>
      <output aria-label="progress">
        {project.ganttProps?.document.tasks[0]?.progress ?? 'none'}
      </output>
      <output aria-label="error">{project.error?.message ?? ''}</output>
      <button onClick={() => edit(0.5)} type="button">
        Edit once
      </button>
      <button onClick={() => edit(0.75)} type="button">
        Edit again
      </button>
      <button disabled={!project.canSave} onClick={() => void project.save()} type="button">
        Save
      </button>
      <button onClick={project.reload} type="button">
        Reload
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useGanttDocument', () => {
  it('parses unknown load data and does not require memoized adapter functions', async () => {
    const load = vi.fn<(signal: AbortSignal) => Promise<unknown>>(async () => API_DOCUMENT);
    const { rerender } = render(<TestController load={(signal) => load(signal)} />);

    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('ready'));
    expect(screen.getByLabelText('progress').textContent).toBe('0.25');
    rerender(<TestController load={(signal) => load(signal)} />);
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(true);
  });

  it('acknowledges controlled edits and saves the current canonical document', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (_document: GanttDocument) => undefined);
    render(<TestController load={async () => API_DOCUMENT} save={save} />);
    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('ready'));

    await user.click(screen.getByRole('button', { name: 'Edit once' }));
    expect(screen.getByLabelText('dirty').textContent).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('saved'));
    expect(screen.getByLabelText('dirty').textContent).toBe('false');
    expect(save.mock.calls[0]?.[0].tasks[0]?.progress).toBe(0.5);
  });

  it('keeps edits made during Save dirty and exposes retryable save errors', async () => {
    const user = userEvent.setup();
    let finishSave: (() => void) | undefined;
    const save = vi
      .fn<(document: GanttDocument) => Promise<void>>()
      .mockImplementationOnce(
        async () =>
          new Promise<void>((resolve) => {
            finishSave = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('Write failed'));
    render(<TestController load={async () => API_DOCUMENT} save={save} />);
    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('ready'));

    await user.click(screen.getByRole('button', { name: 'Edit once' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('status').textContent).toBe('saving');
    await user.click(screen.getByRole('button', { name: 'Edit again' }));
    finishSave?.();
    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('ready'));
    expect(screen.getByLabelText('dirty').textContent).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('save-error'));
    expect(screen.getByLabelText('error').textContent).toBe('Write failed');
    expect(screen.getByLabelText('dirty').textContent).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(false);
  });

  it('exposes invalid loads and retries with a newly aborted-safe request', async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    const load = vi
      .fn<(signal: AbortSignal) => Promise<unknown>>()
      .mockImplementationOnce(async (signal) => {
        signals.push(signal);
        return { schemaVersion: 99 };
      })
      .mockImplementationOnce(async (signal) => {
        signals.push(signal);
        return API_DOCUMENT;
      });
    const mounted = render(<TestController load={load} />);

    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('load-error'));
    expect(screen.getByLabelText('error').textContent).toContain('could not load the document');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByLabelText('status').textContent).toBe('ready'));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    mounted.unmount();
    expect(signals[1]?.aborted).toBe(true);
  });
});

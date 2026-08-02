// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import type { GanttDocumentChange } from '../runtime/types';
import { useGanttDocumentDraft } from './useGanttDocumentDraft';

function documentFixture(progress: number): GanttDocument {
  return {
    assignments: [],
    dependencies: [],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        kind: 'task',
        progress,
        schedule: { end: 200, mode: 'instant', start: 100 },
        segments: [],
        title: 'Task A',
      },
    ],
  };
}

function DraftController({ document }: { readonly document: GanttDocument | undefined }) {
  const draft = useGanttDocumentDraft({ document });

  function edit(progress: number): void {
    const current = draft.document;
    if (current === undefined) return;
    draft.ganttProps?.onDocumentChange({
      document: {
        ...current,
        tasks: current.tasks.map((task) => (task.id === 'task-a' ? { ...task, progress } : task)),
      },
    } as unknown as GanttDocumentChange);
  }

  return (
    <div>
      <output aria-label="dirty">{String(draft.dirty)}</output>
      <output aria-label="progress">{draft.document?.tasks[0]?.progress ?? 'none'}</output>
      <output aria-label="remote-update">{String(draft.hasRemoteUpdate)}</output>
      <button onClick={() => edit(0.5)} type="button">
        Edit 50
      </button>
      <button onClick={() => edit(0.75)} type="button">
        Edit 75
      </button>
      <button onClick={() => draft.markSaved(documentFixture(0.5))} type="button">
        Mark 50 saved
      </button>
      <button onClick={draft.reset} type="button">
        Reset
      </button>
    </div>
  );
}

afterEach(cleanup);

describe('useGanttDocumentDraft', () => {
  it('initializes a controlled binding and immediately acknowledges edits', async () => {
    const user = userEvent.setup();
    render(<DraftController document={documentFixture(0.25)} />);

    expect(screen.getByLabelText('progress').textContent).toBe('0.25');
    expect(screen.getByLabelText('dirty').textContent).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Edit 50' }));
    expect(screen.getByLabelText('progress').textContent).toBe('0.5');
    expect(screen.getByLabelText('dirty').textContent).toBe('true');
  });

  it('adopts changed source data while the draft is clean', async () => {
    const mounted = render(<DraftController document={documentFixture(0.25)} />);
    mounted.rerender(<DraftController document={documentFixture(0.5)} />);

    await waitFor(() => expect(screen.getByLabelText('progress').textContent).toBe('0.5'));
    expect(screen.getByLabelText('dirty').textContent).toBe('false');
    expect(screen.getByLabelText('remote-update').textContent).toBe('false');
  });

  it('protects a dirty draft from remote data until reset', async () => {
    const user = userEvent.setup();
    const mounted = render(<DraftController document={documentFixture(0.25)} />);
    await user.click(screen.getByRole('button', { name: 'Edit 50' }));
    mounted.rerender(<DraftController document={documentFixture(0.9)} />);

    await waitFor(() => expect(screen.getByLabelText('remote-update').textContent).toBe('true'));
    expect(screen.getByLabelText('progress').textContent).toBe('0.5');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('progress').textContent).toBe('0.9');
    expect(screen.getByLabelText('dirty').textContent).toBe('false');
  });

  it('clears matching saved state but preserves edits made after that snapshot', async () => {
    const user = userEvent.setup();
    render(<DraftController document={documentFixture(0.25)} />);

    await user.click(screen.getByRole('button', { name: 'Edit 50' }));
    await user.click(screen.getByRole('button', { name: 'Mark 50 saved' }));
    expect(screen.getByLabelText('dirty').textContent).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Edit 75' }));
    await user.click(screen.getByRole('button', { name: 'Mark 50 saved' }));
    expect(screen.getByLabelText('progress').textContent).toBe('0.75');
    expect(screen.getByLabelText('dirty').textContent).toBe('true');
  });
});

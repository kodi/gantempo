// @vitest-environment jsdom

import { QueryClient, QueryClientProvider, type QueryFunctionContext } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { GanttDocument } from './model/types';
import type { GanttDocumentChange } from './runtime/types';
import { useGanttDocumentQuery } from './react-query';

const QUERY_KEY = ['project', 'simple'] as const;

function apiDocument(progress: number): unknown {
  return {
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a',
        progress,
        schedule: {
          end: '2026-08-05T17:00:00Z',
          mode: 'instant',
          start: '2026-08-03T09:00:00Z',
        },
        title: 'Task A',
      },
    ],
  };
}

function canonicalDocument(progress: number): GanttDocument {
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
        schedule: {
          end: Date.parse('2026-08-05T17:00:00Z'),
          mode: 'instant',
          start: Date.parse('2026-08-03T09:00:00Z'),
        },
        segments: [],
        title: 'Task A',
      },
    ],
  };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

function QueryController({
  mutationFn,
  queryFn,
}: {
  readonly mutationFn?: (document: GanttDocument) => Promise<unknown>;
  readonly queryFn: (context: QueryFunctionContext<typeof QUERY_KEY>) => Promise<unknown>;
}) {
  const project = useGanttDocumentQuery({
    ...(mutationFn === undefined ? {} : { mutationFn }),
    queryFn,
    queryKey: QUERY_KEY,
  });

  function edit(progress: number): void {
    const document = project.document;
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
      <output aria-label="query-status">{project.query.status}</output>
      <output aria-label="mutation-status">{project.mutation.status}</output>
      <output aria-label="dirty">{String(project.dirty)}</output>
      <output aria-label="progress">{project.document?.tasks[0]?.progress ?? 'none'}</output>
      <output aria-label="remote-update">{String(project.hasRemoteUpdate)}</output>
      <output aria-label="error">
        {project.query.error?.message ?? project.mutation.error?.message}
      </output>
      <button onClick={() => edit(0.5)} type="button">
        Edit 50
      </button>
      <button onClick={() => edit(0.75)} type="button">
        Edit 75
      </button>
      <button disabled={!project.canSave} onClick={() => void project.save()} type="button">
        Save
      </button>
      <button onClick={() => void project.query.refetch()} type="button">
        Retry
      </button>
      <button onClick={project.reset} type="button">
        Reset
      </button>
    </div>
  );
}

function Providers({
  children,
  client,
}: {
  readonly children: ReactNode;
  readonly client: QueryClient;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useGanttDocumentQuery', () => {
  it('parses query data, saves the draft, and updates the matching cache', async () => {
    const user = userEvent.setup();
    const client = createClient();
    const mutationFn = vi.fn(async (_document: GanttDocument) => ({ revision: 2 }));
    render(
      <Providers client={client}>
        <QueryController mutationFn={mutationFn} queryFn={async () => apiDocument(0.25)} />
      </Providers>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('query-status').textContent).toBe('success');
      expect(screen.getByLabelText('progress').textContent).toBe('0.25');
    });
    await user.click(screen.getByRole('button', { name: 'Edit 50' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByLabelText('mutation-status').textContent).toBe('success'),
    );
    expect(screen.getByLabelText('dirty').textContent).toBe('false');
    expect(mutationFn.mock.calls[0]?.[0].tasks[0]?.progress).toBe(0.5);
    expect(client.getQueryData<GanttDocument>(QUERY_KEY)?.tasks[0]?.progress).toBe(0.5);
  });

  it('exposes native query errors and supports TanStack refetch', async () => {
    const user = userEvent.setup();
    const client = createClient();
    const queryFn = vi
      .fn<(context: QueryFunctionContext<typeof QUERY_KEY>) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('Read failed'))
      .mockResolvedValueOnce(apiDocument(0.25));
    render(
      <Providers client={client}>
        <QueryController queryFn={queryFn} />
      </Providers>,
    );

    await waitFor(() => expect(screen.getByLabelText('query-status').textContent).toBe('error'));
    expect(screen.getByLabelText('error').textContent).toBe('Read failed');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByLabelText('query-status').textContent).toBe('success'));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('reports changed query data without replacing a dirty draft', async () => {
    const user = userEvent.setup();
    const client = createClient();
    render(
      <Providers client={client}>
        <QueryController queryFn={async () => apiDocument(0.25)} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByLabelText('query-status').textContent).toBe('success'));
    await user.click(screen.getByRole('button', { name: 'Edit 50' }));

    client.setQueryData(QUERY_KEY, canonicalDocument(0.9));
    await waitFor(() => expect(screen.getByLabelText('remote-update').textContent).toBe('true'));
    expect(screen.getByLabelText('progress').textContent).toBe('0.5');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('progress').textContent).toBe('0.9');
    expect(screen.getByLabelText('dirty').textContent).toBe('false');
  });

  it('keeps edits made during a mutation dirty after that snapshot saves', async () => {
    const user = userEvent.setup();
    const client = createClient();
    let finishSave: (() => void) | undefined;
    const mutationFn = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    render(
      <Providers client={client}>
        <QueryController mutationFn={mutationFn} queryFn={async () => apiDocument(0.25)} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByLabelText('query-status').textContent).toBe('success'));
    await user.click(screen.getByRole('button', { name: 'Edit 50' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByLabelText('mutation-status').textContent).toBe('pending'),
    );
    await user.click(screen.getByRole('button', { name: 'Edit 75' }));
    finishSave?.();

    await waitFor(() =>
      expect(screen.getByLabelText('mutation-status').textContent).toBe('success'),
    );
    expect(screen.getByLabelText('progress').textContent).toBe('0.75');
    expect(screen.getByLabelText('dirty').textContent).toBe('true');
    expect(client.getQueryData<GanttDocument>(QUERY_KEY)?.tasks[0]?.progress).toBe(0.5);
  });

  it('passes TanStack cancellation through the application query function', async () => {
    const client = createClient();
    let signal: AbortSignal | undefined;
    const mounted = render(
      <Providers client={client}>
        <QueryController
          queryFn={async (context) => {
            signal = context.signal;
            return new Promise((_resolve, reject) => {
              context.signal.addEventListener(
                'abort',
                () => reject(new DOMException('Aborted', 'AbortError')),
                { once: true },
              );
            });
          }}
        />
      </Providers>,
    );
    await waitFor(() => expect(signal).toBeDefined());
    mounted.unmount();
    expect(signal?.aborted).toBe(true);
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { parseGanttDocument } from '@gantempo/gantt';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { Playground } from '../Playground';
import { SimpleProjectExample } from '../examples/SimpleProjectExample';
import { SimpleProjectExamplePage } from './SimpleProjectExamplePage';

const apiMocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../examples/simple-project-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../examples/simple-project-api')>();
  return {
    ...actual,
    loadSimpleProject: apiMocks.load,
    saveSimpleProject: apiMocks.save,
  };
});

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function testDocument() {
  const result = parseGanttDocument({
    schemaVersion: 1,
    tasks: [
      {
        id: 'build',
        progress: 0.45,
        schedule: {
          end: '2026-08-20T17:00:00Z',
          mode: 'instant',
          start: '2026-08-10T09:00:00Z',
        },
        title: 'Build the first release',
      },
      {
        appearance: { variant: 'warning' },
        id: 'quality',
        progress: 0.15,
        schedule: {
          end: '2026-08-25T17:00:00Z',
          mode: 'instant',
          start: '2026-08-19T09:00:00Z',
        },
        title: 'Test and polish',
      },
    ],
  });
  if (result.document === undefined) throw new Error('Test fixture must be valid.');
  return result.document;
}

beforeEach(() => {
  apiMocks.load.mockResolvedValue(testDocument());
  apiMocks.save.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});

describe('API-loaded simple project example', () => {
  it('routes to a short accessible guide backed by the working chart', async () => {
    window.history.replaceState({}, '', '/examples/simple-project');
    const mounted = renderWithQuery(<Playground />);

    expect(screen.getByRole('link', { name: 'API Example' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Your first working Gantt chart',
    );
    expect(
      within(screen.getByRole('list', { name: 'Integration steps' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.getByText('simple-project-api.ts')).not.toBeNull();
    expect(screen.getByText('SimpleProjectExample.tsx')).not.toBeNull();
    expect(screen.getByText('vite.config.ts')).not.toBeNull();
    expect(screen.getByText('styles.css')).not.toBeNull();
    expect(screen.getAllByText('View complete file')).toHaveLength(6);
    const sourceBlocks = Array.from(mounted.container.querySelectorAll('code.shiki'));
    const sourceText = sourceBlocks.map((sourceBlock) => sourceBlock.textContent).join('\n');
    expect(sourceBlocks).toHaveLength(6);
    expect(
      sourceBlocks
        .filter((sourceBlock) => sourceBlock.textContent)
        .every((sourceBlock) => sourceBlock.querySelector('[data-shiki-token]')),
    ).toBe(true);
    expect(sourceText).toMatch(/plugins: \[react\(\), tailwindcss\(\)\]/);
    expect(sourceText).toMatch(/useGanttDocumentQuery/);
    expect(sourceText).toMatch(/QueryClientProvider/);
    expect(sourceText).toMatch(/mutationFn: saveSimpleProject/);
    expect(sourceText).toMatch(/method: 'PUT'/);
    expect(sourceText).not.toMatch(/import \{ Playground \}/);
    expect(sourceText).not.toMatch(/AbortSignal|AbortController|DOMException/);
    expect(sourceText).not.toMatch(/appearanceVariants=/);
    expect(mounted.container.querySelector('[class*="simple-project-example"]')).toBeNull();
    expect(await screen.findByRole('region', { name: 'API-loaded project' })).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' }).disabled).toBe(
      true,
    );
    expect((await axe.run(mounted.container)).violations).toEqual([]);
  });

  it('acknowledges a keyboard progress edit and saves through the mutation', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SimpleProjectExamplePage />);
    const task = await screen.findByRole('button', {
      name: /Build the first release.*45% complete/,
    });

    await user.click(task);
    fireEvent.keyDown(task, { key: 'Enter' });
    const dialog = await screen.findByRole('dialog', {
      name: 'Edit Build the first release properties',
    });
    const progress = within(dialog).getByRole('spinbutton', { name: 'Progress (percent)' });
    await user.clear(progress);
    await user.type(progress, '50');
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(screen.getByText('Unsaved changes')).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText('Saved')).not.toBeNull());
    expect(apiMocks.save).toHaveBeenCalledTimes(1);
    expect(apiMocks.save.mock.calls[0]?.[0].tasks).toContainEqual(
      expect.objectContaining({ id: 'build', progress: 0.5 }),
    );
  });

  it('shows a small load error and keeps a failed Save retryable', async () => {
    const user = userEvent.setup();
    apiMocks.load.mockRejectedValueOnce(new Error('Network unavailable'));
    const failedLoad = renderWithQuery(<SimpleProjectExample />);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Network unavailable'),
    );
    failedLoad.unmount();
    renderWithQuery(<SimpleProjectExample />);
    const task = await screen.findByRole('button', {
      name: /Build the first release.*45% complete/,
    });
    await user.click(task);
    fireEvent.keyDown(task, { key: 'Enter' });
    const dialog = await screen.findByRole('dialog', {
      name: 'Edit Build the first release properties',
    });
    const progress = within(dialog).getByRole('spinbutton', { name: 'Progress (percent)' });
    await user.clear(progress);
    await user.type(progress, '50');
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));

    apiMocks.save.mockRejectedValueOnce(new Error('Write failed'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText('Save failed — try again')).not.toBeNull());
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' }).disabled).toBe(
      false,
    );
  });
});

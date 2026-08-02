// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { Playground } from '../Playground';
import { createProjectDocument } from '../project-fixture';
import { SimpleProjectExample } from '../examples/SimpleProjectExample';
import { SimpleProjectExamplePage } from './SimpleProjectExamplePage';

const apiMocks = vi.hoisted(() => ({
  loadProjectPlan: vi.fn(),
  saveProjectPlan: vi.fn(),
}));

vi.mock('../examples/simple-project-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../examples/simple-project-api')>();
  return {
    ...actual,
    loadProjectPlan: apiMocks.loadProjectPlan,
    saveProjectPlan: apiMocks.saveProjectPlan,
  };
});

function testDocument() {
  const document = createProjectDocument();
  return {
    ...document,
    dependencies: document.dependencies.map((dependency) => ({
      ...dependency,
      fromTaskId: dependency.fromTaskId === 'api' ? 'api-integration' : dependency.fromTaskId,
      toTaskId: dependency.toTaskId === 'api' ? 'api-integration' : dependency.toTaskId,
    })),
    tasks: document.tasks.map((task) =>
      task.id === 'api'
        ? { ...task, id: 'api-integration', progress: 0.45, title: 'Connect save workflow' }
        : task,
    ),
  };
}

beforeEach(() => {
  apiMocks.loadProjectPlan.mockResolvedValue(testDocument());
  apiMocks.saveProjectPlan.mockResolvedValue({
    bytes: 1234,
    savedAt: '2026-08-02T12:00:00.000Z',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ schemaVersion: 1, tasks: [] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('API-loaded simple project example', () => {
  it('routes to a complete accessible guide backed by the working chart', async () => {
    window.history.replaceState({}, '', '/examples/simple-project');
    const mounted = render(<Playground />);

    expect(screen.getByRole('link', { name: 'API Example' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Project plan in a real application',
    );
    expect(
      screen.getAllByRole('listitem').filter((item) => item.classList.contains('example-step')),
    ).toHaveLength(5);
    expect(screen.getByText('simple-project-api.ts')).not.toBeNull();
    expect(screen.getByText('SimpleProjectExample.tsx')).not.toBeNull();
    expect(screen.getByText(/export async function loadProjectPlan/)).not.toBeNull();
    expect(await screen.findByRole('region', { name: 'API-loaded launch project' })).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save draft' }).disabled).toBe(
      true,
    );
    expect((await axe.run(mounted.container)).violations).toEqual([]);
  });

  it('acknowledges an edit immediately and explicitly saves the controlled document', async () => {
    const user = userEvent.setup();
    render(<SimpleProjectExamplePage />);
    await screen.findByRole('region', { name: 'API-loaded launch project' });

    await user.click(screen.getByRole('button', { name: 'Advance API step' }));

    await waitFor(() => expect(screen.getByText('Unsaved local changes')).not.toBeNull());
    const saveButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Save draft' });
    expect(saveButton.disabled).toBe(false);
    await user.click(saveButton);

    await waitFor(() =>
      expect(screen.getByText('Saved 1,234 bytes to the in-memory API mock.')).not.toBeNull(),
    );
    expect(apiMocks.saveProjectPlan).toHaveBeenCalledTimes(1);
    expect(apiMocks.saveProjectPlan.mock.calls[0]?.[0].tasks).toContainEqual(
      expect.objectContaining({ id: 'api-integration', progress: 0.55 }),
    );
    expect(saveButton.disabled).toBe(true);
  });

  it('shows a retryable load error and keeps a failed save dirty', async () => {
    const user = userEvent.setup();
    apiMocks.loadProjectPlan
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(testDocument());
    const mounted = render(<SimpleProjectExample />);

    expect((await screen.findByRole('alert')).textContent).toContain('Network unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('region', { name: 'API-loaded launch project' });

    await user.click(screen.getByRole('button', { name: 'Advance API step' }));
    await waitFor(() => expect(screen.getByText('Unsaved local changes')).not.toBeNull());

    apiMocks.saveProjectPlan.mockRejectedValueOnce(new Error('Write failed'));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByText('Save failed: Write failed')).not.toBeNull());
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save draft' }).disabled).toBe(
      false,
    );
    expect(mounted.container.textContent).toContain('Connect save workflow');
  });
});

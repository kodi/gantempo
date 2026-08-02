import { readFile } from 'node:fs/promises';

import { parseGanttDocument } from '@gantempo/gantt';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  loadSimpleProject,
  saveSimpleProject,
  SIMPLE_PROJECT_ENDPOINT,
} from './simple-project-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function readFixture(): Promise<unknown> {
  const source = await readFile(
    new URL('../../public/api/examples/simple-project.json', import.meta.url),
    'utf8',
  );
  return JSON.parse(source);
}

describe('simple project API adapter', () => {
  it('loads ordinary JSON and saves the edited document', async () => {
    const fixture = await readFixture();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return new Response(null, { status: 204 });
      return new Response(JSON.stringify(fixture), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const value = await loadSimpleProject();
    const parsed = parseGanttDocument(value);

    expect(fetchMock).toHaveBeenCalledWith(SIMPLE_PROJECT_ENDPOINT);
    expect(parsed.document?.tasks).toHaveLength(5);
    expect(parsed.document?.dependencies).toHaveLength(2);
    expect(parsed.document?.tasks.every((task) => task.kind === 'task')).toBe(true);
    expect(parsed.document?.tasks.find((task) => task.id === 'quality')?.appearance).toEqual({
      variant: 'warning',
    });
    await saveSimpleProject(parsed.document!);
    expect(fetchMock).toHaveBeenLastCalledWith(
      SIMPLE_PROJECT_ENDPOINT,
      expect.objectContaining({
        body: JSON.stringify(parsed.document),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      }),
    );
  });

  it('reports load and Save errors with the same small API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(new Response('Unavailable', { status: 503 }))),
    );
    await expect(loadSimpleProject()).rejects.toThrow('Project API returned 503.');

    const parsed = parseGanttDocument(await readFixture());
    expect(parsed.document).toBeDefined();
    await expect(saveSimpleProject(parsed.document!)).rejects.toThrow('Project API returned 503.');
  });
});

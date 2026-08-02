import { readFile } from 'node:fs/promises';

import { parseGanttDocument } from '@gantempo/gantt';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { simpleProjectApi, SIMPLE_PROJECT_ENDPOINT } from './simple-project-api';

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
  it('fetches a small API response for the package hook to validate', async () => {
    const fixture = await readFixture();
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify(fixture), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const value = await simpleProjectApi.load(new AbortController().signal, 0);
    const parsed = parseGanttDocument(value);

    expect(fetchMock).toHaveBeenCalledWith(
      SIMPLE_PROJECT_ENDPOINT,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(parsed.document?.tasks).toHaveLength(5);
    expect(parsed.document?.dependencies).toHaveLength(2);
    expect(parsed.document?.tasks.every((task) => task.kind === 'task')).toBe(true);
    expect(parsed.document?.tasks.find((task) => task.id === 'quality')?.appearance).toEqual({
      variant: 'warning',
    });
  });

  it('keeps transport errors in the adapter and Save intentionally small', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(new Response('Unavailable', { status: 503 }))),
    );
    await expect(simpleProjectApi.load(new AbortController().signal, 0)).rejects.toThrow(
      'Project API returned 503.',
    );

    const parsed = parseGanttDocument(await readFixture());
    expect(parsed.document).toBeDefined();
    await expect(simpleProjectApi.save(parsed.document!, 0)).resolves.toBeUndefined();
  });
});

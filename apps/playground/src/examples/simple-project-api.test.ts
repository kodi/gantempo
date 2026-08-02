import { readFile } from 'node:fs/promises';

import { serializeGanttDocument } from '@gantempo/gantt';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { loadProjectPlan, saveProjectPlan, SIMPLE_PROJECT_ENDPOINT } from './simple-project-api';

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
  it('fetches the static endpoint and parses a canonical project document', async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify(await readFixture()), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const document = await loadProjectPlan(undefined, 0);

    expect(fetchMock).toHaveBeenCalledWith(SIMPLE_PROJECT_ENDPOINT, {});
    expect(document.tasks).toHaveLength(9);
    expect(document.dependencies).toHaveLength(5);
    expect(document.tasks.find((task) => task.id === 'release')?.kind).toBe('milestone');
  });

  it('rejects HTTP and fatal document failures before React receives data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(new Response('Unavailable', { status: 503 }))),
    );
    await expect(loadProjectPlan(undefined, 0)).rejects.toThrow('Project API returned 503.');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(JSON.stringify({ schemaVersion: 99 }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        ),
      ),
    );
    await expect(loadProjectPlan(undefined, 0)).rejects.toThrow(
      'Project API returned an invalid document',
    );
  });

  it('serializes the acknowledged document for the explicit mock Save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(JSON.stringify(await readFixture()), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        ),
      ),
    );
    const document = await loadProjectPlan(undefined, 0);

    const receipt = await saveProjectPlan(document, 0);

    expect(receipt.bytes).toBe(
      new TextEncoder().encode(serializeGanttDocument(document)).byteLength,
    );
    expect(Number.isNaN(Date.parse(receipt.savedAt))).toBe(false);
  });
});

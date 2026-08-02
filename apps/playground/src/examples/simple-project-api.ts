import type { GanttDocument } from '@gantempo/gantt';

export const SIMPLE_PROJECT_ENDPOINT = '/api/examples/simple-project.json';

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timeout);
        reject(new DOMException('The request was aborted.', 'AbortError'));
      },
      { once: true },
    );
  });
}

export const simpleProjectApi = Object.freeze({
  async load(signal: AbortSignal, latency = 250): Promise<unknown> {
    await wait(latency, signal);
    const response = await fetch(SIMPLE_PROJECT_ENDPOINT, { signal });
    if (!response.ok) throw new Error(`Project API returned ${response.status}.`);
    return response.json();
  },

  async save(_document: GanttDocument, latency = 450): Promise<void> {
    await wait(latency);
  },
});

import { parseGanttDocument, serializeGanttDocument, type GanttDocument } from '@gantempo/gantt';

export const SIMPLE_PROJECT_ENDPOINT = '/api/examples/simple-project.json';

export interface SimpleProjectSaveReceipt {
  readonly bytes: number;
  readonly savedAt: string;
}

function waitForLatency(milliseconds: number, signal?: AbortSignal): Promise<void> {
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

export async function loadProjectPlan(signal?: AbortSignal, latency = 350): Promise<GanttDocument> {
  await waitForLatency(latency, signal);
  const response = await fetch(SIMPLE_PROJECT_ENDPOINT, signal === undefined ? {} : { signal });
  if (!response.ok) {
    throw new Error(`Project API returned ${response.status}.`);
  }

  const result = parseGanttDocument(await response.json());
  if (result.document === undefined) {
    throw new Error(
      `Project API returned an invalid document: ${
        result.diagnostics[0]?.message ?? 'unknown validation error'
      }`,
    );
  }
  return result.document;
}

export async function saveProjectPlan(
  document: GanttDocument,
  latency = 650,
): Promise<SimpleProjectSaveReceipt> {
  await waitForLatency(latency);
  const body = serializeGanttDocument(document);

  // The playground is static, so this adapter models a successful API write without
  // pretending the JSON fixture can accept PUT requests.
  return Object.freeze({
    bytes: new TextEncoder().encode(body).byteLength,
    savedAt: new Date().toISOString(),
  });
}

import type { GanttDocument } from '@gantempo/gantt';

export const SIMPLE_PROJECT_ENDPOINT = '/api/examples/simple-project.json';

export async function loadSimpleProject(): Promise<unknown> {
  const response = await fetch(SIMPLE_PROJECT_ENDPOINT);
  if (!response.ok) throw new Error(`Project API returned ${response.status}.`);
  return response.json();
}

export async function saveSimpleProject(document: GanttDocument): Promise<void> {
  const response = await fetch(SIMPLE_PROJECT_ENDPOINT, {
    body: JSON.stringify(document),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });
  if (!response.ok) throw new Error(`Project API returned ${response.status}.`);
}

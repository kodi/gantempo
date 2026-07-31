import type { GanttViewDefinition } from './types';

export function sameViewDefinition(
  previous: GanttViewDefinition | undefined,
  next: GanttViewDefinition | undefined,
): boolean {
  if (previous === next) {
    return true;
  }
  const previousView = previous ?? { kind: 'document' as const };
  const nextView = next ?? { kind: 'document' as const };
  if (previousView.kind !== nextView.kind) {
    return false;
  }
  if (previousView.kind === 'project' && nextView.kind === 'project') {
    return previousView.filter === nextView.filter && previousView.sort === nextView.sort;
  }
  return JSON.stringify(previousView) === JSON.stringify(nextView);
}

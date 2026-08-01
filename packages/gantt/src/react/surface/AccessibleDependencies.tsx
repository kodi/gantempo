import type { ReactElement } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttDependencySummary } from '../types';

export function AccessibleDependencies({
  dependencies,
  disabled,
  localization,
  onDelete,
  onInspect,
  onOpenProperties,
  propertiesEnabled,
  scene,
}: {
  readonly dependencies: readonly GanttDependencySummary[];
  readonly disabled: boolean;
  readonly localization: GanttLocalization;
  readonly onDelete: (summary: GanttDependencySummary) => void;
  readonly onInspect: (dependencyId: string) => void;
  readonly onOpenProperties: (dependencyId: string) => void;
  readonly propertiesEnabled: boolean;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): ReactElement | null {
  if (dependencies.length === 0) return null;
  return (
    <section
      aria-label={localization.message('dependency.relationships')}
      className="gt-gantt__sr-only"
      data-gt-part="dependency-summaries"
    >
      <h2>{localization.message('dependency.relationships')}</h2>
      <ul>
        {dependencies.map((summary, index) => (
          <li
            data-dependency-id={summary.dependency.id}
            data-hidden-endpoint={summary.hiddenEndpoint || undefined}
            data-status={summary.status}
            data-visualized={
              scene.dependencyPaths.some(
                (dependency) => dependency.dependencyId === summary.dependency.id,
              ) || undefined
            }
            key={`${summary.dependency.id}:${index}`}
          >
            {summary.fromTitle} to {summary.toTitle},{' '}
            {localization.message(
              `dependency.type.${summary.dependency.type}`,
              undefined,
              summary.dependency.type.replaceAll('-', ' '),
            )}
            {summary.hiddenEndpoint
              ? `, ${localization.message('dependency.hidden-endpoint')}`
              : ''}
            {summary.status === 'invalid' ? `, ${localization.message('dependency.invalid')}` : ''}
            <button onClick={() => onInspect(summary.dependency.id)} type="button">
              {localization.message(
                'dependency.edit',
                { source: summary.fromTitle, target: summary.toTitle },
                'Inspect {source} to {target}',
              )}
            </button>
            {propertiesEnabled ? (
              <button onClick={() => onOpenProperties(summary.dependency.id)} type="button">
                {localization.message(
                  disabled ? 'properties.view' : 'dependency.edit',
                  undefined,
                  disabled ? 'View dependency' : 'Edit dependency',
                )}
              </button>
            ) : null}
            <button disabled={disabled} onClick={() => onDelete(summary)} type="button">
              {localization.message('dependency.delete')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

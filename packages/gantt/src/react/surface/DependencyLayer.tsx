import type { ReactElement } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttDependencySummary, GanttProps } from '../types';
import { DependencyItem } from './DependencyItem';

export function DependencyLayer({
  classNames,
  dependencySummaryById,
  disabled,
  localization,
  markerId,
  onActivate,
  onOpenProperties,
  scene,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly dependencySummaryById: ReadonlyMap<string, GanttDependencySummary>;
  readonly disabled: boolean;
  readonly localization: GanttLocalization;
  readonly markerId: string;
  readonly onActivate: (dependencyId: string) => void;
  readonly onOpenProperties: (dependencyId: string) => void;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): ReactElement {
  return (
    <g data-gt-part="dependencies">
      {scene.dependencyPaths.map((dependency) => (
        <DependencyItem
          classNames={classNames}
          dependency={dependency}
          disabled={disabled}
          key={dependency.dependencyId}
          localization={localization}
          markerId={markerId}
          onActivate={onActivate}
          onOpenProperties={onOpenProperties}
          summary={dependencySummaryById.get(dependency.dependencyId)}
          timelineHeight={scene.bounds.timelineHeight}
        />
      ))}
    </g>
  );
}

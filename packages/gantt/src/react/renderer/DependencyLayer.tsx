import { memo, type ReactElement } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttDependencySummary, GanttProps } from '../types';
import { DependencyItem } from './DependencyItem';

export const DependencyLayer = memo(function DependencyLayer({
  classNames,
  dependencies,
  dependencySummaryById,
  disabled,
  localization,
  markerId,
  onActivate,
  onOpenProperties,
  timelineHeight,
  timelineWidth,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly dependencies: GanttReactRuntimeSnapshot['scene']['dependencyPaths'];
  readonly dependencySummaryById: ReadonlyMap<string, GanttDependencySummary>;
  readonly disabled: boolean;
  readonly localization: GanttLocalization;
  readonly markerId: string;
  readonly onActivate: (dependencyId: string) => void;
  readonly onOpenProperties: (dependencyId: string) => void;
  readonly timelineHeight: number;
  readonly timelineWidth: number;
}): ReactElement {
  return (
    <g data-gt-part="dependencies">
      {dependencies.map((dependency) => (
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
          timelineHeight={timelineHeight}
          timelineWidth={timelineWidth}
        />
      ))}
    </g>
  );
});

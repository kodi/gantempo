import type { ReactElement } from 'react';

import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttLaneSummary, GanttProps } from '../types';
import { appearanceStyle, idleClassState, laneStyle, resolveClassName } from './presentation';

export function LaneTimelineCells({
  classNames,
  disabled,
  laneSummaries,
  scene,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly disabled: boolean;
  readonly laneSummaries: ReadonlyMap<string, GanttLaneSummary>;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): ReactElement {
  return (
    <div aria-hidden="true" className="gt-gantt__timeline-cells">
      {scene.lanes.map((lane) => (
        <div
          className={resolveClassName(
            classNames?.timelineCell,
            idleClassState(disabled, laneSummaries.get(lane.viewKey)!.target),
          )}
          data-gt-part="timeline-cell"
          data-gt-appearance-resolution={lane.appearance?.resolution}
          data-gt-appearance-source={lane.appearance?.source}
          data-gt-variant={lane.appearance?.variant}
          data-view-key={lane.viewKey}
          key={lane.viewKey}
          style={{
            ...laneStyle(lane.y, lane.height, scene.bounds.defaultLaneHeight),
            ...appearanceStyle(lane.appearance),
          }}
        />
      ))}
    </div>
  );
}

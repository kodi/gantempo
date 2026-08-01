import type { ReactElement } from 'react';

import type { GanttReactRuntimeSnapshot } from '../runtime';
import { percent } from './presentation';

export function GridLayer({
  scene,
}: {
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): ReactElement {
  return (
    <g aria-hidden="true" data-gt-part="grid">
      {scene.gridLines.map((line) => (
        <line
          data-tick-kind={line.kind}
          key={line.time}
          x1={percent(line.x)}
          x2={percent(line.x)}
          y1="0"
          y2="100%"
        />
      ))}
      {scene.lanes.map((lane) => (
        <line
          className="gt-gantt__row-separator"
          key={lane.viewKey}
          x1="0"
          x2="100%"
          y1={percent((lane.y + lane.height) / scene.bounds.timelineHeight)}
          y2={percent((lane.y + lane.height) / scene.bounds.timelineHeight)}
        />
      ))}
    </g>
  );
}

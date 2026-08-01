import type { ReactElement } from 'react';

import type { GanttLaneHeaderProps } from '../types';

export function DefaultLaneHeader({ lane }: GanttLaneHeaderProps): ReactElement {
  return (
    <>
      <span aria-hidden="true" className="gt-gantt__lane-marker">
        ·
      </span>
      <span title={lane.title}>{lane.title}</span>
    </>
  );
}

import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';

import type { GanttReactRuntimeSnapshot } from '../runtime';
import { percent } from './presentation';

export function TimeHeader({
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  scene,
}: {
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="gt-gantt__time-header"
      data-gt-part="time-header"
      onLostPointerCapture={onPointerCancel}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {scene.ticks
        .filter((tick) => tick.kind !== 'minor')
        .map((tick) => (
          <span
            data-edge={tick.x < 0.05 ? 'start' : tick.x > 0.95 ? 'end' : undefined}
            key={tick.time}
            style={{ left: percent(tick.x) }}
          >
            {tick.label}
          </span>
        ))}
    </div>
  );
}

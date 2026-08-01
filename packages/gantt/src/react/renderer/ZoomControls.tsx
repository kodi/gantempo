import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactElement } from 'react';

import type { GanttLocalization } from '../../localization/format';
import { adjacentTimeScaleLevel, type GanttTimeScaleLevel } from '../../time/adaptive-scale';

export function ZoomControls({
  localization,
  onFit,
  onZoom,
  scaleLevel,
}: {
  readonly localization: GanttLocalization;
  readonly onFit: () => void;
  readonly onZoom: (level: GanttTimeScaleLevel) => void;
  readonly scaleLevel: GanttTimeScaleLevel;
}): ReactElement {
  return (
    <div
      aria-label="Timeline zoom"
      className="gt-gantt__zoom-controls"
      data-gt-part="zoom-controls"
    >
      <button
        aria-label={localization.message('zoom.in')}
        onClick={() => onZoom(adjacentTimeScaleLevel(scaleLevel, 'in'))}
        type="button"
      >
        <ZoomIn aria-hidden="true" size={15} />
      </button>
      <button
        aria-label={localization.message('zoom.out')}
        onClick={() => onZoom(adjacentTimeScaleLevel(scaleLevel, 'out'))}
        type="button"
      >
        <ZoomOut aria-hidden="true" size={15} />
      </button>
      <button aria-label={localization.message('zoom.fit')} onClick={onFit} type="button">
        <Maximize2 aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

import { memo, type ReactElement, type ReactNode } from 'react';

import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttLaneColumn } from '../types';

const AccessibleLaneRow = memo(function AccessibleLaneRow({
  accessibilityId,
  lane,
  laneIndex,
  ownedTaskIds,
  renderLaneColumn,
  resolvedColumns,
}: {
  readonly accessibilityId: string;
  readonly lane: GanttReactRuntimeSnapshot['scene']['lanes'][number];
  readonly laneIndex: number;
  readonly ownedTaskIds: string | undefined;
  readonly renderLaneColumn: (column: GanttLaneColumn, laneViewKey: string) => ReactNode;
  readonly resolvedColumns: readonly GanttLaneColumn[];
}): ReactElement {
  return (
    <div
      aria-expanded={lane.project?.hasChildren ? lane.project.expanded : undefined}
      aria-level={(lane.project?.depth ?? 0) + 1}
      aria-rowindex={laneIndex + 2}
      id={`${accessibilityId}-row-${laneIndex}`}
      role="row"
    >
      {resolvedColumns.map((column, columnIndex) => (
        <span
          aria-colindex={columnIndex + 1}
          key={column.id}
          role={columnIndex === 0 ? 'rowheader' : 'gridcell'}
        >
          {renderLaneColumn(column, lane.viewKey)}
        </span>
      ))}
      <span
        aria-colindex={resolvedColumns.length + 1}
        aria-label={`${lane.title} timeline`}
        aria-owns={ownedTaskIds}
        role="gridcell"
      />
    </div>
  );
});

export const AccessibleTreeGrid = memo(function AccessibleTreeGrid({
  accessibilityId,
  helpId,
  label,
  renderLaneColumn,
  resolvedColumns,
  scene,
  taskDomIdsByLane,
}: {
  readonly accessibilityId: string;
  readonly helpId: string;
  readonly label: string;
  readonly renderLaneColumn: (column: GanttLaneColumn, laneViewKey: string) => ReactNode;
  readonly resolvedColumns: readonly GanttLaneColumn[];
  readonly scene: GanttReactRuntimeSnapshot['scene'];
  readonly taskDomIdsByLane: ReadonlyMap<string, readonly string[]>;
}): ReactElement {
  return (
    <div
      aria-colcount={resolvedColumns.length + 1}
      aria-describedby={helpId}
      aria-label={`${label} task grid`}
      aria-multiselectable="true"
      aria-rowcount={scene.emptyState ? 2 : scene.lanes.length + 1}
      className="gt-gantt__sr-only"
      role="treegrid"
    >
      <div aria-rowindex={1} role="row">
        {resolvedColumns.map((column, index) => (
          <span aria-colindex={index + 1} key={column.id} role="columnheader">
            {column.header}
          </span>
        ))}
        <span aria-colindex={resolvedColumns.length + 1} role="columnheader">
          Timeline
        </span>
      </div>
      <div role="rowgroup">
        {scene.emptyState ? (
          <div aria-rowindex={2} role="row">
            {resolvedColumns.map((column, index) => (
              <span
                aria-colindex={index + 1}
                key={column.id}
                role={index === 0 ? 'rowheader' : 'gridcell'}
              >
                {index === 0 ? scene.emptyState?.title : null}
              </span>
            ))}
            <span aria-colindex={resolvedColumns.length + 1} role="gridcell">
              {scene.emptyState.description}
            </span>
          </div>
        ) : (
          scene.lanes.map((lane, laneIndex) => (
            <AccessibleLaneRow
              accessibilityId={accessibilityId}
              key={lane.viewKey}
              lane={lane}
              laneIndex={laneIndex}
              ownedTaskIds={taskDomIdsByLane.get(lane.viewKey)?.join(' ') || undefined}
              renderLaneColumn={renderLaneColumn}
              resolvedColumns={resolvedColumns}
            />
          ))
        )}
      </div>
    </div>
  );
});

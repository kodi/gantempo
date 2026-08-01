import { ChevronRight, EllipsisVertical } from 'lucide-react';
import { memo, type ReactElement, type ReactNode } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttLaneColumn, GanttLaneSummary, GanttProps } from '../types';
import {
  appearanceStyle,
  branchTriggerStyle,
  idleClassState,
  joinClasses,
  lanePropertiesTriggerStyle,
  laneStyle,
  resolveClassName,
} from './presentation';

const LaneRow = memo(function LaneRow({
  classNames,
  columnTemplate,
  defaultLaneHeight,
  disabled,
  lane,
  laneSummary,
  propertiesEnabled,
  renderLaneColumn,
  resolvedColumns,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly columnTemplate: string;
  readonly defaultLaneHeight: number;
  readonly disabled: boolean;
  readonly lane: GanttReactRuntimeSnapshot['scene']['lanes'][number];
  readonly laneSummary: GanttLaneSummary;
  readonly propertiesEnabled: boolean;
  readonly renderLaneColumn: (column: GanttLaneColumn, laneViewKey: string) => ReactNode;
  readonly resolvedColumns: readonly GanttLaneColumn[];
}): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={joinClasses(
        'gt-gantt__lane',
        resolveClassName(classNames?.lane, idleClassState(disabled, laneSummary.target)),
      )}
      data-lane-id={lane.laneId}
      data-gt-appearance-resolution={lane.appearance?.resolution}
      data-gt-appearance-source={lane.appearance?.source}
      data-gt-part="lane"
      data-gt-variant={lane.appearance?.variant}
      data-resource-id={lane.resourceId}
      data-view-key={lane.viewKey}
      style={{
        ...laneStyle(lane.y, lane.height, defaultLaneHeight),
        ...appearanceStyle(lane.appearance),
        gridTemplateColumns: columnTemplate,
      }}
    >
      <span aria-hidden="true" className="gt-gantt__lane-accent" data-gt-part="lane-accent" />
      {resolvedColumns.map((column) => (
        <div
          className={joinClasses(
            'gt-gantt__lane-header',
            resolveClassName(classNames?.laneHeader, idleClassState(disabled, laneSummary.target)),
          )}
          data-column-id={column.id}
          data-gt-part="lane-header"
          key={column.id}
          style={
            column.id === resolvedColumns[0]?.id && lane.project !== undefined
              ? { paddingInlineStart: 38 + lane.project.depth * 16 }
              : undefined
          }
        >
          {renderLaneColumn(column, lane.viewKey)}
        </div>
      ))}
      {propertiesEnabled ? (
        <div className="gt-gantt__lane-properties-cell" data-gt-part="lane-properties-cell" />
      ) : null}
    </div>
  );
});

export const LaneGrid = memo(function LaneGrid({
  accessibilityId,
  classNames,
  columnTemplate,
  disabled,
  laneSummaries,
  localization,
  onOpenProperties,
  onToggleProject,
  propertiesEnabled,
  renderLaneColumn,
  resolvedColumns,
  scene,
}: {
  readonly accessibilityId: string;
  readonly classNames?: GanttProps['classNames'];
  readonly columnTemplate: string;
  readonly disabled: boolean;
  readonly laneSummaries: ReadonlyMap<string, GanttLaneSummary>;
  readonly localization: GanttLocalization;
  readonly onOpenProperties: (viewKey: string) => void;
  readonly onToggleProject: (taskId: string, expanded: boolean) => void;
  readonly propertiesEnabled: boolean;
  readonly renderLaneColumn: (column: GanttLaneColumn, laneViewKey: string) => ReactNode;
  readonly resolvedColumns: readonly GanttLaneColumn[];
  readonly scene: GanttReactRuntimeSnapshot['scene'];
}): ReactElement {
  return (
    <div className="gt-gantt__lanes" data-gt-part="lane-list">
      {scene.lanes.map((lane) => (
        <LaneRow
          classNames={classNames}
          columnTemplate={columnTemplate}
          defaultLaneHeight={scene.bounds.defaultLaneHeight}
          disabled={disabled}
          key={lane.viewKey}
          lane={lane}
          laneSummary={laneSummaries.get(lane.viewKey)!}
          propertiesEnabled={propertiesEnabled}
          renderLaneColumn={renderLaneColumn}
          resolvedColumns={resolvedColumns}
        />
      ))}
      {scene.lanes.map((lane, laneIndex) =>
        lane.project?.hasChildren ? (
          <button
            aria-controls={`${accessibilityId}-row-${laneIndex}`}
            aria-expanded={lane.project.expanded}
            aria-label={localization.message(
              lane.project.expanded ? 'tree.collapse' : 'tree.expand',
              { title: lane.title },
            )}
            className={joinClasses(
              'gt-gantt__branch-toggle',
              resolveClassName(
                classNames?.branchToggle,
                idleClassState(disabled, laneSummaries.get(lane.viewKey)!.target),
              ),
            )}
            data-gt-part="branch-toggle"
            data-view-key={lane.viewKey}
            key={`${lane.viewKey}:branch`}
            onClick={() => {
              if (lane.source.kind === 'project-task') {
                onToggleProject(lane.source.taskId, !lane.project?.expanded);
              }
            }}
            style={branchTriggerStyle(lane.y, lane.height, lane.project.depth)}
            type="button"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        ) : null,
      )}
      {propertiesEnabled
        ? scene.lanes.map((lane) =>
            lane.laneId === undefined ? null : (
              <button
                aria-label={`${lane.title} properties`}
                className="gt-gantt__lane-properties-trigger"
                data-gt-part="lane-properties-trigger"
                data-view-key={lane.viewKey}
                key={`${lane.viewKey}:properties`}
                onClick={() => onOpenProperties(lane.viewKey)}
                style={lanePropertiesTriggerStyle(lane.y, lane.height)}
                type="button"
              >
                <EllipsisVertical aria-hidden="true" />
              </button>
            ),
          )
        : null}
    </div>
  );
});

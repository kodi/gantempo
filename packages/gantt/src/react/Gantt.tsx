import { useEffect, useMemo, type CSSProperties, type ReactElement } from 'react';

import type { EntityId, EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import { buildChartScene } from '../render/build-chart-scene';
import type { RenderDiagnostic } from '../render/diagnostics';
import type { TaskBarPrimitive } from '../render/primitives';
import '../styles.css';

export interface GanttProps {
  readonly document: GanttDocument;
  readonly range: TimeRange;
  readonly timeZone: string;
  readonly tickAnchor: EpochMilliseconds;
  readonly tickInterval: number;
  readonly className?: string;
  readonly label?: string;
  readonly locale?: string;
  readonly taskVariants?: Readonly<Record<EntityId, string>>;
  readonly onDiagnostics?: (diagnostics: readonly RenderDiagnostic[]) => void;
}

interface GanttRootStyle extends CSSProperties {
  readonly '--gt-lane-column-width': string;
  readonly '--gt-lane-count': number;
}

function percent(value: number): string {
  return `${value * 100}%`;
}

function taskAccessibleName(task: TaskBarPrimitive, formatter: Intl.DateTimeFormat): string {
  return `${task.title}, ${formatter.format(task.start)} to ${formatter.format(task.end)}`;
}

export function Gantt({
  document,
  range,
  timeZone,
  tickAnchor,
  tickInterval,
  className,
  label = 'Gantt chart',
  locale = 'en-US',
  taskVariants,
  onDiagnostics,
}: GanttProps): ReactElement {
  const scene = useMemo(
    () =>
      buildChartScene({
        document,
        range,
        tickAnchor,
        tickInterval,
        timeZone,
        locale,
      }),
    [document, locale, range, tickAnchor, tickInterval, timeZone],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      }),
    [locale, timeZone],
  );
  useEffect(() => {
    onDiagnostics?.(scene.diagnostics);
  }, [onDiagnostics, scene.diagnostics]);

  const classes = ['gt-gantt', className].filter(Boolean).join(' ');
  const style: GanttRootStyle = {
    '--gt-lane-column-width': `${scene.bounds.laneColumnWidth}px`,
    '--gt-lane-count': scene.lanes.length,
  };

  return (
    <div
      aria-label={label}
      className={classes}
      data-diagnostic-count={scene.diagnostics.length}
      data-gantempo=""
      data-gt-part="root"
      role="region"
      style={style}
    >
      <div className="gt-gantt__table" data-gt-part="chart">
        <div className="gt-gantt__corner" data-gt-part="corner">
          Work item
        </div>
        <div className="gt-gantt__time-header" data-gt-part="time-header">
          {scene.ticks.map((tick) => (
            <span
              data-edge={tick.x < 0.05 ? 'start' : tick.x > 0.95 ? 'end' : undefined}
              key={tick.time}
              style={{ left: percent(tick.x) }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {scene.emptyState ? (
          <div className="gt-gantt__empty" data-gt-part="empty-state">
            <strong>{scene.emptyState.title}</strong>
            <span>{scene.emptyState.description}</span>
          </div>
        ) : (
          <>
            <div className="gt-gantt__lanes" data-gt-part="lane-list">
              {scene.lanes.map((lane) => (
                <div
                  className="gt-gantt__lane"
                  data-lane-id={lane.laneId}
                  data-gt-part="lane"
                  key={lane.laneId}
                >
                  <span aria-hidden="true" className="gt-gantt__lane-marker">
                    ·
                  </span>
                  <span title={lane.title}>{lane.title}</span>
                </div>
              ))}
            </div>

            <div className="gt-gantt__timeline" data-gt-part="timeline">
              <svg aria-label="Scheduled tasks" role="group">
                <g aria-hidden="true" data-gt-part="grid">
                  {scene.gridLines.map((line) => (
                    <line
                      key={line.time}
                      x1={percent(line.x)}
                      x2={percent(line.x)}
                      y1="0"
                      y2="100%"
                    />
                  ))}
                  {scene.lanes.map((lane, index) => (
                    <line
                      className="gt-gantt__row-separator"
                      key={lane.laneId}
                      x1="0"
                      x2="100%"
                      y1={percent((index + 1) / scene.lanes.length)}
                      y2={percent((index + 1) / scene.lanes.length)}
                    />
                  ))}
                </g>

                {scene.taskBars.map((task) => {
                  const accessibleName = taskAccessibleName(task, dateFormatter);
                  const variant = taskVariants?.[task.taskId];

                  return (
                    <g
                      aria-label={accessibleName}
                      data-clipped-end={task.clippedEnd || undefined}
                      data-clipped-start={task.clippedStart || undefined}
                      data-gt-part="task"
                      data-gt-variant={variant}
                      data-lane-id={task.laneId}
                      data-placement-id={task.placementId}
                      data-task-id={task.taskId}
                      key={task.placementId}
                      role="img"
                    >
                      <title>{accessibleName}</title>
                      <rect
                        className="gt-gantt__task-bar"
                        height={percent(task.height / scene.bounds.timelineHeight)}
                        rx="6"
                        width={percent(task.width)}
                        x={percent(task.x)}
                        y={percent(task.y / scene.bounds.timelineHeight)}
                      />
                      <foreignObject
                        height={percent(task.height / scene.bounds.timelineHeight)}
                        width={percent(task.width)}
                        x={percent(task.x)}
                        y={percent(task.y / scene.bounds.timelineHeight)}
                      >
                        <div className="gt-gantt__task-label">
                          <span>{task.title}</span>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

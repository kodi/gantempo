import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from 'react';
import { memo } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { TaskBarPrimitive } from '../../render/primitives';
import { useGanttSelector } from '../context';
import { DefaultTaskContent } from '../surfaces';
import type { GanttClassNameState, GanttProps } from '../types';
import {
  appearanceStyle,
  clippedBarGeometry,
  joinClasses,
  percent,
  progressEndpointX,
  resolveClassName,
  TASK_BAR_RADIUS,
  targetStateEqual,
  targetsInteraction,
  taskAccessibleName,
  taskSummary,
} from './presentation';

export const TaskItem = memo(function TaskItem({
  classNames,
  direction,
  describedBy,
  disabled,
  domId,
  onActivate,
  onContextMenu,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  onLinkPointerDown,
  linkEnabled,
  localization,
  slots,
  task,
  progressEditable,
  tabIndex,
  timelineHeight,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly direction: 'ltr' | 'rtl';
  readonly describedBy: string;
  readonly disabled: boolean;
  readonly domId: string;
  readonly onActivate: (task: TaskBarPrimitive) => void;
  readonly onContextMenu: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onFocus: (event: ReactFocusEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onMouseEnter: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onMouseLeave: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onLinkPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    task: TaskBarPrimitive,
  ) => void;
  readonly linkEnabled: boolean;
  readonly localization: GanttLocalization;
  readonly slots?: GanttProps['slots'];
  readonly task: TaskBarPrimitive;
  readonly progressEditable: boolean;
  readonly tabIndex: -1 | 0;
  readonly timelineHeight: number;
}): ReactElement {
  const [selected, focused, pressing, dragging, resizing, progressing, pending, rejected] =
    useGanttSelector((snapshot) => {
      const targeted = targetsInteraction(snapshot.interaction, task.viewKey);
      return [
        snapshot.session.selection.some(
          (target) => target.kind === 'task' && target.viewKey === task.viewKey,
        ),
        snapshot.session.focused?.kind === 'task' &&
          snapshot.session.focused.viewKey === task.viewKey,
        targeted && snapshot.interaction.status === 'pressing',
        targeted &&
          (snapshot.interaction.status === 'dragging' ||
            (snapshot.interaction.status === 'keyboard' && snapshot.interaction.action === 'move')),
        targeted &&
          (snapshot.interaction.status === 'resizing' ||
            (snapshot.interaction.status === 'keyboard' &&
              snapshot.interaction.action === 'resize')),
        targeted &&
          (snapshot.interaction.status === 'progressing' ||
            (snapshot.interaction.status === 'keyboard' &&
              snapshot.interaction.action === 'progress')),
        targeted && snapshot.interaction.status === 'pending',
        targeted && snapshot.interaction.status === 'rejected',
      ] as const;
    }, targetStateEqual);
  const accessibleName = taskAccessibleName(task, localization);
  const summary = taskSummary(task);
  const appearance = task.appearance;
  const state = Object.freeze({
    disabled,
    dragging,
    focused,
    invalid: rejected,
    pending,
    progressing,
    resizing,
    selected,
    target: summary.target,
  }) satisfies GanttClassNameState;
  const TaskContent = slots?.TaskContent ?? DefaultTaskContent;
  const geometry = task.presentation.geometry;
  const ordinaryTask = geometry.kind === 'bar';
  const trackGeometry = clippedBarGeometry(
    task.x,
    task.width,
    direction,
    ordinaryTask && task.clippedStart,
    ordinaryTask && task.clippedEnd,
  );
  const progressGeometry =
    task.progress === undefined
      ? undefined
      : clippedBarGeometry(
          task.progress.x,
          task.progress.width,
          direction,
          ordinaryTask && task.clippedStart,
          ordinaryTask && task.clippedEnd && task.progress.width === task.width,
        );
  const progressHandleX = progressEndpointX(task, direction);
  const trackClass = joinClasses(
    geometry.kind === 'summary'
      ? 'gt-gantt__task-summary'
      : geometry.kind === 'milestone'
        ? 'gt-gantt__task-milestone'
        : 'gt-gantt__task-bar',
    resolveClassName(
      geometry.kind === 'summary'
        ? classNames?.summary
        : geometry.kind === 'milestone'
          ? classNames?.milestone
          : undefined,
      state,
    ),
  );
  return (
    <g
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End Space Enter L M P S E N Delete Backspace Control+Z Meta+Z Control+Y Meta+Shift+Z"
      aria-label={accessibleName}
      aria-pressed={selected}
      className={resolveClassName(classNames?.task, state)}
      data-assignment-id={task.assignmentId}
      data-clipped-end={task.clippedEnd || undefined}
      data-clipped-start={task.clippedStart || undefined}
      data-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      data-focused={focused || undefined}
      data-pending={pending || undefined}
      data-progressing={progressing || undefined}
      data-pressing={pressing || undefined}
      data-rejected={rejected || undefined}
      data-resizing={resizing || undefined}
      data-gt-part="task"
      data-gt-appearance-resolution={appearance?.resolution}
      data-gt-appearance-source={appearance?.source}
      data-gt-variant={appearance?.variant}
      data-lane-id={task.laneId}
      data-task-kind={task.presentation.kind}
      data-lane-view-key={task.laneViewKey}
      data-placement-id={task.placementId}
      data-resource-id={task.resourceId}
      data-segment-id={task.segmentId}
      data-selected={selected || undefined}
      data-task-id={task.taskId}
      data-view-key={task.viewKey}
      focusable="true"
      id={domId}
      onClick={() => onActivate(task)}
      onContextMenu={(event) => onContextMenu(event, task)}
      onFocus={(event) => onFocus(event, task)}
      onMouseEnter={(event) => onMouseEnter(event, task)}
      onMouseLeave={(event) => onMouseLeave(event, task)}
      role="button"
      style={appearanceStyle(appearance)}
      tabIndex={tabIndex}
    >
      {geometry.kind === 'milestone' ? (
        <rect
          className={trackClass}
          data-gt-part="milestone"
          height={geometry.size}
          width={geometry.size}
          x={percent(geometry.centerX)}
          y={percent((task.y + task.height / 2) / timelineHeight)}
          style={{
            transform: `translate(${-geometry.size / 2}px, ${-geometry.size / 2}px) rotate(45deg) scale(0.72)`,
          }}
        />
      ) : (
        <rect
          className={trackClass}
          data-gt-part={geometry.kind === 'summary' ? 'summary' : 'task-track'}
          height={percent(
            (geometry.kind === 'summary' ? geometry.capHeight : task.height) / timelineHeight,
          )}
          rx={geometry.kind === 'summary' ? undefined : TASK_BAR_RADIUS}
          width={geometry.kind === 'summary' ? percent(task.width) : trackGeometry.width}
          x={geometry.kind === 'summary' ? percent(task.x) : trackGeometry.x}
          y={percent(
            (geometry.kind === 'summary'
              ? task.y + (task.height - geometry.capHeight) / 2
              : task.y) / timelineHeight,
          )}
        />
      )}
      {task.progress !== undefined && task.progress.width > 0 ? (
        <rect
          aria-hidden="true"
          className="gt-gantt__task-progress"
          data-gt-part="task-progress"
          data-progress={task.progress.value}
          height={percent(
            (geometry.kind === 'summary' ? geometry.capHeight : task.height) / timelineHeight,
          )}
          rx={geometry.kind === 'summary' ? undefined : TASK_BAR_RADIUS}
          width={
            geometry.kind === 'summary' ? percent(task.progress.width) : progressGeometry?.width
          }
          x={geometry.kind === 'summary' ? percent(task.progress.x) : progressGeometry?.x}
          y={percent(
            (geometry.kind === 'summary'
              ? task.y + (task.height - geometry.capHeight) / 2
              : task.y) / timelineHeight,
          )}
        />
      ) : null}
      <foreignObject
        height={percent(task.height / timelineHeight)}
        width={geometry.kind === 'milestone' ? '120' : percent(task.width)}
        x={
          geometry.kind === 'milestone'
            ? direction === 'rtl'
              ? `calc(${percent(geometry.centerX)} - ${geometry.size / 2 + 124}px)`
              : `calc(${percent(geometry.centerX)} + ${geometry.size / 2 + 4}px)`
            : percent(task.x)
        }
        y={percent(task.y / timelineHeight)}
      >
        <div
          className={joinClasses(
            'gt-gantt__task-label',
            resolveClassName(classNames?.taskContent, state),
          )}
          data-gt-part="task-content"
        >
          <TaskContent {...state} task={summary} />
        </div>
      </foreignObject>
      {linkEnabled ? (
        <>
          <circle
            aria-hidden="true"
            className="gt-gantt__link-handle-hit"
            cx={`calc(${percent(
              geometry.kind === 'milestone'
                ? geometry.centerX
                : direction === 'rtl'
                  ? task.x
                  : task.x + task.width,
            )} ${direction === 'rtl' ? '-' : '+'} 10px)`}
            cy={percent((task.y + task.height / 2) / timelineHeight)}
            data-gt-part="link-handle-hit-target"
            onPointerDown={(event) => onLinkPointerDown(event, task)}
            r="22"
          />
          <circle
            aria-hidden="true"
            className={joinClasses(
              'gt-gantt__link-handle',
              resolveClassName(classNames?.linkHandle, state),
            )}
            cx={`calc(${percent(
              geometry.kind === 'milestone'
                ? geometry.centerX
                : direction === 'rtl'
                  ? task.x
                  : task.x + task.width,
            )} ${direction === 'rtl' ? '-' : '+'} 10px)`}
            cy={percent((task.y + task.height / 2) / timelineHeight)}
            data-gt-part="link-handle"
            pointerEvents="none"
            r="4"
          />
        </>
      ) : null}
      {ordinaryTask ? (
        <rect
          aria-hidden="true"
          className={resolveClassName(classNames?.resizeHandle, state)}
          data-edge="start"
          data-gt-part="resize-handle"
          height={percent(task.height / timelineHeight)}
          width="8"
          x={percent(direction === 'rtl' ? task.x + task.width : task.x)}
          y={percent(task.y / timelineHeight)}
        />
      ) : null}
      {progressEditable ? (
        <>
          <rect
            aria-hidden="true"
            data-gt-part="progress-hit-target"
            data-progress={task.progress?.value ?? 0}
            height={percent(task.height / timelineHeight)}
            width="12"
            x={percent(progressHandleX)}
            y={percent(task.y / timelineHeight)}
          />
          <rect
            aria-hidden="true"
            className={resolveClassName(classNames?.progressHandle, state)}
            data-gt-part="progress-handle"
            data-progress={task.progress?.value ?? 0}
            height={percent(task.height / timelineHeight)}
            width="2"
            x={percent(progressHandleX)}
            y={percent(task.y / timelineHeight)}
          />
        </>
      ) : null}
      {ordinaryTask ? (
        <rect
          aria-hidden="true"
          className={resolveClassName(classNames?.resizeHandle, state)}
          data-edge="end"
          data-gt-part="resize-handle"
          height={percent(task.height / timelineHeight)}
          width="8"
          x={percent(direction === 'rtl' ? task.x : task.x + task.width)}
          y={percent(task.y / timelineHeight)}
        />
      ) : null}
    </g>
  );
});

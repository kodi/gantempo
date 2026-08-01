import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { TaskBarPrimitive } from '../../render/primitives';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttProps } from '../types';
import { joinClasses } from './presentation';
import { TaskItem } from './TaskItem';

export function TaskLayer({
  classNames,
  disabled,
  helpId,
  linkEnabled,
  localization,
  onActivate,
  onContextMenu,
  onFocus,
  onLinkPointerDown,
  onMouseEnter,
  onMouseLeave,
  progressEditableTaskIds,
  rovingViewKey,
  scene,
  slots,
  taskDomIds,
  tooltipId,
  tooltipViewKey,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly disabled: boolean;
  readonly helpId: string;
  readonly linkEnabled: boolean;
  readonly localization: GanttLocalization;
  readonly onActivate: (task: TaskBarPrimitive) => void;
  readonly onContextMenu: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onFocus: (event: ReactFocusEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onLinkPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    task: TaskBarPrimitive,
  ) => void;
  readonly onMouseEnter: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onMouseLeave: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly progressEditableTaskIds: ReadonlySet<string>;
  readonly rovingViewKey: string | undefined;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
  readonly slots?: GanttProps['slots'];
  readonly taskDomIds: ReadonlyMap<string, string>;
  readonly tooltipId: string;
  readonly tooltipViewKey: string | undefined;
}): ReactElement {
  return (
    <>
      {scene.taskBars.map((task) => (
        <TaskItem
          classNames={classNames}
          direction={localization.direction}
          describedBy={joinClasses(
            helpId,
            tooltipViewKey === task.viewKey ? tooltipId : undefined,
          )!}
          disabled={disabled}
          domId={taskDomIds.get(task.viewKey)!}
          key={task.viewKey}
          linkEnabled={linkEnabled}
          localization={localization}
          onActivate={onActivate}
          onContextMenu={onContextMenu}
          onFocus={onFocus}
          onLinkPointerDown={onLinkPointerDown}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          progressEditable={progressEditableTaskIds.has(task.taskId)}
          slots={slots}
          task={task}
          tabIndex={task.viewKey === rovingViewKey ? 0 : -1}
          timelineHeight={scene.bounds.timelineHeight}
        />
      ))}
    </>
  );
}

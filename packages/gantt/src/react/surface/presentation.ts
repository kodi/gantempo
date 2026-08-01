import type { CSSProperties } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { EffectiveAppearancePrimitive, GanttAppearanceToken } from '../../render/appearance';
import type { TaskBarPrimitive } from '../../render/primitives';
import type { GanttReactRuntimeSnapshot } from '../runtime';
import type {
  GanttClassNameState,
  GanttClassNameValue,
  GanttInteractionState,
  GanttLaneSummary,
  GanttTaskSummary,
} from '../types';

type GanttLaneStyle = CSSProperties & {
  readonly '--gt-lane-height-ratio': number;
};

type GanttAppearanceStyle = CSSProperties &
  Partial<
    Readonly<
      Record<
        | '--gt-lane-accent'
        | '--gt-lane-surface'
        | '--gt-task-border'
        | '--gt-task-fill'
        | '--gt-task-progress-fill'
        | '--gt-task-text',
        number | string
      >
    >
  >;

const APPEARANCE_PROPERTIES: Readonly<Record<GanttAppearanceToken, string>> = {
  'lane.accent': '--gt-lane-accent',
  'lane.surface': '--gt-lane-surface',
  'task.border': '--gt-task-border',
  'task.fill': '--gt-task-fill',
  'task.progressFill': '--gt-task-progress-fill',
  'task.text': '--gt-task-text',
};

export function percent(value: number): string {
  return `${value * 100}%`;
}

export const TASK_BAR_RADIUS = 6;

// SVG rects cannot square only one corner pair, so move a clipped rounded cap
// beyond the viewport and let the timeline's existing overflow clip flatten it.
export function clippedBarGeometry(
  x: number,
  width: number,
  direction: 'ltr' | 'rtl',
  clippedStart: boolean,
  clippedEnd: boolean,
): { readonly width: string; readonly x: string } {
  const clippedLeft = direction === 'rtl' ? clippedEnd : clippedStart;
  const clippedRight = direction === 'rtl' ? clippedStart : clippedEnd;
  const extension = Number(clippedLeft) + Number(clippedRight);
  return {
    width:
      extension === 0
        ? percent(width)
        : `calc(${percent(width)} + ${extension * TASK_BAR_RADIUS}px)`,
    x: clippedLeft ? `calc(${percent(x)} - ${TASK_BAR_RADIUS}px)` : percent(x),
  };
}

export function progressEndpointX(task: TaskBarPrimitive, direction: 'ltr' | 'rtl'): number {
  if (task.progress === undefined) {
    return direction === 'rtl' ? task.x + task.width : task.x;
  }
  return direction === 'rtl' ? task.progress.x : task.progress.x + task.progress.width;
}

export function laneStyle(y: number, height: number, defaultHeight: number): GanttLaneStyle {
  return {
    '--gt-lane-height-ratio': height / defaultHeight,
    height,
    position: 'absolute',
    top: y,
  } as GanttLaneStyle;
}

export function lanePropertiesTriggerStyle(y: number, laneHeight: number): CSSProperties {
  const height = Math.min(28, Math.max(24, laneHeight - 12));
  return {
    height,
    top: y + (laneHeight - height) / 2,
  };
}

export function branchTriggerStyle(y: number, laneHeight: number, depth: number): CSSProperties {
  const height = Math.min(28, Math.max(24, laneHeight - 12));
  return {
    height,
    left: 8 + depth * 16,
    top: y + (laneHeight - height) / 2,
  };
}

export function appearanceStyle(
  appearance: EffectiveAppearancePrimitive | undefined,
): GanttAppearanceStyle | undefined {
  if (appearance === undefined || Object.keys(appearance.tokens).length === 0) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(appearance.tokens).map(([token, value]) => [
      APPEARANCE_PROPERTIES[token as GanttAppearanceToken],
      value,
    ]),
  ) as GanttAppearanceStyle;
}

export function joinClasses(...values: readonly (string | undefined)[]): string | undefined {
  const classes = values.filter((value): value is string => value !== undefined && value !== '');
  return classes.length === 0 ? undefined : classes.join(' ');
}

export function resolveClassName(
  value: GanttClassNameValue | undefined,
  state: GanttClassNameState,
): string | undefined {
  return typeof value === 'function' ? value(state) : value;
}

export function taskTarget(task: TaskBarPrimitive) {
  return Object.freeze({
    ...(task.assignmentId === undefined ? {} : { assignmentId: task.assignmentId }),
    kind: 'task' as const,
    ...(task.laneId === undefined ? {} : { laneId: task.laneId }),
    laneViewKey: task.laneViewKey,
    ...(task.placementId === undefined ? {} : { placementId: task.placementId }),
    ...(task.resourceId === undefined ? {} : { resourceId: task.resourceId }),
    ...(task.segmentId === undefined ? {} : { segmentId: task.segmentId }),
    taskId: task.taskId,
    viewKey: task.viewKey,
  });
}

export function inspectionSelectionKey(
  selection: GanttReactRuntimeSnapshot['selector']['session']['selection'],
): string {
  return JSON.stringify(
    selection.map((target) =>
      target.kind === 'task'
        ? ['task', target.viewKey]
        : target.kind === 'dependency'
          ? ['dependency', target.dependencyId]
          : ['lane', target.viewKey],
    ),
  );
}

export function taskSummary(task: TaskBarPrimitive): GanttTaskSummary {
  const project = task.presentation.project;
  const summary = task.presentation.summary;
  return Object.freeze({
    ...(project?.depth === undefined ? {} : { depth: project.depth }),
    ...(summary === undefined ? {} : { descendantCount: summary.descendantCount }),
    end: task.end,
    ...(project?.expanded === undefined ? {} : { expanded: project.expanded }),
    ...(project?.filterMatch === undefined ? {} : { filterMatch: project.filterMatch }),
    ...(project?.hasChildren === undefined ? {} : { hasChildren: project.hasChildren }),
    intervalSource: task.presentation.intervalSource,
    kind: task.presentation.kind,
    ...(task.progress === undefined ? {} : { progress: task.progress.value }),
    ...(summary === undefined ? {} : { resolvedDescendantCount: summary.resolvedDescendantCount }),
    start: task.start,
    target: taskTarget(task),
    title: task.title,
    ...(summary === undefined
      ? {}
      : { unresolvedDescendantCount: summary.unresolvedDescendantCount }),
    ...(task.appearance?.variant === undefined ? {} : { variant: task.appearance.variant }),
  });
}

export function laneSummary(
  lane: GanttReactRuntimeSnapshot['scene']['lanes'][number],
): GanttLaneSummary {
  return Object.freeze({
    ...(lane.project?.depth === undefined ? {} : { depth: lane.project.depth }),
    ...(lane.project?.expanded === undefined ? {} : { expanded: lane.project.expanded }),
    ...(lane.project?.filterMatch === undefined ? {} : { filterMatch: lane.project.filterMatch }),
    ...(lane.project?.hasChildren === undefined ? {} : { hasChildren: lane.project.hasChildren }),
    target: Object.freeze({
      kind: 'lane' as const,
      ...(lane.laneId === undefined ? {} : { laneId: lane.laneId }),
      ...(lane.resourceId === undefined ? {} : { resourceId: lane.resourceId }),
      viewKey: lane.viewKey,
    }),
    title: lane.title,
  });
}

export function idleClassState(
  disabled: boolean,
  target?: GanttClassNameState['target'],
): GanttClassNameState {
  return Object.freeze({
    disabled,
    dragging: false,
    focused: false,
    invalid: false,
    pending: false,
    progressing: false,
    resizing: false,
    selected: false,
    ...(target === undefined ? {} : { target }),
  });
}

export function taskAccessibleName(
  task: TaskBarPrimitive,
  localization: GanttLocalization,
): string {
  const kind = task.presentation.kind;
  const schedule =
    kind === 'milestone'
      ? localization.dateTime(task.start, 'task-start')
      : `${localization.dateTime(task.start, 'task-start')} to ${localization.dateTime(task.end, 'task-end')}`;
  const project = task.presentation.project;
  const hierarchy =
    project === undefined
      ? ''
      : `, level ${project.depth + 1}${
          project.hasChildren ? `, ${project.expanded ? 'expanded' : 'collapsed'}` : ''
        }`;
  const counts = task.presentation.summary;
  const detail =
    counts === undefined
      ? ''
      : `, ${counts.resolvedDescendantCount} of ${counts.descendantCount} descendants scheduled`;
  const progress =
    task.progress === undefined
      ? ''
      : `, ${localization.message('task.progress', {
          progress: `${localization.number(Math.round(task.progress.value * 100), 'progress')}%`,
        })}`;
  return `${task.title}, ${schedule}${
    kind === 'task' ? '' : `, ${localization.message(`task.kind.${kind}`)}`
  }${hierarchy}${detail}${progress}`;
}

export function targetStateEqual(
  previous: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean],
  next: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean],
): boolean {
  return previous.every((value, index) => value === next[index]);
}

export function targetsInteraction(interaction: GanttInteractionState, viewKey: string): boolean {
  return (
    'target' in interaction &&
    interaction.target?.kind === 'task' &&
    interaction.target.viewKey === viewKey
  );
}

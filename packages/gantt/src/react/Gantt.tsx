import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type ForwardRefExoticComponent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical } from 'lucide-react';

import type { GanttCommand } from '../commands/types';
import {
  normalizeNavigationDelta,
  type NavigationDeltaUnit,
} from '../interaction/viewport-navigation';
import {
  createAppearanceRegistry,
  type EffectiveAppearancePrimitive,
  type GanttAppearanceToken,
} from '../render/appearance';
import type { LaneRowPrimitive, TaskBarPrimitive } from '../render/primitives';
import { GanttRuntimeProvider, useGanttSelector } from './context';
import {
  createGanttReactRuntime,
  type GanttKeyboardAction,
  type GanttReactRuntime,
  type GanttReactRuntimeSnapshot,
} from './runtime';
import {
  DefaultContextMenu,
  DefaultItemProperties,
  DefaultLaneHeader,
  DefaultTaskContent,
  DefaultTaskEditor,
  DefaultTooltip,
} from './surfaces';
import type {
  GanttClassNameState,
  GanttClassNameValue,
  GanttContextMenuItem,
  GanttHandle,
  GanttInteractionState,
  GanttItemPropertiesValue,
  GanttLaneColumn,
  GanttLaneSummary,
  GanttOverlayContainer,
  GanttProps,
  GanttTaskEditorValue,
  GanttTaskSummary,
} from './types';
import '../styles.css';

export type { GanttHandle, GanttProps } from './types';

interface GanttRootStyle extends CSSProperties {
  readonly '--gt-lane-column-width': string;
  readonly '--gt-timeline-height': string;
  readonly '--gt-timeline-height-ratio': number;
}

interface TaskOverlayPosition {
  // Collision measurement runs after the surface exists and only once per opening.
  readonly adjusted?: boolean;
  readonly viewKey: string;
  readonly x: number;
  readonly y: number;
}

interface EditorOverlay {
  readonly error?: string;
  readonly kind: 'lane' | 'task';
  readonly mode: 'legacy' | 'properties';
  readonly pending: boolean;
  readonly selectionKey?: string;
  readonly viewKey: string;
}

type OverlayBoundary = 'root' | 'viewport';

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

const LANE_PROPERTIES_COLUMN_WIDTH = 44;

const OVERLAY_SAFE_AREA = 8;
const THEME_PROPERTIES = [
  '--gt-color-border',
  '--gt-color-empty',
  '--gt-color-focus',
  '--gt-color-grid',
  '--gt-color-surface',
  '--gt-color-surface-muted',
  '--gt-color-task',
  '--gt-color-task-text',
  '--gt-color-text',
  '--gt-color-text-muted',
  '--gt-header-height',
  '--gt-row-height',
  '--gt-z-overlay',
] as const;

const DEVELOPMENT =
  (import.meta as ImportMeta & { readonly env?: { readonly DEV?: boolean } }).env?.DEV === true;

const WHEEL_LINE_SIZE = 16;
const MEANINGFUL_WHEEL_DELTA = 0.5;

function wheelDeltaUnit(deltaMode: number): NavigationDeltaUnit {
  return deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 'line'
    : deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? 'page'
      : 'pixel';
}

function excludesChartWheel(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, button, a[href], [contenteditable="true"], [data-gt-part="overlay-host"]',
    ) !== null
  );
}

function resolveOverlayTarget(
  container: GanttOverlayContainer | undefined,
  root: HTMLElement,
): Element | DocumentFragment | null {
  const resolved = typeof container === 'function' ? container() : container;
  if (resolved === 'root') {
    return null;
  }
  if (resolved === undefined || resolved === 'document') {
    return root.ownerDocument.body;
  }
  return resolved;
}

function syncOverlayTheme(root: HTMLElement, host: HTMLElement): void {
  const view = root.ownerDocument.defaultView;
  if (view === null) {
    return;
  }
  const computed = view.getComputedStyle(root);
  // A body-level portal leaves the root's inheritance tree, so mirror only the
  // instance-scoped theme contract and typography onto its owned wrapper.
  const properties = new Set<string>(THEME_PROPERTIES);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (property.startsWith('--gt-')) {
      properties.add(property);
    }
  }
  for (const property of properties) {
    const value = computed.getPropertyValue(property);
    if (value !== '') {
      host.style.setProperty(property, value);
    }
  }
  host.style.fontFamily = computed.fontFamily;
  host.style.fontSize = computed.fontSize;
  host.style.lineHeight = computed.lineHeight;
}

function adjustedOverlayPosition(
  position: TaskOverlayPosition,
  surface: HTMLElement,
  host: HTMLElement,
  boundary: OverlayBoundary,
): TaskOverlayPosition {
  const surfaceRect = surface.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const view = host.ownerDocument.defaultView;
  const hasMeasuredHost = hostRect.width > 0 && hostRect.height > 0;
  const bounds =
    boundary === 'viewport'
      ? {
          bottom: hasMeasuredHost ? hostRect.bottom : (view?.innerHeight ?? hostRect.bottom),
          left: hasMeasuredHost ? hostRect.left : 0,
          right: hasMeasuredHost ? hostRect.right : (view?.innerWidth ?? hostRect.right),
          top: hasMeasuredHost ? hostRect.top : 0,
        }
      : hostRect;
  let x = position.x;
  let y = position.y;
  if (surfaceRect.right > bounds.right - OVERLAY_SAFE_AREA) {
    x -= surfaceRect.right - (bounds.right - OVERLAY_SAFE_AREA);
  }
  if (surfaceRect.left < bounds.left + OVERLAY_SAFE_AREA) {
    x += bounds.left + OVERLAY_SAFE_AREA - surfaceRect.left;
  }
  if (surfaceRect.bottom > bounds.bottom - OVERLAY_SAFE_AREA) {
    y -= surfaceRect.bottom - (bounds.bottom - OVERLAY_SAFE_AREA);
  }
  if (surfaceRect.top < bounds.top + OVERLAY_SAFE_AREA) {
    y += bounds.top + OVERLAY_SAFE_AREA - surfaceRect.top;
  }
  return {
    ...position,
    adjusted: true,
    x: Math.max(OVERLAY_SAFE_AREA, x),
    y: Math.max(OVERLAY_SAFE_AREA, y),
  };
}

function percent(value: number): string {
  return `${value * 100}%`;
}

function laneStyle(y: number, height: number, defaultHeight: number): GanttLaneStyle {
  return {
    '--gt-lane-height-ratio': height / defaultHeight,
    height,
    position: 'absolute',
    top: y,
  } as GanttLaneStyle;
}

function lanePropertiesTriggerStyle(y: number, laneHeight: number): CSSProperties {
  const height = Math.min(28, Math.max(24, laneHeight - 12));
  return {
    height,
    top: y + (laneHeight - height) / 2,
  };
}

function appearanceStyle(
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

function joinClasses(...values: readonly (string | undefined)[]): string | undefined {
  const classes = values.filter((value): value is string => value !== undefined && value !== '');
  return classes.length === 0 ? undefined : classes.join(' ');
}

function resolveClassName(
  value: GanttClassNameValue | undefined,
  state: GanttClassNameState,
): string | undefined {
  return typeof value === 'function' ? value(state) : value;
}

function taskTarget(task: TaskBarPrimitive) {
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

function inspectionSelectionKey(
  selection: GanttReactRuntimeSnapshot['selector']['session']['selection'],
): string {
  return JSON.stringify(
    selection.map((target) =>
      target.kind === 'task' ? ['task', target.viewKey] : ['lane', target.viewKey],
    ),
  );
}

function taskSummary(task: TaskBarPrimitive): GanttTaskSummary {
  return Object.freeze({
    end: task.end,
    start: task.start,
    target: taskTarget(task),
    title: task.title,
    ...(task.appearance?.variant === undefined ? {} : { variant: task.appearance.variant }),
  });
}

function laneSummary(lane: GanttReactRuntimeSnapshot['scene']['lanes'][number]): GanttLaneSummary {
  return Object.freeze({
    target: Object.freeze({
      kind: 'lane' as const,
      ...(lane.laneId === undefined ? {} : { laneId: lane.laneId }),
      ...(lane.resourceId === undefined ? {} : { resourceId: lane.resourceId }),
      viewKey: lane.viewKey,
    }),
    title: lane.title,
  });
}

function idleClassState(
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

function taskEditDisabledReason(
  task: TaskBarPrimitive,
  runtime: GanttReactRuntime,
  disabled: boolean,
  editorEnabled: boolean,
): string | undefined {
  if (disabled) {
    return 'The chart is read-only.';
  }
  if (!editorEnabled) {
    return 'Task editing is not enabled.';
  }
  if (task.segmentId !== undefined) {
    return 'Segment occurrences are not editable in the basic editor.';
  }
  if (task.source.kind === 'custom') {
    return 'Custom-view occurrences are not editable in the basic editor.';
  }
  if (task.source.kind !== 'document-placement') {
    return 'Derived task occurrences are not editable in the basic editor.';
  }
  const record = runtime
    .getSnapshot()
    .selector.document.tasks.find((candidate) => candidate.id === task.taskId);
  if (record?.schedule?.mode !== 'instant') {
    return record?.schedule?.mode === 'all-day'
      ? 'All-day tasks are not editable in the basic editor.'
      : 'Unscheduled tasks are not editable in the basic editor.';
  }
  return undefined;
}

function validateTaskEditorValue(value: GanttTaskEditorValue): string | undefined {
  if (value.title.trim() === '') {
    return 'Title is required.';
  }
  if (!Number.isFinite(value.start) || !Number.isFinite(value.end)) {
    return 'Start and end must be ISO 8601 datetimes with an explicit offset.';
  }
  if (value.end <= value.start) {
    return 'End must be later than start.';
  }
  return undefined;
}

function taskEditorCommand(
  task: TaskBarPrimitive,
  currentTitle: string,
  value: GanttTaskEditorValue,
): GanttCommand | undefined {
  const commands: GanttCommand[] = [];
  const title = value.title.trim();
  if (title !== currentTitle) {
    commands.push({ changes: { title }, id: task.taskId, type: 'task.update' });
  }
  if (value.start !== task.start) {
    commands.push({ id: task.taskId, start: value.start, type: 'task.move' });
  }
  if (value.end !== task.end) {
    // Resize follows move so the submitted end wins even when the start also changed.
    commands.push({ edge: 'end', id: task.taskId, time: value.end, type: 'task.resize' });
  }
  if (commands.length === 0) {
    return undefined;
  }
  return commands.length === 1 ? commands[0] : { commands, type: 'transaction' };
}

function taskPropertiesValue(
  task: TaskBarPrimitive,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): GanttItemPropertiesValue | undefined {
  const record = document.tasks.find((candidate) => candidate.id === task.taskId);
  if (record === undefined) {
    return undefined;
  }
  const schedule =
    record.schedule?.mode === 'instant' && task.segmentId === undefined
      ? { end: record.schedule.end, start: record.schedule.start }
      : {};
  return Object.freeze({
    ...(record.appearance === undefined ? {} : { appearance: record.appearance }),
    ...(record.description === undefined ? {} : { description: record.description }),
    ...schedule,
    kind: 'task',
    ...(task.laneId === undefined ? {} : { laneId: task.laneId }),
    ...(task.placementId === undefined ? {} : { placementId: task.placementId }),
    ...(record.kind !== 'task' || record.progress === undefined
      ? {}
      : { progress: record.progress }),
    taskId: record.id,
    title: record.title,
  });
}

function lanePropertiesValue(
  lane: LaneRowPrimitive,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): GanttItemPropertiesValue | undefined {
  if (lane.laneId === undefined) {
    return undefined;
  }
  const record = document.lanes.find((candidate) => candidate.id === lane.laneId);
  return record === undefined
    ? undefined
    : Object.freeze({
        ...(record.appearance === undefined ? {} : { appearance: record.appearance }),
        kind: 'lane',
        laneId: record.id,
        title: record.title,
      });
}

function appearanceVariant(value: GanttItemPropertiesValue): string | undefined {
  return value.appearance?.variant;
}

function validateItemPropertiesValue(
  initial: GanttItemPropertiesValue,
  value: GanttItemPropertiesValue,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): string | undefined {
  if (
    initial.kind !== value.kind ||
    (initial.kind === 'task' && value.kind === 'task' && initial.taskId !== value.taskId) ||
    (initial.kind === 'lane' && value.kind === 'lane' && initial.laneId !== value.laneId)
  ) {
    return 'The submitted properties target does not match the inspected item.';
  }
  if (value.title.trim() === '') {
    return 'Title is required.';
  }
  if (value.appearance !== undefined && value.appearance.variant.trim() === '') {
    return 'Appearance must use a non-empty semantic variant.';
  }
  if (value.kind === 'lane') {
    return undefined;
  }
  if (
    (value.start === undefined) !== (value.end === undefined) ||
    (value.start !== undefined &&
      value.end !== undefined &&
      (!Number.isFinite(value.start) || !Number.isFinite(value.end) || value.end <= value.start))
  ) {
    return 'End must be later than start.';
  }
  if (
    value.progress !== undefined &&
    (!Number.isFinite(value.progress) || value.progress < 0 || value.progress > 1)
  ) {
    return 'Progress must be between 0% and 100%.';
  }
  if (
    value.laneId !== undefined &&
    !document.lanes.some((candidate) => candidate.id === value.laneId)
  ) {
    return 'The selected lane no longer exists.';
  }
  return undefined;
}

function itemPropertiesCommand(
  initial: GanttItemPropertiesValue,
  value: GanttItemPropertiesValue,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): GanttCommand | undefined {
  if (initial.kind === 'lane' && value.kind === 'lane') {
    const record = document.lanes.find((candidate) => candidate.id === initial.laneId);
    if (record === undefined) {
      return undefined;
    }
    const changes: {
      appearance?: { readonly variant: string } | null;
      title?: string;
    } = {};
    const title = value.title.trim();
    if (title !== record.title) {
      changes.title = title;
    }
    if (appearanceVariant(value) !== record.appearance?.variant) {
      changes.appearance = value.appearance ?? null;
    }
    return Object.keys(changes).length === 0
      ? undefined
      : { changes, id: record.id, type: 'lane.update' };
  }
  if (initial.kind !== 'task' || value.kind !== 'task') {
    return undefined;
  }
  const record = document.tasks.find((candidate) => candidate.id === initial.taskId);
  if (record === undefined) {
    return undefined;
  }
  const commands: GanttCommand[] = [];
  const changes: {
    appearance?: { readonly variant: string } | null;
    description?: string | null;
    progress?: number | null;
    schedule?: { readonly end: number; readonly mode: 'instant'; readonly start: number };
    title?: string;
  } = {};
  const title = value.title.trim();
  if (title !== record.title) {
    changes.title = title;
  }
  if (value.description !== record.description) {
    changes.description = value.description ?? null;
  }
  if (appearanceVariant(value) !== record.appearance?.variant) {
    changes.appearance = value.appearance ?? null;
  }
  if (record.kind === 'task' && value.progress !== record.progress) {
    changes.progress = value.progress ?? null;
  }
  if (
    record.schedule?.mode === 'instant' &&
    value.start !== undefined &&
    value.end !== undefined &&
    (value.start !== record.schedule.start || value.end !== record.schedule.end)
  ) {
    changes.schedule = { end: value.end, mode: 'instant', start: value.start };
  }
  if (Object.keys(changes).length > 0) {
    commands.push({ changes, id: record.id, type: 'task.update' });
  }
  if (
    initial.placementId !== undefined &&
    initial.laneId !== undefined &&
    value.laneId !== undefined &&
    value.laneId !== initial.laneId
  ) {
    const placement = document.placements.find(
      (candidate) =>
        candidate.id === initial.placementId &&
        candidate.taskId === initial.taskId &&
        candidate.laneId === initial.laneId,
    );
    if (placement !== undefined) {
      commands.push({
        id: placement.id,
        laneId: value.laneId,
        type: 'placement.move',
      });
    }
  }
  if (commands.length === 0) {
    return undefined;
  }
  return commands.length === 1 ? commands[0] : { commands, type: 'transaction' };
}

function elapsedDuration(value: GanttItemPropertiesValue): string | undefined {
  if (value.kind !== 'task' || value.start === undefined || value.end === undefined) {
    return undefined;
  }
  const minutes = Math.round((value.end - value.start) / 60_000);
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const remainder = minutes % 60;
  return (
    [
      ...(days === 0 ? [] : [`${days}d`]),
      ...(hours === 0 ? [] : [`${hours}h`]),
      ...(remainder === 0 ? [] : [`${remainder}m`]),
    ].join(' ') || '0m'
  );
}

function taskAccessibleName(task: TaskBarPrimitive, formatter: Intl.DateTimeFormat): string {
  const schedule = `${task.title}, ${formatter.format(task.start)} to ${formatter.format(task.end)}`;
  return task.progress === undefined
    ? schedule
    : `${schedule}, ${Math.round(task.progress.value * 100)}% complete`;
}

function targetStateEqual(
  previous: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean],
  next: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean],
): boolean {
  return previous.every((value, index) => value === next[index]);
}

function targetsInteraction(interaction: GanttInteractionState, viewKey: string): boolean {
  return 'target' in interaction && interaction.target?.viewKey === viewKey;
}

function keyboardActionForEvent(
  event: ReactKeyboardEvent<HTMLElement>,
  editingMode?: Extract<GanttInteractionState, { readonly status: 'keyboard' }>['mode'],
): GanttKeyboardAction | undefined {
  const adjustment =
    event.key === 'ArrowLeft'
      ? 'left'
      : event.key === 'ArrowRight'
        ? 'right'
        : event.key === 'ArrowUp'
          ? 'up'
          : event.key === 'ArrowDown'
            ? 'down'
            : undefined;
  if (editingMode !== undefined) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return undefined;
    }
    if (editingMode === 'progress' && (event.key === 'Home' || event.key === 'End')) {
      return {
        boundary: event.key === 'Home' ? 'start' : 'end',
        direction: event.key === 'Home' ? 'left' : 'right',
        type: 'adjust',
      };
    }
    if (adjustment !== undefined) {
      return {
        ...(editingMode === 'progress' && event.shiftKey ? { accelerated: true } : {}),
        direction: adjustment,
        type: 'adjust',
      };
    }
    if (event.shiftKey) {
      return undefined;
    }
    if (event.key === 'Enter') {
      return { type: 'commit' };
    }
    return event.key === 'Escape' ? { type: 'cancel' } : undefined;
  }
  const platformModifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (platformModifier && !event.altKey && key === 'z') {
    return { action: event.shiftKey ? 'redo' : 'undo', type: 'history' };
  }
  if (platformModifier && !event.altKey && key === 'y') {
    return { action: 'redo', type: 'history' };
  }
  if (
    (event.key === 'PageUp' || event.key === 'PageDown') &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    return {
      axis: event.altKey ? 'horizontal' : 'vertical',
      direction: event.key === 'PageUp' ? -1 : 1,
      type: 'page',
    };
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return undefined;
  }
  if (adjustment !== undefined) {
    return { direction: adjustment, type: 'navigate' };
  }
  if (event.key === 'Home' || event.key === 'End') {
    return { direction: event.key === 'Home' ? 'home' : 'end', type: 'navigate' };
  }
  if (event.key === ' ') {
    return { type: 'toggle-selection' };
  }
  if (event.key === 'Enter') {
    return { type: 'activate' };
  }
  if (key === 'm') {
    return { mode: 'move', type: 'begin' };
  }
  if (key === 'p') {
    return { mode: 'progress', type: 'begin' };
  }
  if (key === 's') {
    return { mode: 'resize-start', type: 'begin' };
  }
  if (key === 'e') {
    return { mode: 'resize-end', type: 'begin' };
  }
  if (key === 'n') {
    return { type: 'create' };
  }
  return event.key === 'Delete' || event.key === 'Backspace' ? { type: 'delete' } : undefined;
}

function GanttTask({
  classNames,
  dateFormatter,
  describedBy,
  disabled,
  domId,
  onActivate,
  onContextMenu,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  slots,
  task,
  progressEditable,
  tabIndex,
  timelineHeight,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly dateFormatter: Intl.DateTimeFormat;
  readonly describedBy: string;
  readonly disabled: boolean;
  readonly domId: string;
  readonly onActivate: (task: TaskBarPrimitive) => void;
  readonly onContextMenu: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onFocus: (event: ReactFocusEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onMouseEnter: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
  readonly onMouseLeave: (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => void;
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
  const accessibleName = taskAccessibleName(task, dateFormatter);
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
  return (
    <g
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End Space Enter M P S E N Delete Backspace Control+Z Meta+Z Control+Y Meta+Shift+Z"
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
      <rect
        className="gt-gantt__task-bar"
        data-gt-part="task-track"
        height={percent(task.height / timelineHeight)}
        rx="6"
        width={percent(task.width)}
        x={percent(task.x)}
        y={percent(task.y / timelineHeight)}
      />
      {task.progress !== undefined && task.progress.width > 0 ? (
        <rect
          aria-hidden="true"
          className="gt-gantt__task-progress"
          data-gt-part="task-progress"
          data-progress={task.progress.value}
          height={percent(task.height / timelineHeight)}
          rx="6"
          width={percent(task.progress.width)}
          x={percent(task.progress.x)}
          y={percent(task.y / timelineHeight)}
        />
      ) : null}
      <foreignObject
        height={percent(task.height / timelineHeight)}
        width={percent(task.width)}
        x={percent(task.x)}
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
      <rect
        aria-hidden="true"
        className={resolveClassName(classNames?.resizeHandle, state)}
        data-edge="start"
        data-gt-part="resize-handle"
        height={percent(task.height / timelineHeight)}
        width="8"
        x={percent(task.x)}
        y={percent(task.y / timelineHeight)}
      />
      {progressEditable ? (
        <>
          <rect
            aria-hidden="true"
            data-gt-part="progress-hit-target"
            data-progress={task.progress?.value ?? 0}
            height={percent(task.height / timelineHeight)}
            width="12"
            x={percent(task.x + task.width * (task.progress?.value ?? 0))}
            y={percent(task.y / timelineHeight)}
          />
          <rect
            aria-hidden="true"
            className={resolveClassName(classNames?.progressHandle, state)}
            data-gt-part="progress-handle"
            data-progress={task.progress?.value ?? 0}
            height={percent(task.height / timelineHeight)}
            width="2"
            x={percent(task.x + task.width * (task.progress?.value ?? 0))}
            y={percent(task.y / timelineHeight)}
          />
        </>
      ) : null}
      <rect
        aria-hidden="true"
        className={resolveClassName(classNames?.resizeHandle, state)}
        data-edge="end"
        data-gt-part="resize-handle"
        height={percent(task.height / timelineHeight)}
        width="8"
        x={percent(task.x + task.width)}
        y={percent(task.y / timelineHeight)}
      />
    </g>
  );
}

function GanttSurface({
  appearanceVariants,
  bodyRef,
  chartRef,
  className,
  classNames,
  columns,
  contextMenuItems,
  dateFormatter,
  disabled,
  features,
  interactionMappers,
  label,
  overlayContainer,
  panCapable,
  runtime,
  scene,
  slots,
  timelineRef,
}: {
  readonly appearanceVariants?: GanttProps['appearanceVariants'];
  readonly bodyRef: React.RefObject<HTMLDivElement | null>;
  readonly chartRef: React.RefObject<HTMLDivElement | null>;
  readonly className?: string | undefined;
  readonly classNames?: GanttProps['classNames'];
  readonly columns?: GanttProps['columns'];
  readonly contextMenuItems?: GanttProps['contextMenuItems'];
  readonly dateFormatter: Intl.DateTimeFormat;
  readonly disabled: boolean;
  readonly features?: GanttProps['features'];
  readonly interactionMappers?: GanttProps['interactionMappers'];
  readonly label: string;
  readonly overlayContainer?: GanttProps['overlayContainer'];
  readonly panCapable: boolean;
  readonly runtime: GanttReactRuntime;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
  readonly slots?: GanttProps['slots'];
  readonly timelineRef: React.RefObject<HTMLDivElement | null>;
}): ReactElement {
  const interaction = useGanttSelector((snapshot) => snapshot.interaction);
  const canonicalDocument = useGanttSelector((snapshot) => snapshot.document);
  const focused = useGanttSelector((snapshot) => snapshot.session.focused);
  const selection = useGanttSelector((snapshot) => snapshot.session.selection);
  const verticalStart = useGanttSelector((snapshot) => snapshot.session.viewport.verticalStart);
  const accessibilityId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hadLogicalTaskFocus = useRef(false);
  const menuSurfaceRef = useRef<HTMLDivElement | null>(null);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const taskActivationPointer = useRef<
    | {
        moved: boolean;
        readonly viewKey: string;
        readonly x: number;
        readonly y: number;
      }
    | undefined
  >(undefined);
  const tooltipSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [localOverlayHost, setLocalOverlayHost] = useState<HTMLDivElement | null>(null);
  const [externalOverlayHost, setExternalOverlayHost] = useState<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TaskOverlayPosition | undefined>();
  const [menu, setMenu] = useState<TaskOverlayPosition | undefined>();
  const [editor, setEditor] = useState<EditorOverlay | undefined>();
  const [panState, setPanState] = useState<'idle' | 'panning' | 'pressing'>('idle');
  const overlayBoundary: OverlayBoundary = overlayContainer === 'root' ? 'root' : 'viewport';
  const overlayHost = overlayBoundary === 'root' ? localOverlayHost : externalOverlayHost;
  const helpId = `${accessibilityId}-keyboard-help`;
  const tooltipId = `${accessibilityId}-tooltip`;
  const menuId = `${accessibilityId}-context-menu`;
  const editorId = `${accessibilityId}-editor`;
  const editorErrorId = `${accessibilityId}-editor-error`;
  const tooltipEnabled = features?.tooltip === true || slots?.Tooltip !== undefined;
  const menuEnabled =
    features?.contextMenu === true ||
    slots?.ContextMenu !== undefined ||
    contextMenuItems !== undefined;
  const propertiesEnabled = features?.properties === true || slots?.ItemProperties !== undefined;
  const legacyEditorEnabled = features?.editor === true || slots?.TaskEditor !== undefined;
  const editorEnabled = propertiesEnabled || legacyEditorEnabled;
  const registeredAppearanceVariants = useMemo(
    () => Object.freeze([...createAppearanceRegistry(appearanceVariants).byId.values()]),
    [appearanceVariants],
  );
  const resolvedColumns = useMemo<readonly GanttLaneColumn[]>(() => {
    if (columns !== undefined && columns.length > 0) {
      return columns;
    }
    return Object.freeze([
      Object.freeze({
        header: 'Work item',
        id: 'title',
        width: scene.bounds.laneColumnWidth,
      }),
    ]);
  }, [columns, scene.bounds.laneColumnWidth]);
  const columnWidths = useMemo(
    () =>
      resolvedColumns.map((column) =>
        Number.isFinite(column.width) && (column.width ?? 0) > 0
          ? Math.max(72, column.width!)
          : resolvedColumns.length === 1
            ? scene.bounds.laneColumnWidth
            : 120,
      ),
    [resolvedColumns, scene.bounds.laneColumnWidth],
  );
  const laneColumnWidth =
    columnWidths.reduce((total, width) => total + width, 0) +
    (propertiesEnabled ? LANE_PROPERTIES_COLUMN_WIDTH : 0);
  const columnTemplate = [
    ...columnWidths,
    ...(propertiesEnabled ? [LANE_PROPERTIES_COLUMN_WIDTH] : []),
  ]
    .map((width) => `${width}px`)
    .join(' ');
  const taskByViewKey = useMemo(
    () => new Map(scene.taskBars.map((task) => [task.viewKey, task])),
    [scene.taskBars],
  );
  const progressEditableTaskIds = useMemo(
    () =>
      new Set(
        disabled
          ? []
          : canonicalDocument.tasks.filter((task) => task.kind === 'task').map((task) => task.id),
      ),
    [canonicalDocument.tasks, disabled],
  );
  const laneSummaries = useMemo(
    () => new Map(scene.lanes.map((lane) => [lane.viewKey, laneSummary(lane)])),
    [scene.lanes],
  );
  const taskDomIds = useMemo(
    () =>
      new Map(
        scene.taskBars.map((task, index) => [task.viewKey, `${accessibilityId}-task-${index}`]),
      ),
    [accessibilityId, scene.taskBars],
  );
  const focusedViewKey =
    focused?.kind === 'task' && scene.taskBars.some((task) => task.viewKey === focused.viewKey)
      ? focused.viewKey
      : undefined;
  const logicalTaskFocused = focused?.kind === 'task';
  const rovingViewKey = logicalTaskFocused ? focusedViewKey : scene.taskBars[0]?.viewKey;
  const activeTooltipTask = tooltip === undefined ? undefined : taskByViewKey.get(tooltip.viewKey);
  const activeMenuTask = menu === undefined ? undefined : taskByViewKey.get(menu.viewKey);
  const activeEditorTask = editor?.kind === 'task' ? taskByViewKey.get(editor.viewKey) : undefined;
  const activeEditorLane =
    editor?.kind === 'lane'
      ? scene.lanes.find((lane) => lane.viewKey === editor.viewKey)
      : undefined;
  const activeEditorValue =
    editor?.mode !== 'properties'
      ? undefined
      : activeEditorTask !== undefined
        ? taskPropertiesValue(activeEditorTask, runtime.getSnapshot().selector.document)
        : activeEditorLane !== undefined
          ? lanePropertiesValue(activeEditorLane, runtime.getSnapshot().selector.document)
          : undefined;
  const editorOpen = editor !== undefined;

  useLayoutEffect(() => {
    if (overlayBoundary === 'root') {
      setExternalOverlayHost(null);
      return;
    }
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const target = resolveOverlayTarget(overlayContainer, root);
    if (target === null) {
      setExternalOverlayHost(null);
      return;
    }
    const host = root.ownerDocument.createElement('div');
    host.className = 'gt-gantt gt-gantt__overlays gt-gantt__overlays--viewport';
    host.dataset.gantempo = '';
    host.dataset.gtOverlayBoundary = 'viewport';
    host.dataset.gtOverlayOwner = accessibilityId;
    host.dataset.gtPart = 'overlay-host';
    target.append(host);
    syncOverlayTheme(root, host);
    setExternalOverlayHost(host);
    return () => {
      setExternalOverlayHost((current) => (current === host ? null : current));
      host.remove();
    };
  }, [accessibilityId, overlayBoundary, overlayContainer]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root !== null && externalOverlayHost !== null) {
      syncOverlayTheme(root, externalOverlayHost);
    }
  }, [className, externalOverlayHost]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body !== null && body.scrollTop !== verticalStart) {
      body.scrollTop = verticalStart;
    }
  }, [bodyRef, verticalStart]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    if (focusedViewKey !== undefined) {
      hadLogicalTaskFocus.current = true;
      const task = Array.from(root.querySelectorAll<SVGGElement>('[data-gt-part="task"]')).find(
        (element) => element.dataset.viewKey === focusedViewKey,
      );
      if (task !== undefined && root.ownerDocument.activeElement !== task) {
        task.focus();
      }
      return;
    }
    if (logicalTaskFocused) {
      if (hadLogicalTaskFocus.current) {
        root.focus();
      }
      hadLogicalTaskFocus.current = true;
      return;
    }
    if (hadLogicalTaskFocus.current) {
      hadLogicalTaskFocus.current = false;
      root.focus();
    }
  }, [focusedViewKey, logicalTaskFocused]);
  const focusTaskElement = useCallback((viewKey: string) => {
    queueMicrotask(() => {
      const root = rootRef.current;
      const task = Array.from(
        root?.querySelectorAll<SVGGElement>('[data-gt-part="task"]') ?? [],
      ).find((element) => element.dataset.viewKey === viewKey);
      (task ?? root)?.focus();
    });
  }, []);
  const focusLaneElement = useCallback((viewKey: string) => {
    queueMicrotask(() => {
      const root = rootRef.current;
      const lane = Array.from(
        root?.querySelectorAll<HTMLButtonElement>('[data-gt-part="lane-properties-trigger"]') ?? [],
      ).find((element) => element.dataset.viewKey === viewKey);
      (lane ?? root)?.focus();
    });
  }, []);
  const closeMenu = useCallback(
    (restoreFocus = true) => {
      const viewKey = menu?.viewKey;
      setMenu(undefined);
      if (restoreFocus && viewKey !== undefined) {
        focusTaskElement(viewKey);
      }
    },
    [focusTaskElement, menu?.viewKey],
  );
  const closeEditor = useCallback(
    (restoreFocus = true) => {
      const viewKey = editor?.viewKey;
      const kind = editor?.kind;
      setEditor(undefined);
      if (restoreFocus && viewKey !== undefined) {
        if (kind === 'lane') {
          focusLaneElement(viewKey);
        } else {
          focusTaskElement(viewKey);
        }
      }
    },
    [editor?.kind, editor?.viewKey, focusLaneElement, focusTaskElement],
  );

  useEffect(() => {
    if (tooltip !== undefined && activeTooltipTask === undefined) {
      setTooltip(undefined);
    }
    if (menu !== undefined && activeMenuTask === undefined) {
      setMenu(undefined);
    }
    if (
      editor !== undefined &&
      ((editor.kind === 'task' && activeEditorTask === undefined) ||
        (editor.kind === 'lane' && activeEditorLane === undefined) ||
        (editor.mode === 'properties' && activeEditorValue === undefined))
    ) {
      closeEditor();
    }
  }, [
    activeEditorLane,
    activeEditorTask,
    activeEditorValue,
    activeMenuTask,
    activeTooltipTask,
    closeEditor,
    editor,
    menu,
    tooltip,
  ]);
  useEffect(() => {
    if (editor?.mode !== 'properties' || editor.pending) {
      return;
    }
    const nextSelectionKey = inspectionSelectionKey(selection);
    if (nextSelectionKey === editor.selectionKey) {
      return;
    }
    const selected = selection.at(-1);
    if (
      selected !== undefined &&
      ((selected.kind === 'task' && taskByViewKey.has(selected.viewKey)) ||
        (selected.kind === 'lane' &&
          scene.lanes.some(
            (lane) => lane.viewKey === selected.viewKey && lane.laneId !== undefined,
          )))
    ) {
      setEditor({
        kind: selected.kind,
        mode: 'properties',
        pending: false,
        selectionKey: nextSelectionKey,
        viewKey: selected.viewKey,
      });
      return;
    }
    setEditor((current) =>
      current === undefined ? undefined : { ...current, selectionKey: nextSelectionKey },
    );
  }, [editor, scene.lanes, selection, taskByViewKey]);
  useEffect(() => {
    if (menu === undefined) {
      return;
    }
    const surface = menuSurfaceRef.current;
    const ownerDocument = surface?.ownerDocument ?? rootRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }
    const dismiss = (event: PointerEvent) => {
      if (
        event.target !== null &&
        menuSurfaceRef.current !== null &&
        !menuSurfaceRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };
    ownerDocument.addEventListener('pointerdown', dismiss);
    return () => ownerDocument.removeEventListener('pointerdown', dismiss);
  }, [closeMenu, menu]);
  useEffect(() => {
    if (menu === undefined && tooltip === undefined) {
      return;
    }
    const ownerDocument = rootRef.current?.ownerDocument;
    const view = ownerDocument?.defaultView;
    if (ownerDocument === undefined || view === null || view === undefined) {
      return;
    }
    const dismissTransientSurface = () => {
      setTooltip(undefined);
      if (menu !== undefined) {
        closeMenu();
      }
    };
    ownerDocument.addEventListener('scroll', dismissTransientSurface, true);
    view.addEventListener('resize', dismissTransientSurface);
    return () => {
      ownerDocument.removeEventListener('scroll', dismissTransientSurface, true);
      view.removeEventListener('resize', dismissTransientSurface);
    };
  }, [closeMenu, menu, tooltip]);
  useLayoutEffect(() => {
    if (
      tooltip === undefined ||
      tooltip.adjusted === true ||
      tooltipSurfaceRef.current === null ||
      overlayHost === null
    ) {
      return;
    }
    const adjusted = adjustedOverlayPosition(
      tooltip,
      tooltipSurfaceRef.current,
      overlayHost,
      overlayBoundary,
    );
    if (adjusted.x !== tooltip.x || adjusted.y !== tooltip.y) {
      setTooltip(adjusted);
    }
  }, [overlayBoundary, overlayHost, tooltip]);
  useLayoutEffect(() => {
    if (
      menu === undefined ||
      menu.adjusted === true ||
      menuSurfaceRef.current === null ||
      overlayHost === null
    ) {
      return;
    }
    const adjusted = adjustedOverlayPosition(
      menu,
      menuSurfaceRef.current,
      overlayHost,
      overlayBoundary,
    );
    if (adjusted.x !== menu.x || adjusted.y !== menu.y) {
      setMenu(adjusted);
    }
  }, [menu, overlayBoundary, overlayHost]);
  useLayoutEffect(() => {
    if (menu !== undefined) {
      const firstItem = menuSurfaceRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      );
      (firstItem ?? menuSurfaceRef.current)?.focus();
    }
  }, [menu]);
  useLayoutEffect(() => {
    if (editor !== undefined) {
      const firstField =
        editorSurfaceRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) ?? editorSurfaceRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      (firstField ?? editorSurfaceRef.current)?.focus();
    }
  }, [editor?.viewKey]);
  useLayoutEffect(() => {
    if (!editorOpen || overlayBoundary !== 'viewport' || overlayHost === null) {
      return;
    }
    const ownerDocument = overlayHost.ownerDocument;
    const body = ownerDocument.body;
    if (overlayHost.parentElement !== body) {
      return;
    }
    const previous = new Map<
      Element,
      {
        readonly ariaHidden: string | null;
        readonly inert: boolean;
      }
    >();
    const isolate = (element: Element) => {
      if (element === overlayHost || previous.has(element)) {
        return;
      }
      previous.set(element, {
        ariaHidden: element.getAttribute('aria-hidden'),
        inert: element.hasAttribute('inert'),
      });
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('inert', '');
    };
    for (const element of body.children) {
      isolate(element);
    }
    // Application portals can append new body siblings while the editor is open.
    // Observe only direct children so the modal boundary stays isolated and cleanup
    // can restore every element's exact prior state.
    const MutationObserverConstructor = ownerDocument.defaultView?.MutationObserver;
    const observer =
      MutationObserverConstructor === undefined
        ? undefined
        : new MutationObserverConstructor((records) => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (node.nodeType === 1) {
                  isolate(node as Element);
                }
              }
            }
          });
    observer?.observe(body, { childList: true });
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const view = ownerDocument.defaultView;
    const scrollbarWidth =
      view === null ? 0 : Math.max(0, view.innerWidth - ownerDocument.documentElement.clientWidth);
    const computedPadding =
      view === null ? 0 : Number.parseFloat(view.getComputedStyle(body).paddingRight) || 0;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedPadding + scrollbarWidth}px`;
    }
    return () => {
      observer?.disconnect();
      for (const [element, { ariaHidden, inert }] of previous) {
        if (ariaHidden === null) {
          element.removeAttribute('aria-hidden');
        } else {
          element.setAttribute('aria-hidden', ariaHidden);
        }
        element.toggleAttribute('inert', inert);
      }
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [editorOpen, overlayBoundary, overlayHost]);
  useLayoutEffect(() => {
    if (!DEVELOPMENT) {
      return;
    }
    if (
      tooltip !== undefined &&
      slots?.Tooltip !== undefined &&
      tooltipSurfaceRef.current === null
    ) {
      console.warn('Gantt Tooltip slot must spread the provided bindings onto its owning element.');
    }
    if (menu !== undefined && slots?.ContextMenu !== undefined && menuSurfaceRef.current === null) {
      console.warn(
        'Gantt ContextMenu slot must spread the provided bindings onto its owning element.',
      );
    }
    if (
      editor?.mode === 'legacy' &&
      slots?.TaskEditor !== undefined &&
      editorSurfaceRef.current === null
    ) {
      console.warn(
        'Gantt TaskEditor slot must spread the provided bindings onto its owning element.',
      );
    }
    if (
      editor?.mode === 'properties' &&
      slots?.ItemProperties !== undefined &&
      editorSurfaceRef.current === null
    ) {
      console.warn(
        'Gantt ItemProperties slot must spread the provided bindings onto its owning element.',
      );
    }
  }, [editor, menu, slots, tooltip]);
  useEffect(() => {
    if (editor?.pending !== true) {
      return;
    }
    if (interaction.status === 'rejected') {
      setEditor((current) =>
        current === undefined
          ? undefined
          : {
              ...current,
              error: interaction.announcement,
              pending: false,
            },
      );
      return;
    }
    if (interaction.status === 'idle') {
      closeEditor();
    }
  }, [closeEditor, editor?.pending, interaction]);

  const geometry = useCallback(() => {
    const body = bodyRef.current;
    const timeline = timelineRef.current;
    if (body === null || timeline === null) {
      return undefined;
    }
    const bodyRect = body.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const height = body.clientHeight || bodyRect.height;
    if (timelineRect.width <= 0 || height <= 0) {
      return undefined;
    }
    return {
      height,
      verticalStart: body.scrollTop,
      width: timelineRect.width,
      x: timelineRect.left,
      y: bodyRect.top,
    };
  }, [bodyRef, timelineRef]);
  const overlayPosition = useCallback(
    (
      viewKey: string,
      element: Element,
      clientX?: number,
      clientY?: number,
    ): TaskOverlayPosition => {
      const rootRect = rootRef.current?.getBoundingClientRect();
      const taskRect = element.getBoundingClientRect();
      const rootLeft = overlayBoundary === 'root' ? (rootRect?.left ?? 0) : 0;
      const rootTop = overlayBoundary === 'root' ? (rootRect?.top ?? 0) : 0;
      return {
        viewKey,
        x: Math.max(OVERLAY_SAFE_AREA, (clientX ?? taskRect.left + taskRect.width / 2) - rootLeft),
        y: Math.max(OVERLAY_SAFE_AREA, (clientY ?? taskRect.bottom + 6) - rootTop),
      };
    },
    [overlayBoundary],
  );
  const showTooltip = useCallback(
    (element: Element, task: TaskBarPrimitive) => {
      if (tooltipEnabled && menu === undefined && editor === undefined) {
        setTooltip(overlayPosition(task.viewKey, element));
      }
    },
    [editor, menu, overlayPosition, tooltipEnabled],
  );
  const openEditor = useCallback(
    (viewKey: string): boolean => {
      const task = taskByViewKey.get(viewKey);
      if (task === undefined) {
        return false;
      }
      const mode = propertiesEnabled ? 'properties' : 'legacy';
      if (
        (mode === 'properties' &&
          taskPropertiesValue(task, runtime.getSnapshot().selector.document) === undefined) ||
        (mode === 'legacy' &&
          taskEditDisabledReason(task, runtime, disabled, legacyEditorEnabled) !== undefined)
      ) {
        return false;
      }
      if (mode === 'properties') {
        runtime.inspectTask(viewKey);
      }
      setTooltip(undefined);
      setMenu(undefined);
      setEditor({
        kind: 'task',
        mode,
        pending: false,
        ...(mode === 'properties'
          ? {
              selectionKey: inspectionSelectionKey(
                runtime.getSnapshot().selector.session.selection,
              ),
            }
          : {}),
        viewKey,
      });
      return true;
    },
    [disabled, legacyEditorEnabled, propertiesEnabled, runtime, taskByViewKey],
  );
  const openLaneProperties = useCallback(
    (viewKey: string): boolean => {
      if (!propertiesEnabled) {
        return false;
      }
      const lane = scene.lanes.find((candidate) => candidate.viewKey === viewKey);
      if (
        lane === undefined ||
        lanePropertiesValue(lane, runtime.getSnapshot().selector.document) === undefined
      ) {
        return false;
      }
      runtime.inspectLane(viewKey);
      setTooltip(undefined);
      setMenu(undefined);
      setEditor({
        kind: 'lane',
        mode: 'properties',
        pending: false,
        selectionKey: inspectionSelectionKey(runtime.getSnapshot().selector.session.selection),
        viewKey,
      });
      return true;
    },
    [propertiesEnabled, runtime, scene.lanes],
  );
  const openContextMenu = useCallback(
    (element: Element, task: TaskBarPrimitive, clientX?: number, clientY?: number): boolean => {
      if (!menuEnabled) {
        return false;
      }
      runtime.keyboardFocus(task.viewKey);
      setTooltip(undefined);
      setEditor(undefined);
      setMenu(overlayPosition(task.viewKey, element, clientX, clientY));
      return true;
    },
    [menuEnabled, overlayPosition, runtime],
  );
  const onTaskContextMenu = useCallback(
    (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => {
      if (openContextMenu(event.currentTarget, task, event.clientX, event.clientY)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [openContextMenu],
  );
  const onTaskFocus = useCallback(
    (event: ReactFocusEvent<SVGGElement>, task: TaskBarPrimitive) => {
      showTooltip(event.currentTarget, task);
    },
    [showTooltip],
  );
  const onTaskActivate = useCallback(
    (task: TaskBarPrimitive) => {
      const pointer = taskActivationPointer.current;
      taskActivationPointer.current = undefined;
      if (pointer?.viewKey === task.viewKey && pointer.moved) {
        return;
      }
      if (propertiesEnabled) {
        openEditor(task.viewKey);
      }
    },
    [openEditor, propertiesEnabled],
  );
  const onTaskMouseEnter = useCallback(
    (event: ReactMouseEvent<SVGGElement>, task: TaskBarPrimitive) => {
      showTooltip(event.currentTarget, task);
    },
    [showTooltip],
  );
  const onTaskMouseLeave = useCallback(() => {
    setTooltip(undefined);
  }, []);
  const candidateViewKey = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    return target instanceof Element
      ? target.closest<SVGGElement>('[data-gt-part="task"]')?.dataset.viewKey
      : undefined;
  }, []);
  const progressCandidateViewKey = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    return target instanceof Element &&
      target.closest('[data-gt-part="progress-handle"], [data-gt-part="progress-hit-target"]') !==
        null
      ? target.closest<SVGGElement>('[data-gt-part="task"]')?.dataset.viewKey
      : undefined;
  }, []);
  const pointerType = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    return event.pointerType === 'touch' || event.pointerType === 'pen'
      ? event.pointerType
      : 'mouse';
  }, []);
  const pointerInput = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const bounds = geometry();
      if (bounds === undefined) {
        return undefined;
      }
      const candidate = candidateViewKey(event);
      const progressCandidate = progressCandidateViewKey(event);
      return {
        ...(candidate === undefined ? {} : { candidateViewKey: candidate }),
        geometry: bounds,
        point: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        ...(progressCandidate === undefined ? {} : { progressCandidateViewKey: progressCandidate }),
      };
    },
    [candidateViewKey, geometry, progressCandidateViewKey],
  );
  const beginPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, axis: 'both' | 'horizontal'): boolean => {
      if (editorOpen || event.pointerType !== 'mouse' || event.isPrimary === false) {
        return false;
      }
      const input = pointerInput(event);
      if (
        input === undefined ||
        !runtime.panPointerDown({
          axis,
          geometry: input.geometry,
          point: input.point,
          pointerId: input.pointerId,
        })
      ) {
        return false;
      }
      setTooltip(undefined);
      setMenu(undefined);
      setPanState('pressing');
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic adapters can lack a browser-managed active pointer.
      }
      return true;
    },
    [editorOpen, pointerInput, runtime],
  );
  const movePan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): boolean => {
      const input = pointerInput(event);
      if (input === undefined) {
        return false;
      }
      const result = runtime.panPointerMove(input);
      if (!result.handled) {
        return false;
      }
      if (result.active) {
        setPanState('panning');
      }
      event.preventDefault();
      return true;
    },
    [pointerInput, runtime],
  );
  const finishPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, cancel: boolean): boolean => {
      const result = cancel
        ? {
            active: false,
            handled: runtime.panPointerCancel(event.pointerId),
          }
        : runtime.panPointerUp(event.pointerId);
      if (!result.handled) {
        return false;
      }
      setPanState('idle');
      event.preventDefault();
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Capture can already be released before cancellation or pointerup.
      }
      return true;
    },
    [runtime],
  );
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const input = pointerInput(event);
      const mousePan =
        event.pointerType === 'mouse' &&
        event.isPrimary !== false &&
        (event.button === 1 ||
          (event.button === 0 &&
            input?.candidateViewKey === undefined &&
            interactionMappers?.createTask === undefined));
      if (mousePan) {
        if (beginPan(event, 'both')) {
          return;
        }
        if (event.button === 1 || panCapable || editorOpen) {
          return;
        }
      }
      if (event.button !== 0 || event.isPrimary === false) {
        return;
      }
      if (input === undefined) {
        return;
      }
      if (input.candidateViewKey !== undefined) {
        taskActivationPointer.current = {
          moved: false,
          viewKey: input.candidateViewKey,
          x: event.clientX,
          y: event.clientY,
        };
      } else {
        taskActivationPointer.current = undefined;
      }
      if (input.candidateViewKey === undefined) {
        runtime.clearTaskFocusAndSelection();
        const activeElement = event.currentTarget.ownerDocument.activeElement;
        if (
          (activeElement instanceof HTMLElement || activeElement instanceof SVGElement) &&
          event.currentTarget.contains(activeElement) &&
          activeElement.closest('[data-gt-part="task"]') !== null
        ) {
          activeElement.blur();
        }
        if (mousePan) {
          return;
        }
      }
      if (disabled || !runtime.pointerDown({ ...input, pointerType: pointerType(event) })) {
        return;
      }
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic adapters can lack a browser-managed active pointer.
      }
    },
    [
      beginPan,
      disabled,
      editorOpen,
      interactionMappers?.createTask,
      panCapable,
      pointerInput,
      pointerType,
      runtime,
    ],
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (movePan(event)) {
        return;
      }
      const input = pointerInput(event);
      const activation = taskActivationPointer.current;
      if (
        activation !== undefined &&
        !activation.moved &&
        Math.hypot(event.clientX - activation.x, event.clientY - activation.y) >= 4
      ) {
        taskActivationPointer.current = { ...activation, moved: true };
      }
      if (input !== undefined && runtime.pointerMove(input)) {
        event.preventDefault();
      }
    },
    [movePan, pointerInput, runtime],
  );
  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (finishPan(event, false)) {
        return;
      }
      if (disabled) {
        return;
      }
      event.preventDefault();
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Capture can already be released by the browser before pointerup dispatch.
      }
      void runtime.pointerUp(event.pointerId);
    },
    [disabled, finishPan, runtime],
  );
  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      taskActivationPointer.current = undefined;
      if (finishPan(event, true)) {
        return;
      }
      if (runtime.pointerCancel(event.pointerId)) {
        event.preventDefault();
      }
    },
    [finishPan, runtime],
  );
  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        beginPan(event, 'horizontal');
      }
    },
    [beginPan],
  );
  const onHeaderPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      movePan(event);
    },
    [movePan],
  );
  const onHeaderPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishPan(event, false);
    },
    [finishPan],
  );
  const onHeaderPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishPan(event, true);
    },
    [finishPan],
  );
  const onFocusCapture = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const target = event.target;
      const viewKey =
        target instanceof Element
          ? target.closest<SVGGElement>('[data-gt-part="task"]')?.dataset.viewKey
          : undefined;
      if (viewKey !== undefined) {
        runtime.keyboardFocus(viewKey);
      }
    },
    [runtime],
  );
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (
        (!disabled || propertiesEnabled) &&
        menuEnabled &&
        focusedViewKey !== undefined &&
        (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
      ) {
        const task = taskByViewKey.get(focusedViewKey);
        const element = Array.from(
          rootRef.current?.querySelectorAll<SVGGElement>('[data-gt-part="task"]') ?? [],
        ).find((candidate) => candidate.dataset.viewKey === focusedViewKey);
        if (task !== undefined && element !== undefined && openContextMenu(element, task)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      const action = keyboardActionForEvent(
        event,
        interaction.status === 'keyboard' ? interaction.mode : undefined,
      );
      if (
        disabled &&
        action?.type !== 'navigate' &&
        action?.type !== 'page' &&
        !(propertiesEnabled && action?.type === 'activate')
      ) {
        return;
      }
      const bounds = geometry();
      if (
        action === undefined ||
        (bounds === undefined && action.type !== 'history') ||
        !runtime.keyboardAction({
          action,
          ...(bounds === undefined ? {} : { geometry: bounds }),
        })
      ) {
        return;
      }
      if (action.type === 'activate' && focusedViewKey !== undefined && editorEnabled) {
        openEditor(focusedViewKey);
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [
      disabled,
      editorEnabled,
      focusedViewKey,
      geometry,
      interaction,
      menuEnabled,
      openContextMenu,
      openEditor,
      propertiesEnabled,
      runtime,
      taskByViewKey,
    ],
  );
  const rootClassState = idleClassState(disabled);
  const classes = joinClasses(
    'gt-gantt',
    className,
    resolveClassName(classNames?.root, rootClassState),
  );
  const style: GanttRootStyle = {
    '--gt-lane-column-width': `${laneColumnWidth}px`,
    '--gt-timeline-height': `${scene.bounds.timelineHeight}px`,
    '--gt-timeline-height-ratio': scene.bounds.timelineHeight / scene.bounds.defaultLaneHeight,
  };
  const activeMenuSummary = activeMenuTask === undefined ? undefined : taskSummary(activeMenuTask);
  const activeTooltipSummary =
    activeTooltipTask === undefined ? undefined : taskSummary(activeTooltipTask);
  const activeEditorSummary =
    activeEditorTask === undefined ? undefined : taskSummary(activeEditorTask);
  const currentDocument = runtime.getSnapshot().selector.document;
  const activeEditorTaskRecord =
    activeEditorTask === undefined
      ? undefined
      : currentDocument.tasks.find((task) => task.id === activeEditorTask.taskId);
  const activeEditorLaneRecord =
    activeEditorLane?.laneId === undefined
      ? undefined
      : currentDocument.lanes.find((lane) => lane.id === activeEditorLane.laneId);
  const propertyLaneOptions = currentDocument.lanes.map((lane) =>
    Object.freeze({ id: lane.id, title: lane.title }),
  );
  const laneMoveDisabledReason =
    activeEditorValue?.kind !== 'task' || activeEditorValue.placementId === undefined
      ? undefined
      : activeEditorValue.laneId === undefined
        ? 'Current lane is derived.'
        : currentDocument.placements.some(
              (placement) =>
                placement.id === activeEditorValue.placementId &&
                placement.taskId === activeEditorValue.taskId &&
                placement.laneId === activeEditorValue.laneId,
            )
          ? undefined
          : 'The persisted placement is stale.';
  const activeMenuEditReason =
    activeMenuTask === undefined
      ? undefined
      : propertiesEnabled
        ? taskPropertiesValue(activeMenuTask, runtime.getSnapshot().selector.document) === undefined
          ? 'The canonical task no longer exists.'
          : undefined
        : taskEditDisabledReason(activeMenuTask, runtime, disabled, legacyEditorEnabled);
  const additionalMenuItems =
    activeMenuSummary === undefined
      ? []
      : typeof contextMenuItems === 'function'
        ? contextMenuItems(activeMenuSummary)
        : (contextMenuItems ?? []);
  const menuItems: readonly GanttContextMenuItem[] =
    activeMenuTask === undefined
      ? []
      : [
          {
            action: 'create',
            ...(disabled
              ? { disabledReason: 'The chart is read-only.' }
              : interactionMappers?.createTask === undefined
                ? { disabledReason: 'Task creation requires a create-task mapper.' }
                : activeMenuTask.laneId === undefined
                  ? { disabledReason: 'Task creation requires a persisted lane.' }
                  : {}),
            id: 'create',
            label: 'Create task',
          },
          {
            action: 'edit',
            ...(activeMenuEditReason === undefined ? {} : { disabledReason: activeMenuEditReason }),
            id: 'edit',
            label: propertiesEnabled
              ? disabled
                ? 'View properties'
                : 'Edit properties'
              : 'Edit task',
          },
          ...additionalMenuItems.map((item) =>
            disabled && item.disabledReason === undefined
              ? { ...item, disabledReason: 'The chart is read-only.' }
              : item,
          ),
          {
            action: 'delete',
            ...(disabled ? { disabledReason: 'The chart is read-only.' } : {}),
            id: 'delete',
            label: 'Delete task',
          },
        ];
  const onMenuSelect = (item: GanttContextMenuItem) => {
    if (item.disabledReason !== undefined || activeMenuTask === undefined) {
      return;
    }
    const target = taskTarget(activeMenuTask);
    if (item.action === 'edit') {
      closeMenu(false);
      openEditor(activeMenuTask.viewKey);
      return;
    }
    if (item.action === 'create') {
      closeMenu();
      const bounds = geometry();
      if (bounds !== undefined) {
        runtime.keyboardAction({ action: { type: 'create' }, geometry: bounds });
      }
      return;
    }
    closeMenu();
    if (item.action === 'delete') {
      void runtime.dispatchAction(
        { cascade: true, id: activeMenuTask.taskId, type: 'task.delete' },
        {
          action: 'delete',
          source: { kind: 'context-menu' },
          target,
        },
      );
      return;
    }
    if (item.command !== undefined) {
      void runtime.dispatchAction(item.command, {
        action: 'command',
        source: { kind: 'context-menu' },
        target,
      });
    }
  };
  const onEditorSubmit = (value: GanttTaskEditorValue) => {
    if (activeEditorTask === undefined || editor?.pending === true) {
      return;
    }
    const validation = validateTaskEditorValue(value);
    if (validation !== undefined) {
      setEditor((current) =>
        current === undefined ? undefined : { ...current, error: validation, pending: false },
      );
      return;
    }
    const record = runtime
      .getSnapshot()
      .selector.document.tasks.find((task) => task.id === activeEditorTask.taskId);
    if (record === undefined) {
      setEditor((current) =>
        current === undefined
          ? undefined
          : { ...current, error: 'The task no longer exists.', pending: false },
      );
      return;
    }
    const command = taskEditorCommand(activeEditorTask, record.title, value);
    if (command === undefined) {
      closeEditor();
      return;
    }
    const viewKey = activeEditorTask.viewKey;
    setEditor((current) => {
      if (current === undefined) {
        return undefined;
      }
      const { error: _error, ...next } = current;
      return { ...next, pending: true };
    });
    void runtime
      .dispatchAction(command, {
        action: 'edit',
        source: { kind: 'editor' },
        target: taskTarget(activeEditorTask),
      })
      .then((result) => {
        if (result.status === 'rejected') {
          setEditor((current) =>
            current?.viewKey !== viewKey
              ? current
              : {
                  ...current,
                  error: result.diagnostics[0]?.message ?? 'The task update was rejected.',
                  pending: false,
                },
          );
        }
      });
  };
  const onItemPropertiesSubmit = (value: GanttItemPropertiesValue) => {
    if (
      editor?.mode !== 'properties' ||
      editor.pending ||
      activeEditorValue === undefined ||
      disabled
    ) {
      return;
    }
    const document = runtime.getSnapshot().selector.document;
    const validation = validateItemPropertiesValue(activeEditorValue, value, document);
    if (validation !== undefined) {
      setEditor((current) =>
        current === undefined ? undefined : { ...current, error: validation, pending: false },
      );
      return;
    }
    const command = itemPropertiesCommand(activeEditorValue, value, document);
    if (command === undefined) {
      closeEditor();
      return;
    }
    const target =
      editor.kind === 'task' && activeEditorTask !== undefined
        ? taskTarget(activeEditorTask)
        : editor.kind === 'lane' && activeEditorLane !== undefined
          ? laneSummary(activeEditorLane).target
          : undefined;
    if (target === undefined) {
      closeEditor(false);
      return;
    }
    const viewKey = editor.viewKey;
    setEditor((current) => {
      if (current === undefined) {
        return undefined;
      }
      const { error: _error, ...next } = current;
      return { ...next, pending: true };
    });
    void runtime
      .dispatchAction(command, {
        action: 'edit',
        source: { kind: 'editor' },
        target,
      })
      .then((result) => {
        if (result.status === 'rejected') {
          setEditor((current) =>
            current?.viewKey !== viewKey
              ? current
              : {
                  ...current,
                  error: result.diagnostics[0]?.message ?? 'The item update was rejected.',
                  pending: false,
                },
          );
        }
      });
  };
  const onItemPropertiesDelete = () => {
    if (
      editor?.mode !== 'properties' ||
      editor.kind !== 'task' ||
      editor.pending ||
      activeEditorTask === undefined ||
      disabled
    ) {
      return;
    }
    setEditor((current) => {
      if (current === undefined) {
        return undefined;
      }
      const { error: _error, ...next } = current;
      return { ...next, pending: true };
    });
    void runtime.dispatchAction(
      { cascade: true, id: activeEditorTask.taskId, type: 'task.delete' },
      {
        action: 'delete',
        source: { kind: 'editor' },
        target: taskTarget(activeEditorTask),
      },
    );
  };
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>, surface: HTMLDivElement | null) => {
    if (event.key !== 'Tab' || surface === null) {
      return;
    }
    const focusable = Array.from(
      surface.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      surface.focus();
      return;
    }
    const current = focusable.indexOf(surface.ownerDocument.activeElement as HTMLElement);
    const next = event.shiftKey
      ? current <= 0
        ? focusable.length - 1
        : current - 1
      : current < 0 || current === focusable.length - 1
        ? 0
        : current + 1;
    event.preventDefault();
    focusable[next]?.focus();
  };
  const overlayClassState = (task: TaskBarPrimitive) => idleClassState(disabled, taskTarget(task));
  const LaneHeader = slots?.LaneHeader ?? DefaultLaneHeader;
  const renderLaneColumn = (column: GanttLaneColumn, laneViewKey: string): ReactNode => {
    const lane = laneSummaries.get(laneViewKey)!;
    if (column.renderCell !== undefined) {
      return column.renderCell({ disabled, lane });
    }
    return <LaneHeader {...idleClassState(disabled, lane.target)} lane={lane} />;
  };
  const Tooltip = slots?.Tooltip ?? DefaultTooltip;
  const ContextMenu = slots?.ContextMenu ?? DefaultContextMenu;
  const TaskEditor = slots?.TaskEditor ?? DefaultTaskEditor;
  const editorClassState =
    activeEditorTask !== undefined
      ? overlayClassState(activeEditorTask)
      : activeEditorLane !== undefined
        ? idleClassState(disabled, laneSummary(activeEditorLane).target)
        : rootClassState;
  const editorBindings = {
    'aria-describedby': editor?.error === undefined ? undefined : editorErrorId,
    'aria-label':
      editor?.mode === 'properties' && activeEditorValue !== undefined
        ? `${disabled ? 'View' : 'Edit'} ${activeEditorValue.title} properties`
        : activeEditorSummary === undefined
          ? undefined
          : `Edit ${activeEditorSummary.title}`,
    'aria-modal': true,
    'aria-readonly': disabled || undefined,
    className: joinClasses(
      'gt-gantt__editor',
      resolveClassName(classNames?.editor, editorClassState),
    ),
    id: editorId,
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (event.key === 'Escape' && editor?.pending !== true) {
        event.preventDefault();
        closeEditor();
        return;
      }
      trapFocus(event, editorSurfaceRef.current);
    },
    ref: (element: HTMLDivElement | null) => {
      editorSurfaceRef.current = element;
    },
    role: 'dialog',
    tabIndex: -1,
  } as const;
  const overlays =
    overlayHost === null
      ? null
      : createPortal(
          <>
            {tooltip !== undefined && activeTooltipSummary !== undefined ? (
              <Tooltip
                bindings={{
                  className: joinClasses(
                    'gt-gantt__tooltip',
                    resolveClassName(classNames?.tooltip, overlayClassState(activeTooltipTask!)),
                  ),
                  id: tooltipId,
                  ref: (element) => {
                    tooltipSurfaceRef.current = element;
                  },
                  role: 'tooltip',
                  style: { left: tooltip.x, top: tooltip.y },
                }}
                task={activeTooltipSummary}
              />
            ) : null}
            {menu !== undefined && activeMenuSummary !== undefined ? (
              <ContextMenu
                bindings={{
                  'aria-label': `${activeMenuSummary.title} actions`,
                  className: joinClasses(
                    'gt-gantt__context-menu',
                    resolveClassName(classNames?.contextMenu, overlayClassState(activeMenuTask!)),
                  ),
                  id: menuId,
                  onKeyDown: (event) => {
                    event.stopPropagation();
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeMenu();
                      return;
                    }
                    const items = Array.from(
                      menuSurfaceRef.current?.querySelectorAll<HTMLElement>(
                        '[role="menuitem"]:not([disabled])',
                      ) ?? [],
                    );
                    const current = items.indexOf(document.activeElement as HTMLElement);
                    const next =
                      event.key === 'ArrowDown'
                        ? items[(current + 1) % items.length]
                        : event.key === 'ArrowUp'
                          ? items[(current <= 0 ? items.length : current) - 1]
                          : event.key === 'Home'
                            ? items[0]
                            : event.key === 'End'
                              ? items.at(-1)
                              : undefined;
                    if (next !== undefined) {
                      event.preventDefault();
                      next.focus();
                    }
                  },
                  ref: (element) => {
                    menuSurfaceRef.current = element;
                  },
                  role: 'menu',
                  style: { left: menu.x, top: menu.y },
                  tabIndex: -1,
                }}
                items={menuItems}
                onSelect={onMenuSelect}
                task={activeMenuSummary}
              />
            ) : null}
            {editor !== undefined &&
            ((editor.mode === 'legacy' && activeEditorSummary !== undefined) ||
              (editor.mode === 'properties' && activeEditorValue !== undefined)) ? (
              <div
                className="gt-gantt__editor-backdrop"
                data-editor-mode={editor.mode}
                data-gt-part="editor-backdrop"
                onPointerDown={(event) => {
                  if (event.currentTarget === event.target && !editor.pending) {
                    closeEditor();
                  }
                }}
              >
                {editor.mode === 'properties' && activeEditorValue !== undefined ? (
                  slots?.ItemProperties === undefined ? (
                    <DefaultItemProperties
                      appearanceVariants={registeredAppearanceVariants}
                      bindings={editorBindings}
                      {...(elapsedDuration(activeEditorValue) === undefined
                        ? {}
                        : { duration: elapsedDuration(activeEditorValue)! })}
                      {...(editor.error === undefined ? {} : { error: editor.error })}
                      errorId={editorErrorId}
                      initialValue={activeEditorValue}
                      key={`${activeEditorValue.kind}:${
                        activeEditorValue.kind === 'task'
                          ? activeEditorValue.taskId
                          : activeEditorValue.laneId
                      }`}
                      {...(laneMoveDisabledReason === undefined ? {} : { laneMoveDisabledReason })}
                      lanes={propertyLaneOptions}
                      onCancel={() => closeEditor()}
                      onDelete={onItemPropertiesDelete}
                      onSubmit={onItemPropertiesSubmit}
                      pending={editor.pending}
                      readOnly={disabled}
                      {...(activeEditorLaneRecord?.resourceId === undefined
                        ? {}
                        : { resourceId: activeEditorLaneRecord.resourceId })}
                      {...(activeEditorTaskRecord === undefined
                        ? {}
                        : { taskKind: activeEditorTaskRecord.kind })}
                    />
                  ) : (
                    <slots.ItemProperties
                      bindings={editorBindings}
                      {...(editor.error === undefined ? {} : { error: editor.error })}
                      errorId={editorErrorId}
                      initialValue={activeEditorValue}
                      key={`${activeEditorValue.kind}:${
                        activeEditorValue.kind === 'task'
                          ? activeEditorValue.taskId
                          : activeEditorValue.laneId
                      }`}
                      onCancel={() => closeEditor()}
                      onDelete={onItemPropertiesDelete}
                      onSubmit={onItemPropertiesSubmit}
                      pending={editor.pending}
                    />
                  )
                ) : activeEditorSummary !== undefined ? (
                  <TaskEditor
                    bindings={editorBindings}
                    {...(editor.error === undefined ? {} : { error: editor.error })}
                    errorId={editorErrorId}
                    initialValue={{
                      end: activeEditorSummary.end,
                      start: activeEditorSummary.start,
                      title: activeEditorSummary.title,
                    }}
                    onCancel={() => closeEditor()}
                    onSubmit={onEditorSubmit}
                    pending={editor.pending}
                    task={activeEditorSummary}
                  />
                ) : null}
              </div>
            ) : null}
          </>,
          overlayHost,
        );

  return (
    <div
      aria-describedby={helpId}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={classes}
      data-diagnostic-count={scene.diagnostics.length}
      data-disabled={disabled || undefined}
      data-gantempo=""
      data-gt-part="root"
      data-interaction-active={
        [
          'pressing',
          'dragging',
          'progressing',
          'resizing',
          'creating',
          'keyboard',
          'pending',
        ].includes(interaction.status) || undefined
      }
      data-interaction-state={interaction.status}
      data-pan-capable={panCapable || undefined}
      data-pan-state={panState === 'idle' ? undefined : panState}
      data-pending={interaction.status === 'pending' || undefined}
      data-rejected={interaction.status === 'rejected' || undefined}
      onFocusCapture={onFocusCapture}
      onKeyDown={onKeyDown}
      ref={rootRef}
      role="region"
      style={style}
      tabIndex={rovingViewKey === undefined ? 0 : -1}
    >
      <p hidden id={helpId}>
        Pan time with a horizontal wheel or trackpad gesture, Shift plus a vertical wheel, a
        primary-button drag on the time header, or a middle-button drag on the timeline. Use PageUp
        or PageDown to move lanes and Alt plus PageUp or PageDown to move time. Use arrow keys to
        navigate tasks, Space to select, Enter to activate or open the enabled editor, Shift+F10 to
        open the enabled task menu, M to move, P to adjust progress, S or E to resize, N to create,
        Delete to remove, and platform undo or redo shortcuts. In move, progress, or resize mode,
        viewport gestures do not edit tasks; use arrow keys, Home or End for progress boundaries,
        Enter to commit, and Escape to cancel. Dependency links and all-day task editing are not
        available in this interaction version.
        {propertiesEnabled
          ? ' Use each visible lane properties button to inspect or edit a persisted lane.'
          : ''}
      </p>
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
              <div aria-level={1} aria-rowindex={laneIndex + 2} key={lane.viewKey} role="row">
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
                  aria-owns={
                    scene.taskBars
                      .filter((task) => task.laneViewKey === lane.viewKey)
                      .map((task) => taskDomIds.get(task.viewKey))
                      .filter((id): id is string => id !== undefined)
                      .join(' ') || undefined
                  }
                  role="gridcell"
                />
              </div>
            ))
          )}
        </div>
      </div>
      <div
        className={joinClasses(
          'gt-gantt__table',
          resolveClassName(classNames?.chart, rootClassState),
        )}
        data-gt-part="chart"
        ref={chartRef}
      >
        <div
          aria-hidden="true"
          className="gt-gantt__corner"
          data-gt-part="corner"
          style={{ gridTemplateColumns: columnTemplate }}
        >
          {resolvedColumns.map((column) => (
            <span data-column-id={column.id} key={column.id}>
              {column.header}
            </span>
          ))}
          {propertiesEnabled ? (
            <span
              className="gt-gantt__lane-properties-header"
              data-gt-part="lane-properties-header"
              title="Lane properties"
            />
          ) : null}
        </div>
        <div
          aria-hidden="true"
          className="gt-gantt__time-header"
          data-gt-part="time-header"
          onLostPointerCapture={onHeaderPointerCancel}
          onPointerCancel={onHeaderPointerCancel}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
        >
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
          <div aria-hidden="true" className="gt-gantt__empty" data-gt-part="empty-state">
            <strong>{scene.emptyState.title}</strong>
            <span>{scene.emptyState.description}</span>
          </div>
        ) : (
          <div className="gt-gantt__body-scroll" data-gt-part="viewport" ref={bodyRef}>
            <div className="gt-gantt__body" style={{ height: scene.bounds.timelineHeight }}>
              <div className="gt-gantt__lanes" data-gt-part="lane-list">
                {scene.lanes.map((lane) => (
                  <div
                    aria-hidden="true"
                    className={joinClasses(
                      'gt-gantt__lane',
                      resolveClassName(
                        classNames?.lane,
                        idleClassState(disabled, laneSummaries.get(lane.viewKey)!.target),
                      ),
                    )}
                    data-lane-id={lane.laneId}
                    data-gt-appearance-resolution={lane.appearance?.resolution}
                    data-gt-appearance-source={lane.appearance?.source}
                    data-gt-part="lane"
                    data-gt-variant={lane.appearance?.variant}
                    data-resource-id={lane.resourceId}
                    data-view-key={lane.viewKey}
                    key={lane.viewKey}
                    style={{
                      ...laneStyle(lane.y, lane.height, scene.bounds.defaultLaneHeight),
                      ...appearanceStyle(lane.appearance),
                      gridTemplateColumns: columnTemplate,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="gt-gantt__lane-accent"
                      data-gt-part="lane-accent"
                    />
                    {resolvedColumns.map((column) => (
                      <div
                        className={joinClasses(
                          'gt-gantt__lane-header',
                          resolveClassName(
                            classNames?.laneHeader,
                            idleClassState(disabled, laneSummaries.get(lane.viewKey)!.target),
                          ),
                        )}
                        data-column-id={column.id}
                        data-gt-part="lane-header"
                        key={column.id}
                      >
                        {renderLaneColumn(column, lane.viewKey)}
                      </div>
                    ))}
                    {propertiesEnabled ? (
                      <div
                        className="gt-gantt__lane-properties-cell"
                        data-gt-part="lane-properties-cell"
                      />
                    ) : null}
                  </div>
                ))}
                {propertiesEnabled
                  ? scene.lanes.map((lane) =>
                      lane.laneId === undefined ? null : (
                        <button
                          aria-label={`${lane.title} properties`}
                          className="gt-gantt__lane-properties-trigger"
                          data-gt-part="lane-properties-trigger"
                          data-view-key={lane.viewKey}
                          key={`${lane.viewKey}:properties`}
                          onClick={() => openLaneProperties(lane.viewKey)}
                          style={lanePropertiesTriggerStyle(lane.y, lane.height)}
                          type="button"
                        >
                          <EllipsisVertical aria-hidden="true" />
                        </button>
                      ),
                    )
                  : null}
              </div>

              <div
                className="gt-gantt__timeline"
                data-empty-pan={
                  panCapable && interactionMappers?.createTask === undefined ? true : undefined
                }
                data-gt-part="timeline"
                onDragStart={(event) => event.preventDefault()}
                onLostPointerCapture={onPointerCancel}
                onPointerCancel={onPointerCancel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                ref={timelineRef}
              >
                <div aria-hidden="true" className="gt-gantt__timeline-cells">
                  {scene.lanes.map((lane) => (
                    <div
                      className={resolveClassName(
                        classNames?.timelineCell,
                        idleClassState(disabled, laneSummaries.get(lane.viewKey)!.target),
                      )}
                      data-gt-part="timeline-cell"
                      data-gt-appearance-resolution={lane.appearance?.resolution}
                      data-gt-appearance-source={lane.appearance?.source}
                      data-gt-variant={lane.appearance?.variant}
                      data-view-key={lane.viewKey}
                      key={lane.viewKey}
                      style={{
                        ...laneStyle(lane.y, lane.height, scene.bounds.defaultLaneHeight),
                        ...appearanceStyle(lane.appearance),
                      }}
                    />
                  ))}
                </div>
                <svg role="presentation">
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

                  {scene.taskBars.map((task) => (
                    <GanttTask
                      classNames={classNames}
                      dateFormatter={dateFormatter}
                      describedBy={joinClasses(
                        helpId,
                        tooltip?.viewKey === task.viewKey ? tooltipId : undefined,
                      )!}
                      disabled={disabled}
                      domId={taskDomIds.get(task.viewKey)!}
                      key={task.viewKey}
                      onActivate={onTaskActivate}
                      onContextMenu={onTaskContextMenu}
                      onFocus={onTaskFocus}
                      onMouseEnter={onTaskMouseEnter}
                      onMouseLeave={onTaskMouseLeave}
                      progressEditable={progressEditableTaskIds.has(task.taskId)}
                      slots={slots}
                      task={task}
                      tabIndex={task.viewKey === rovingViewKey ? 0 : -1}
                      timelineHeight={scene.bounds.timelineHeight}
                    />
                  ))}
                </svg>
                {'preview' in interaction && interaction.preview !== undefined ? (
                  <div
                    aria-hidden="true"
                    className="gt-gantt__interaction-preview"
                    data-gt-part="interaction-preview"
                    data-preview-kind={interaction.preview.kind}
                    data-preview-progress={interaction.preview.progress}
                    style={{
                      height: interaction.preview.height,
                      left: interaction.preview.x,
                      top: interaction.preview.y,
                      width: interaction.preview.width,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <div
        aria-atomic="true"
        aria-live="polite"
        className={joinClasses(
          'gt-gantt__live-region',
          resolveClassName(classNames?.liveRegion, rootClassState),
        )}
        data-gt-part="live-region"
      >
        {'announcement' in interaction
          ? interaction.announcement
          : interaction.status === 'pending'
            ? 'Chart update pending.'
            : ''}
      </div>
      {overlayBoundary === 'root' ? (
        <div
          className="gt-gantt__overlays gt-gantt__overlays--root"
          data-gt-overlay-boundary="root"
          data-gt-part="overlay-host"
          ref={setLocalOverlayHost}
        />
      ) : null}
      {overlays}
    </div>
  );
}

function useRuntime(props: GanttProps): GanttReactRuntime {
  const runtimeRef = useRef<GanttReactRuntime | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createGanttReactRuntime(props);
  }
  runtimeRef.current.updateCallbacks(props);
  return runtimeRef.current;
}

export const Gantt: ForwardRefExoticComponent<GanttProps & RefAttributes<GanttHandle>> = forwardRef<
  GanttHandle,
  GanttProps
>(function Gantt(props, ref): ReactElement {
  const runtime = useRuntime(props);
  const getScene = useCallback(() => runtime.getSnapshot().scene, [runtime]);
  const subscribe = useCallback(
    (subscriber: () => void) => runtime.subscribe(subscriber),
    [runtime],
  );
  const scene = useSyncExternalStore(subscribe, getScene, getScene);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const {
    className,
    classNames,
    columns,
    contextMenuItems,
    features,
    interactionMappers,
    label = 'Gantt chart',
    locale = 'en-US',
    onDiagnostics,
    overlayContainer,
    slots,
  } = props;
  const appearanceRegistrySignature = useMemo(
    () => createAppearanceRegistry(props.appearanceVariants).signature,
    [props.appearanceVariants],
  );
  const deliveredAppearanceDiagnostics = useRef<{
    readonly signature: string;
    readonly variants: Set<string>;
  }>({ signature: appearanceRegistrySignature, variants: new Set() });
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: props.timeZone,
      }),
    [locale, props.timeZone],
  );
  const disabled = props.document !== undefined && props.onDocumentChange === undefined;

  useImperativeHandle(ref, () => runtime.getHandle(), [runtime]);
  useLayoutEffect(() => {
    runtime.activate();
    return () => runtime.deactivate();
  }, [runtime]);
  useLayoutEffect(() => {
    runtime.reconcile(props);
  }, [props, runtime]);
  useEffect(() => {
    if (onDiagnostics === undefined) {
      return;
    }
    if (deliveredAppearanceDiagnostics.current.signature !== appearanceRegistrySignature) {
      deliveredAppearanceDiagnostics.current = {
        signature: appearanceRegistrySignature,
        variants: new Set(),
      };
    }
    const delivered = deliveredAppearanceDiagnostics.current.variants;
    const diagnostics = scene.diagnostics.filter((diagnostic) => {
      if (diagnostic.code !== 'appearance.variant.unresolved') {
        return true;
      }
      const variant = diagnostic.details?.variant;
      const key = typeof variant === 'string' ? variant : diagnostic.message;
      if (delivered.has(key)) {
        return false;
      }
      delivered.add(key);
      return true;
    });
    if (diagnostics.length > 0 || scene.diagnostics.length === 0) {
      onDiagnostics(diagnostics);
    }
  }, [appearanceRegistrySignature, onDiagnostics, scene.diagnostics]);
  useEffect(() => {
    const body = bodyRef.current;
    const timeline = timelineRef.current;
    if (body === null || timeline === null) {
      return;
    }
    const measure = () => {
      const current = runtime.getSnapshot();
      const focused = current.selector.session.focused;
      const focusedTask =
        focused?.kind === 'task'
          ? current.scene.taskBars.find((task) => task.viewKey === focused.viewKey)
          : undefined;
      const preview =
        'preview' in current.selector.interaction
          ? current.selector.interaction.preview
          : undefined;
      const retainedStart =
        focusedTask === undefined && preview === undefined
          ? undefined
          : Math.max(
              0,
              Math.min(focusedTask?.y ?? Infinity, preview?.y ?? Infinity) -
                (preview === undefined ? 0 : current.scene.bounds.defaultLaneHeight * 2),
            );
      const retainedEnd =
        focusedTask === undefined && preview === undefined
          ? undefined
          : Math.max(
              focusedTask === undefined ? -Infinity : focusedTask.y + focusedTask.height,
              preview === undefined ? -Infinity : preview.y + preview.height,
            ) + (preview === undefined ? 0 : current.scene.bounds.defaultLaneHeight * 2);
      runtime.measure({
        clientHeight: body.clientHeight,
        clientWidth: timeline.clientWidth,
        verticalStart: body.scrollTop,
        ...(retainedStart === undefined || retainedEnd === undefined
          ? {}
          : {
              retainedRange: {
                start: retainedStart,
                end: retainedEnd,
              },
            }),
      });
    };
    body.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    observer?.observe(body);
    observer?.observe(timeline);
    measure();
    return () => {
      body.removeEventListener('scroll', measure);
      observer?.disconnect();
      runtime.clearMeasurement();
    };
  }, [runtime, scene.emptyState]);
  useEffect(() => {
    const body = bodyRef.current;
    const chart = chartRef.current;
    const timeline = timelineRef.current;
    if (body === null || chart === null || timeline === null) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || excludesChartWheel(event.target)) {
        return;
      }
      const unit = wheelDeltaUnit(event.deltaMode);
      const horizontalDelta = normalizeNavigationDelta(event.deltaX, unit, {
        lineSize: WHEEL_LINE_SIZE,
        pageSize: timeline.clientWidth,
      });
      const verticalDelta = normalizeNavigationDelta(event.deltaY, unit, {
        lineSize: WHEEL_LINE_SIZE,
        pageSize: body.clientHeight,
      });
      const hasHorizontal = Math.abs(horizontalDelta) >= MEANINGFUL_WHEEL_DELTA;
      const shiftedVertical = event.shiftKey && !hasHorizontal ? verticalDelta : 0;
      const acceptedHorizontal = hasHorizontal ? horizontalDelta : shiftedVertical;
      if (acceptedHorizontal === 0) {
        return;
      }
      const horizontal = runtime.navigateViewport({
        horizontalDelta: acceptedHorizontal,
        viewportHeight: body.clientHeight,
        viewportWidth: timeline.clientWidth,
      });
      if (!horizontal.horizontal) {
        return;
      }
      const acceptedVertical = shiftedVertical === 0 ? verticalDelta : 0;
      if (acceptedVertical !== 0) {
        const vertical = runtime.navigateViewport({
          verticalDelta: acceptedVertical,
          viewportHeight: body.clientHeight,
          viewportWidth: timeline.clientWidth,
        });
        if (!vertical.vertical) {
          const maxScrollTop = Math.max(0, body.scrollHeight - body.clientHeight);
          body.scrollTop = Math.max(0, Math.min(maxScrollTop, body.scrollTop + acceptedVertical));
        }
      }
      event.preventDefault();
    };
    chart.addEventListener('wheel', onWheel, { passive: false });
    return () => chart.removeEventListener('wheel', onWheel);
  }, [runtime, scene.emptyState]);

  return (
    <GanttRuntimeProvider runtime={runtime}>
      <GanttSurface
        appearanceVariants={props.appearanceVariants}
        bodyRef={bodyRef}
        chartRef={chartRef}
        className={className}
        classNames={classNames}
        columns={columns}
        contextMenuItems={contextMenuItems}
        dateFormatter={dateFormatter}
        disabled={disabled}
        features={features}
        interactionMappers={interactionMappers}
        label={label}
        overlayContainer={overlayContainer}
        panCapable={props.onRangeChange !== undefined}
        runtime={runtime}
        scene={scene}
        slots={slots}
        timelineRef={timelineRef}
      />
    </GanttRuntimeProvider>
  );
});

Gantt.displayName = 'Gantt';

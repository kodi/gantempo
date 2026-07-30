import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type ForwardRefExoticComponent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type RefAttributes,
} from 'react';

import type { TaskBarPrimitive } from '../render/primitives';
import { GanttRuntimeProvider, useGanttSelector } from './context';
import {
  createGanttReactRuntime,
  type GanttKeyboardAction,
  type GanttReactRuntime,
  type GanttReactRuntimeSnapshot,
} from './runtime';
import type { GanttHandle, GanttInteractionState, GanttProps } from './types';
import '../styles.css';

export type { GanttHandle, GanttProps } from './types';

interface GanttRootStyle extends CSSProperties {
  readonly '--gt-lane-column-width': string;
  readonly '--gt-timeline-height': string;
  readonly '--gt-timeline-height-ratio': number;
}

type GanttLaneStyle = CSSProperties & {
  readonly '--gt-lane-height-ratio': number;
};

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

function taskAccessibleName(task: TaskBarPrimitive, formatter: Intl.DateTimeFormat): string {
  return `${task.title}, ${formatter.format(task.start)} to ${formatter.format(task.end)}`;
}

function targetStateEqual(
  previous: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean],
  next: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean],
): boolean {
  return previous.every((value, index) => value === next[index]);
}

function targetsInteraction(interaction: GanttInteractionState, viewKey: string): boolean {
  return 'target' in interaction && interaction.target?.viewKey === viewKey;
}

function keyboardActionForEvent(
  event: ReactKeyboardEvent<HTMLElement>,
  editing: boolean,
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
  if (editing) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return undefined;
    }
    if (adjustment !== undefined) {
      return { direction: adjustment, type: 'adjust' };
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
  dateFormatter,
  describedBy,
  disabled,
  domId,
  task,
  tabIndex,
  timelineHeight,
  variant,
}: {
  readonly dateFormatter: Intl.DateTimeFormat;
  readonly describedBy: string;
  readonly disabled: boolean;
  readonly domId: string;
  readonly task: TaskBarPrimitive;
  readonly tabIndex: -1 | 0;
  readonly timelineHeight: number;
  readonly variant?: string | undefined;
}): ReactElement {
  const [selected, focused, pressing, dragging, resizing, pending, rejected] = useGanttSelector(
    (snapshot) => {
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
        targeted && snapshot.interaction.status === 'pending',
        targeted && snapshot.interaction.status === 'rejected',
      ] as const;
    },
    targetStateEqual,
  );
  const accessibleName = taskAccessibleName(task, dateFormatter);
  return (
    <g
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End Space Enter M S E N Delete Backspace Control+Z Meta+Z Control+Y Meta+Shift+Z"
      aria-label={accessibleName}
      aria-pressed={selected}
      data-assignment-id={task.assignmentId}
      data-clipped-end={task.clippedEnd || undefined}
      data-clipped-start={task.clippedStart || undefined}
      data-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      data-focused={focused || undefined}
      data-pending={pending || undefined}
      data-pressing={pressing || undefined}
      data-rejected={rejected || undefined}
      data-resizing={resizing || undefined}
      data-gt-part="task"
      data-gt-variant={variant}
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
      role="button"
      tabIndex={tabIndex}
    >
      <rect
        className="gt-gantt__task-bar"
        height={percent(task.height / timelineHeight)}
        rx="6"
        width={percent(task.width)}
        x={percent(task.x)}
        y={percent(task.y / timelineHeight)}
      />
      <foreignObject
        height={percent(task.height / timelineHeight)}
        width={percent(task.width)}
        x={percent(task.x)}
        y={percent(task.y / timelineHeight)}
      >
        <div className="gt-gantt__task-label">
          <span>{task.title}</span>
        </div>
      </foreignObject>
    </g>
  );
}

function GanttSurface({
  bodyRef,
  className,
  dateFormatter,
  disabled,
  label,
  runtime,
  scene,
  taskVariants,
  timelineRef,
}: {
  readonly bodyRef: React.RefObject<HTMLDivElement | null>;
  readonly className?: string | undefined;
  readonly dateFormatter: Intl.DateTimeFormat;
  readonly disabled: boolean;
  readonly label: string;
  readonly runtime: GanttReactRuntime;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
  readonly taskVariants?: GanttProps['taskVariants'];
  readonly timelineRef: React.RefObject<HTMLDivElement | null>;
}): ReactElement {
  const interaction = useGanttSelector((snapshot) => snapshot.interaction);
  const focused = useGanttSelector((snapshot) => snapshot.session.focused);
  const verticalStart = useGanttSelector((snapshot) => snapshot.session.viewport.verticalStart);
  const accessibilityId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hadLogicalTaskFocus = useRef(false);
  const helpId = `${accessibilityId}-keyboard-help`;
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
  const rovingViewKey = disabled ? undefined : (focusedViewKey ?? scene.taskBars[0]?.viewKey);

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
      if (task !== undefined && document.activeElement !== task) {
        task.focus();
      }
      return;
    }
    if (hadLogicalTaskFocus.current) {
      hadLogicalTaskFocus.current = false;
      root.focus();
    }
  }, [focusedViewKey]);

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
  const candidateViewKey = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    return target instanceof Element
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
      return {
        ...(candidate === undefined ? {} : { candidateViewKey: candidate }),
        geometry: bounds,
        point: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
      };
    },
    [candidateViewKey, geometry],
  );
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0 || event.isPrimary === false) {
        return;
      }
      const input = pointerInput(event);
      if (
        input === undefined ||
        !runtime.pointerDown({ ...input, pointerType: pointerType(event) })
      ) {
        return;
      }
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic adapters can lack a browser-managed active pointer.
      }
    },
    [disabled, pointerInput, pointerType, runtime],
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const input = pointerInput(event);
      if (input !== undefined && runtime.pointerMove(input)) {
        event.preventDefault();
      }
    },
    [pointerInput, runtime],
  );
  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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
    [disabled, runtime],
  );
  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (runtime.pointerCancel(event.pointerId)) {
        event.preventDefault();
      }
    },
    [runtime],
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
      if (disabled) {
        return;
      }
      const action = keyboardActionForEvent(event, interaction.status === 'keyboard');
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
      event.preventDefault();
      event.stopPropagation();
    },
    [disabled, geometry, interaction.status, runtime],
  );
  const classes = ['gt-gantt', className].filter(Boolean).join(' ');
  const style: GanttRootStyle = {
    '--gt-lane-column-width': `${scene.bounds.laneColumnWidth}px`,
    '--gt-timeline-height': `${scene.bounds.timelineHeight}px`,
    '--gt-timeline-height-ratio': scene.bounds.timelineHeight / scene.bounds.defaultLaneHeight,
  };

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
        ['pressing', 'dragging', 'resizing', 'creating', 'keyboard', 'pending'].includes(
          interaction.status,
        ) || undefined
      }
      data-interaction-state={interaction.status}
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
        Use arrow keys to navigate tasks, Space to select, Enter to activate, M to move, S or E to
        resize, N to create, Delete to remove, and platform undo or redo shortcuts. In move or
        resize mode, use arrow keys, Enter to commit, and Escape to cancel. Dependency links and
        all-day task editing are not available in this interaction version.
      </p>
      <div
        aria-colcount={2}
        aria-describedby={helpId}
        aria-label={`${label} task grid`}
        aria-multiselectable="true"
        aria-rowcount={scene.emptyState ? 2 : scene.lanes.length + 1}
        className="gt-gantt__sr-only"
        role="treegrid"
      >
        <div aria-rowindex={1} role="row">
          <span aria-colindex={1} role="columnheader">
            Work item
          </span>
          <span aria-colindex={2} role="columnheader">
            Timeline
          </span>
        </div>
        <div role="rowgroup">
          {scene.emptyState ? (
            <div aria-rowindex={2} role="row">
              <span aria-colindex={1} role="rowheader">
                {scene.emptyState.title}
              </span>
              <span aria-colindex={2} role="gridcell">
                {scene.emptyState.description}
              </span>
            </div>
          ) : (
            scene.lanes.map((lane, laneIndex) => (
              <div aria-level={1} aria-rowindex={laneIndex + 2} key={lane.viewKey} role="row">
                <span aria-colindex={1} role="rowheader">
                  {lane.title}
                </span>
                <span
                  aria-colindex={2}
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
      <div className="gt-gantt__table" data-gt-part="chart">
        <div aria-hidden="true" className="gt-gantt__corner" data-gt-part="corner">
          Work item
        </div>
        <div aria-hidden="true" className="gt-gantt__time-header" data-gt-part="time-header">
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
              <div aria-hidden="true" className="gt-gantt__lanes" data-gt-part="lane-list">
                {scene.lanes.map((lane) => (
                  <div
                    className="gt-gantt__lane"
                    data-lane-id={lane.laneId}
                    data-gt-part="lane"
                    data-resource-id={lane.resourceId}
                    data-view-key={lane.viewKey}
                    key={lane.viewKey}
                    style={laneStyle(lane.y, lane.height, scene.bounds.defaultLaneHeight)}
                  >
                    <span aria-hidden="true" className="gt-gantt__lane-marker">
                      ·
                    </span>
                    <span title={lane.title}>{lane.title}</span>
                  </div>
                ))}
              </div>

              <div
                className="gt-gantt__timeline"
                data-gt-part="timeline"
                onDragStart={(event) => event.preventDefault()}
                onLostPointerCapture={onPointerCancel}
                onPointerCancel={onPointerCancel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                ref={timelineRef}
              >
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
                      dateFormatter={dateFormatter}
                      describedBy={helpId}
                      disabled={disabled}
                      domId={taskDomIds.get(task.viewKey)!}
                      key={task.viewKey}
                      task={task}
                      tabIndex={task.viewKey === rovingViewKey ? 0 : -1}
                      timelineHeight={scene.bounds.timelineHeight}
                      variant={taskVariants?.[task.taskId]}
                    />
                  ))}
                </svg>
                {'preview' in interaction && interaction.preview !== undefined ? (
                  <div
                    aria-hidden="true"
                    className="gt-gantt__interaction-preview"
                    data-gt-part="interaction-preview"
                    data-preview-kind={interaction.preview.kind}
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
        className="gt-gantt__live-region"
        data-gt-part="live-region"
      >
        {'announcement' in interaction
          ? interaction.announcement
          : interaction.status === 'pending'
            ? 'Chart update pending.'
            : ''}
      </div>
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
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const { className, label = 'Gantt chart', locale = 'en-US', onDiagnostics, taskVariants } = props;
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
    onDiagnostics?.(scene.diagnostics);
  }, [onDiagnostics, scene.diagnostics]);
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

  return (
    <GanttRuntimeProvider runtime={runtime}>
      <GanttSurface
        bodyRef={bodyRef}
        className={className}
        dateFormatter={dateFormatter}
        disabled={disabled}
        label={label}
        runtime={runtime}
        scene={scene}
        taskVariants={taskVariants}
        timelineRef={timelineRef}
      />
    </GanttRuntimeProvider>
  );
});

Gantt.displayName = 'Gantt';

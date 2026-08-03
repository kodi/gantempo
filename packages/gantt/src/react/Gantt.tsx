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
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';

import { createGanttLocalization, type GanttLocalization } from '../localization/format';
import { createAppearanceRegistry } from '../render/appearance';
import type { TaskBarPrimitive } from '../render/primitives';
import { GanttRuntimeProvider, useGanttSelector } from './context';
import { GanttLocalizationProvider } from './localization-context';
import {
  createGanttReactRuntime,
  type GanttReactRuntime,
  type GanttReactRuntimeSnapshot,
} from './runtime';
import {
  DefaultContextMenu,
  DefaultDependencyProperties,
  DefaultItemProperties,
  DefaultLaneHeader,
  DefaultTaskEditor,
  DefaultTooltip,
} from './surfaces';
import {
  elapsedDuration,
  itemPropertiesCommand,
  lanePropertiesValue,
  taskEditDisabledReason,
  taskEditorCommand,
  taskPropertiesValue,
  validateItemPropertiesValue,
  validateTaskEditorValue,
} from './renderer/editor-commands';
import { AccessibleDependencies } from './renderer/AccessibleDependencies';
import { AccessibleTreeGrid } from './renderer/AccessibleTreeGrid';
import { DependencyLayer } from './renderer/DependencyLayer';
import { GridLayer } from './renderer/GridLayer';
import {
  DependencyPreview,
  InteractionPreview,
  ProgressPreviewValue,
} from './renderer/InteractionPreview';
import { LaneGrid } from './renderer/LaneGrid';
import { LaneTimelineCells } from './renderer/LaneTimelineCells';
import {
  idleClassState,
  inspectionSelectionKey,
  joinClasses,
  laneSummary,
  resolveClassName,
  taskSummary,
  taskTarget,
} from './renderer/presentation';
import { TaskLayer } from './renderer/TaskLayer';
import { TimeHeader } from './renderer/TimeHeader';
import { ZoomControls } from './renderer/ZoomControls';
import { useOverlayController } from './renderer/overlays/controller';
import { OverlayLayer } from './renderer/overlays/OverlayLayer';
import { useMeasuredViewport } from './renderer/dom/useMeasuredViewport';
import { useWheelNavigation } from './renderer/dom/useWheelNavigation';
import { keyboardActionForEvent } from './renderer/dom/keyboard';
import { usePointerInteractions } from './renderer/dom/usePointerInteractions';
import { useFocusBridge } from './renderer/dom/useFocusBridge';
import {
  buildDependencySummaryMap,
  buildGanttSurfaceModel,
  stabilizeDependencyPaths,
} from './renderer/surface-model';
import type {
  GanttContextMenuItem,
  GanttDependencySummary,
  GanttDependencyPropertiesValue,
  GanttHandle,
  GanttItemPropertiesValue,
  GanttLaneColumn,
  GanttProps,
  GanttTaskEditorValue,
} from './types';
import '../styles.css';

export type { GanttHandle, GanttProps } from './types';

interface GanttRootStyle extends CSSProperties {
  readonly '--gt-lane-column-width': string;
  readonly '--gt-timeline-height': string;
  readonly '--gt-timeline-height-ratio': number;
}

function GanttSurface({
  appearanceVariants,
  bodyRef,
  chartRef,
  className,
  classNames,
  columns,
  contextMenuItems,
  disabled,
  features,
  interactionMappers,
  label,
  localization,
  onTaskEditRequest,
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
  readonly disabled: boolean;
  readonly features?: GanttProps['features'];
  readonly interactionMappers?: GanttProps['interactionMappers'];
  readonly label: string;
  readonly localization: GanttLocalization;
  readonly onTaskEditRequest?: GanttProps['onTaskEditRequest'];
  readonly overlayContainer?: GanttProps['overlayContainer'];
  readonly panCapable: boolean;
  readonly runtime: GanttReactRuntime;
  readonly scene: GanttReactRuntimeSnapshot['scene'];
  readonly slots?: GanttProps['slots'];
  readonly timelineRef: React.RefObject<HTMLDivElement | null>;
}): ReactElement {
  const interaction = useGanttSelector((snapshot) => snapshot.interaction);
  const canonicalDocument = useGanttSelector((snapshot) => snapshot.document);
  const dependencySummaries = useGanttSelector((snapshot) => snapshot.dependencies);
  const focused = useGanttSelector((snapshot) => snapshot.session.focused);
  const selection = useGanttSelector((snapshot) => snapshot.session.selection);
  const scaleLevel = useGanttSelector((snapshot) => snapshot.scaleLevel);
  const verticalStart = useGanttSelector((snapshot) => snapshot.session.viewport.verticalStart);
  const timelineWidth = useGanttSelector((snapshot) =>
    snapshot.viewport.status === 'measured' ? snapshot.viewport.clientWidth : 960,
  );
  const accessibilityId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const helpId = `${accessibilityId}-keyboard-help`;
  const {
    boundary: overlayBoundary,
    closeEditor,
    closeMenu,
    editor,
    editorErrorId,
    editorId,
    editorSurfaceRef,
    host: overlayHost,
    menu,
    menuId,
    menuSurfaceRef,
    position: overlayPosition,
    setEditor,
    setLocalHost: setLocalOverlayHost,
    setMenu,
    setTooltip,
    showTooltip: showOverlayTooltip,
    tooltip,
    tooltipId,
    tooltipSurfaceRef,
  } = useOverlayController({
    accessibilityId,
    className,
    interaction,
    overlayContainer,
    rootRef,
    slots,
  });
  const dependencyMarkerId = `${accessibilityId.replaceAll(':', '')}-dependency-arrow`;
  const tooltipEnabled = features?.tooltip === true || slots?.Tooltip !== undefined;
  const menuEnabled =
    features?.contextMenu === true ||
    slots?.ContextMenu !== undefined ||
    contextMenuItems !== undefined ||
    onTaskEditRequest !== undefined;
  const propertiesEnabled =
    features?.properties === true ||
    slots?.ItemProperties !== undefined ||
    slots?.DependencyProperties !== undefined;
  const legacyEditorEnabled = features?.editor === true || slots?.TaskEditor !== undefined;
  const editorEnabled = propertiesEnabled || legacyEditorEnabled;
  const registeredAppearanceVariants = useMemo(
    () => Object.freeze([...createAppearanceRegistry(appearanceVariants).byId.values()]),
    [appearanceVariants],
  );
  const {
    columnTemplate,
    laneColumnWidth,
    laneSummaries,
    resolvedColumns,
    taskByViewKey,
    taskDomIds,
    taskDomIdsByLane,
  } = useMemo(
    () =>
      buildGanttSurfaceModel({
        accessibilityId,
        columns,
        dependencySummaries: [],
        propertiesEnabled,
        scene,
      }),
    [accessibilityId, columns, propertiesEnabled, scene],
  );
  const dependencySummaryByIdRef = useRef<ReadonlyMap<string, GanttDependencySummary>>(new Map());
  const dependencySummaryById = useMemo(
    () => buildDependencySummaryMap(dependencySummaries, dependencySummaryByIdRef.current),
    [dependencySummaries],
  );
  dependencySummaryByIdRef.current = dependencySummaryById;
  const stableDependencyPathsRef = useRef(scene.dependencyPaths);
  const stableDependencyPaths = stabilizeDependencyPaths(
    stableDependencyPathsRef.current,
    scene.dependencyPaths,
  );
  stableDependencyPathsRef.current = stableDependencyPaths;
  const progressEditableTaskIds = useMemo(
    () =>
      new Set(
        disabled
          ? []
          : canonicalDocument.tasks.filter((task) => task.kind === 'task').map((task) => task.id),
      ),
    [canonicalDocument.tasks, disabled],
  );
  const focusedViewKey =
    focused?.kind === 'task' && scene.taskBars.some((task) => task.viewKey === focused.viewKey)
      ? focused.viewKey
      : undefined;
  const focusedDependencyId =
    focused?.kind === 'dependency' &&
    scene.dependencyPaths.some((dependency) => dependency.dependencyId === focused.dependencyId)
      ? focused.dependencyId
      : undefined;
  const logicalTaskFocused = focused?.kind === 'task';
  const logicalDependencyFocused = focused?.kind === 'dependency';
  const rovingViewKey = logicalTaskFocused
    ? focusedViewKey
    : logicalDependencyFocused
      ? undefined
      : scene.taskBars[0]?.viewKey;
  const activeTooltipTask = tooltip === undefined ? undefined : taskByViewKey.get(tooltip.viewKey);
  const activeMenuTask = menu === undefined ? undefined : taskByViewKey.get(menu.viewKey);
  const activeEditorTask = editor?.kind === 'task' ? taskByViewKey.get(editor.viewKey) : undefined;
  const activeEditorLane =
    editor?.kind === 'lane'
      ? scene.lanes.find((lane) => lane.viewKey === editor.viewKey)
      : undefined;
  const activeEditorDependency =
    editor?.kind === 'dependency' ? dependencySummaryById.get(editor.viewKey) : undefined;
  const activeDependencyValue: GanttDependencyPropertiesValue | undefined =
    activeEditorDependency === undefined
      ? undefined
      : Object.freeze({
          dependencyId: activeEditorDependency.dependency.id,
          fromTitle: activeEditorDependency.fromTitle,
          ...(activeEditorDependency.dependency.lag === undefined
            ? {}
            : { lag: activeEditorDependency.dependency.lag }),
          toTitle: activeEditorDependency.toTitle,
          type: activeEditorDependency.dependency.type,
        });
  const activeEditorValue =
    editor?.mode !== 'properties'
      ? undefined
      : activeEditorTask !== undefined
        ? taskPropertiesValue(activeEditorTask, runtime.getSnapshot().selector.document)
        : activeEditorLane !== undefined
          ? lanePropertiesValue(activeEditorLane, runtime.getSnapshot().selector.document)
          : undefined;
  const editorOpen = editor !== undefined;
  const dependencyPreview =
    'preview' in interaction && interaction.preview?.kind === 'dependency'
      ? interaction.preview
      : undefined;
  const dependencyPreviewSource =
    dependencyPreview === undefined
      ? undefined
      : taskByViewKey.get(dependencyPreview.source.viewKey);
  const dependencyPreviewTarget =
    dependencyPreview?.target === undefined
      ? undefined
      : taskByViewKey.get(dependencyPreview.target.viewKey);

  useFocusBridge({
    bodyRef,
    focusedDependencyId,
    focusedViewKey,
    logicalTaskFocused,
    rootRef,
    verticalStart,
  });
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
        (editor.kind === 'dependency' && activeEditorDependency === undefined) ||
        (editor.mode === 'properties' &&
          editor.kind !== 'dependency' &&
          activeEditorValue === undefined))
    ) {
      closeEditor();
    }
  }, [
    activeEditorDependency,
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
  const dismissOverlays = useCallback(() => {
    setTooltip(undefined);
    setMenu(undefined);
  }, [setMenu, setTooltip]);
  const {
    consumeTaskDrag,
    geometry,
    onHeaderPointerCancel,
    onHeaderPointerDown,
    onHeaderPointerMove,
    onHeaderPointerUp,
    onLinkPointerDown,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    panState,
  } = usePointerInteractions({
    bodyRef,
    createTaskEnabled: interactionMappers?.createTask !== undefined,
    disabled,
    dismissOverlays,
    editorOpen,
    panCapable,
    runtime,
    timelineRef,
  });
  const showTooltip = useCallback(
    (element: Element, task: TaskBarPrimitive) => {
      showOverlayTooltip(tooltipEnabled, task.viewKey, element);
    },
    [showOverlayTooltip, tooltipEnabled],
  );
  const openEditor = useCallback(
    (viewKey: string): boolean => {
      const task = runtime
        .getSnapshot()
        .scene.taskBars.find((candidate) => candidate.viewKey === viewKey);
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
    [disabled, legacyEditorEnabled, propertiesEnabled, runtime],
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
  const onToggleProject = useCallback(
    (taskId: string, expanded: boolean) => runtime.toggleProjectTask(taskId, expanded),
    [runtime],
  );
  const openDependencyProperties = useCallback(
    (dependencyId: string): boolean => {
      if (!propertiesEnabled) return false;
      const dependency = runtime
        .getSnapshot()
        .selector.dependencies.find((candidate) => candidate.target.dependencyId === dependencyId);
      if (dependency === undefined) return false;
      runtime.inspectDependency(dependencyId);
      setTooltip(undefined);
      setMenu(undefined);
      setEditor({
        kind: 'dependency',
        mode: 'properties',
        pending: false,
        selectionKey: inspectionSelectionKey(runtime.getSnapshot().selector.session.selection),
        viewKey: dependencyId,
      });
      return true;
    },
    [propertiesEnabled, runtime],
  );
  const onDependencyActivate = useCallback(
    (dependencyId: string) => runtime.inspectDependency(dependencyId),
    [runtime],
  );
  const onDependencyDelete = useCallback(
    (summary: GanttDependencySummary) => {
      void runtime.dispatchAction(
        { id: summary.dependency.id, type: 'dependency.delete' },
        {
          action: 'delete',
          source: { kind: 'context-menu' },
          target: summary.target,
        },
      );
    },
    [runtime],
  );
  const onFit = useCallback(() => {
    runtime.fitToProject();
  }, [runtime]);
  const onZoom = useCallback(
    (level: Parameters<GanttReactRuntime['zoomTo']>[0]) => {
      runtime.zoomTo(level);
    },
    [runtime],
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
      if (consumeTaskDrag(task.viewKey)) return;
      if (propertiesEnabled) {
        openEditor(task.viewKey);
      }
    },
    [consumeTaskDrag, openEditor, propertiesEnabled],
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
  const onFocusCapture = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const target = event.target;
      const viewKey =
        target instanceof Element
          ? target.closest<SVGGElement>('[data-gt-part="task"]')?.dataset.viewKey
          : undefined;
      if (viewKey !== undefined) {
        runtime.keyboardFocus(viewKey);
        return;
      }
      const dependencyId =
        target instanceof Element
          ? target.closest<SVGGElement>('[data-gt-part="dependency"]')?.dataset.dependencyId
          : undefined;
      if (dependencyId !== undefined) {
        runtime.inspectDependency(dependencyId);
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
        interaction.status === 'keyboard'
          ? interaction.mode
          : interaction.status === 'linking'
            ? 'link'
            : undefined,
      );
      if (
        disabled &&
        action?.type !== 'navigate' &&
        action?.type !== 'page' &&
        !(panCapable && (action?.type === 'fit' || action?.type === 'zoom')) &&
        !(propertiesEnabled && action?.type === 'activate')
      ) {
        return;
      }
      const bounds = geometry();
      if (
        action === undefined ||
        (bounds === undefined &&
          action.type !== 'fit' &&
          action.type !== 'history' &&
          action.type !== 'zoom') ||
        !runtime.keyboardAction({
          action,
          ...(bounds === undefined ? {} : { geometry: bounds }),
        })
      ) {
        return;
      }
      if (action.type === 'activate' && focusedViewKey !== undefined && editorEnabled) {
        openEditor(focusedViewKey);
      } else if (
        action.type === 'activate' &&
        focusedDependencyId !== undefined &&
        propertiesEnabled
      ) {
        openDependencyProperties(focusedDependencyId);
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [
      disabled,
      editorEnabled,
      focusedViewKey,
      focusedDependencyId,
      geometry,
      interaction,
      menuEnabled,
      openContextMenu,
      openEditor,
      openDependencyProperties,
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
  const activeEditorLaneRecord =
    activeEditorLane?.laneId === undefined
      ? undefined
      : currentDocument.lanes.find((lane) => lane.id === activeEditorLane.laneId);
  const propertyLaneOptions = currentDocument.lanes.map((lane) =>
    Object.freeze({ id: lane.id, title: lane.title }),
  );
  const propertyParentOptions = currentDocument.tasks
    .filter((task) => task.kind === 'summary')
    .map((task) => Object.freeze({ id: task.id, title: task.title }));
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
      : onTaskEditRequest !== undefined
        ? disabled
          ? 'The chart is read-only.'
          : undefined
        : propertiesEnabled
          ? taskPropertiesValue(activeMenuTask, runtime.getSnapshot().selector.document) ===
            undefined
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
            label:
              onTaskEditRequest !== undefined
                ? 'Edit properties'
                : propertiesEnabled
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
      if (onTaskEditRequest !== undefined) {
        onTaskEditRequest(
          Object.freeze({
            source: 'context-menu',
            target,
          }),
        );
        return;
      }
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
  const onDependencyPropertiesSubmit = (value: GanttDependencyPropertiesValue) => {
    if (
      editor?.kind !== 'dependency' ||
      editor.pending ||
      activeEditorDependency === undefined ||
      disabled
    ) {
      return;
    }
    if (
      value.lag !== undefined &&
      (!Number.isFinite(value.lag.value) || value.lag.mode === 'working')
    ) {
      setEditor((current) =>
        current === undefined
          ? undefined
          : { ...current, error: 'Lag must be a finite elapsed duration.', pending: false },
      );
      return;
    }
    const previous = activeEditorDependency.dependency;
    const changes = {
      ...(value.type === previous.type ? {} : { type: value.type }),
      ...(JSON.stringify(value.lag) === JSON.stringify(previous.lag)
        ? {}
        : { lag: value.lag ?? null }),
    };
    if (Object.keys(changes).length === 0) {
      closeEditor();
      return;
    }
    const dependencyId = previous.id;
    setEditor((current) => {
      if (current === undefined) return undefined;
      const { error: _error, ...next } = current;
      return { ...next, pending: true };
    });
    void runtime
      .dispatchAction(
        { changes, id: dependencyId, type: 'dependency.update' },
        {
          action: 'dependency',
          source: { kind: 'editor' },
          target: activeEditorDependency.target,
        },
      )
      .then((result) => {
        if (result.status === 'rejected') {
          setEditor((current) =>
            current?.viewKey !== dependencyId
              ? current
              : {
                  ...current,
                  error: result.diagnostics[0]?.message ?? 'The dependency update was rejected.',
                  pending: false,
                },
          );
        }
      });
  };
  const onDependencyPropertiesDelete = () => {
    if (
      editor?.kind !== 'dependency' ||
      editor.pending ||
      activeEditorDependency === undefined ||
      disabled
    ) {
      return;
    }
    setEditor((current) => {
      if (current === undefined) return undefined;
      const { error: _error, ...next } = current;
      return { ...next, pending: true };
    });
    void runtime.dispatchAction(
      { id: activeEditorDependency.dependency.id, type: 'dependency.delete' },
      {
        action: 'delete',
        source: { kind: 'editor' },
        target: activeEditorDependency.target,
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
  const laneSummariesRef = useRef(laneSummaries);
  laneSummariesRef.current = laneSummaries;
  const renderLaneColumn = useCallback(
    (column: GanttLaneColumn, laneViewKey: string): ReactNode => {
      const lane = laneSummariesRef.current.get(laneViewKey)!;
      if (column.renderCell !== undefined) {
        return column.renderCell({ disabled, lane });
      }
      return <LaneHeader {...idleClassState(disabled, lane.target)} lane={lane} />;
    },
    [LaneHeader, disabled],
  );
  const Tooltip = slots?.Tooltip ?? DefaultTooltip;
  const ContextMenu = slots?.ContextMenu ?? DefaultContextMenu;
  const TaskEditor = slots?.TaskEditor ?? DefaultTaskEditor;
  const DependencyProperties = slots?.DependencyProperties ?? DefaultDependencyProperties;
  const editorClassState =
    activeEditorTask !== undefined
      ? overlayClassState(activeEditorTask)
      : activeEditorLane !== undefined
        ? idleClassState(disabled, laneSummary(activeEditorLane).target)
        : activeEditorDependency !== undefined
          ? idleClassState(disabled, activeEditorDependency.target)
          : rootClassState;
  const editorBindings = {
    'aria-describedby': editor?.error === undefined ? undefined : editorErrorId,
    'aria-label':
      editor?.kind === 'dependency' && activeEditorDependency !== undefined
        ? `${disabled ? 'View' : 'Edit'} ${activeEditorDependency.fromTitle} to ${activeEditorDependency.toTitle} dependency`
        : editor?.mode === 'properties' && activeEditorValue !== undefined
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
    dir: localization.direction,
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
  const overlays = (
    <OverlayLayer host={overlayHost}>
      <>
        {tooltip !== undefined && activeTooltipSummary !== undefined ? (
          <Tooltip
            bindings={{
              className: joinClasses(
                'gt-gantt__tooltip',
                resolveClassName(classNames?.tooltip, overlayClassState(activeTooltipTask!)),
              ),
              dir: localization.direction,
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
              dir: localization.direction,
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
          (editor.mode === 'properties' &&
            (activeEditorValue !== undefined || activeDependencyValue !== undefined))) ? (
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
            {editor.kind === 'dependency' && activeDependencyValue !== undefined ? (
              <DependencyProperties
                bindings={editorBindings}
                {...(editor.error === undefined ? {} : { error: editor.error })}
                errorId={editorErrorId}
                initialValue={activeDependencyValue}
                key={`dependency:${activeDependencyValue.dependencyId}`}
                onCancel={() => closeEditor()}
                onDelete={onDependencyPropertiesDelete}
                onSubmit={onDependencyPropertiesSubmit}
                pending={editor.pending}
                readOnly={disabled}
              />
            ) : editor.mode === 'properties' && activeEditorValue !== undefined ? (
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
                  parentTasks={propertyParentOptions}
                  pending={editor.pending}
                  readOnly={disabled}
                  {...(activeEditorLaneRecord?.resourceId === undefined
                    ? {}
                    : { resourceId: activeEditorLaneRecord.resourceId })}
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
      </>
    </OverlayLayer>
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
      dir={localization.direction}
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
        open the enabled task menu, L to link the focused task, M to move, P to adjust progress, S
        or E to resize, N to create, Delete to remove, and platform undo or redo shortcuts. In link,
        move, progress, or resize mode, viewport gestures do not edit tasks; use arrow keys, Home or
        End for progress boundaries, Enter to commit, and Escape to cancel. Focus a dependency and
        press Enter to inspect it or Delete to remove it. Use plus and minus to zoom and zero to fit
        the project. All-day task editing is not available in this interaction version.
        {propertiesEnabled
          ? ' Use each visible lane properties button to inspect or edit a persisted lane.'
          : ''}
      </p>
      {panCapable ? (
        <ZoomControls
          localization={localization}
          onFit={onFit}
          onZoom={onZoom}
          scaleLevel={scaleLevel}
        />
      ) : null}
      <AccessibleDependencies
        dependencies={dependencySummaries}
        disabled={disabled}
        localization={localization}
        onDelete={onDependencyDelete}
        onInspect={onDependencyActivate}
        onOpenProperties={openDependencyProperties}
        propertiesEnabled={propertiesEnabled}
        scene={scene}
      />
      <AccessibleTreeGrid
        accessibilityId={accessibilityId}
        helpId={helpId}
        label={label}
        renderLaneColumn={renderLaneColumn}
        resolvedColumns={resolvedColumns}
        scene={scene}
        taskDomIdsByLane={taskDomIdsByLane}
      />
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
        <TimeHeader
          onPointerCancel={onHeaderPointerCancel}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          scene={scene}
        />
        {scene.emptyState ? (
          <div aria-hidden="true" className="gt-gantt__empty" data-gt-part="empty-state">
            <strong>{scene.emptyState.title}</strong>
            <span>{scene.emptyState.description}</span>
          </div>
        ) : (
          <div className="gt-gantt__body-scroll" data-gt-part="viewport" ref={bodyRef}>
            <div className="gt-gantt__body" style={{ height: scene.bounds.timelineHeight }}>
              <LaneGrid
                accessibilityId={accessibilityId}
                classNames={classNames}
                columnTemplate={columnTemplate}
                disabled={disabled}
                laneSummaries={laneSummaries}
                localization={localization}
                onOpenProperties={openLaneProperties}
                onToggleProject={onToggleProject}
                propertiesEnabled={propertiesEnabled}
                renderLaneColumn={renderLaneColumn}
                resolvedColumns={resolvedColumns}
                scene={scene}
              />

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
                <LaneTimelineCells
                  classNames={classNames}
                  disabled={disabled}
                  laneSummaries={laneSummaries}
                  scene={scene}
                />
                <svg role="presentation">
                  <defs>
                    <marker
                      id={dependencyMarkerId}
                      markerHeight="8"
                      markerUnits="userSpaceOnUse"
                      markerWidth="8"
                      orient="auto-start-reverse"
                      refX="7"
                      refY="4"
                      viewBox="0 0 8 8"
                    >
                      <path
                        className={joinClasses(
                          'gt-gantt__dependency-marker',
                          resolveClassName(classNames?.dependencyMarker, rootClassState),
                        )}
                        d="M 0 0 L 8 4 L 0 8 z"
                      />
                    </marker>
                  </defs>
                  <GridLayer scene={scene} />

                  <DependencyLayer
                    classNames={classNames}
                    dependencies={stableDependencyPaths}
                    dependencySummaryById={dependencySummaryById}
                    disabled={disabled}
                    localization={localization}
                    markerId={dependencyMarkerId}
                    onActivate={onDependencyActivate}
                    onOpenProperties={openDependencyProperties}
                    timelineHeight={scene.bounds.timelineHeight}
                    timelineWidth={timelineWidth}
                  />

                  <DependencyPreview
                    direction={localization.direction}
                    markerId={dependencyMarkerId}
                    source={dependencyPreviewSource}
                    target={dependencyPreviewTarget}
                    timelineHeight={scene.bounds.timelineHeight}
                  />

                  <TaskLayer
                    classNames={classNames}
                    disabled={disabled}
                    helpId={helpId}
                    linkEnabled={!disabled && interaction.status !== 'pending'}
                    localization={localization}
                    onActivate={onTaskActivate}
                    onContextMenu={onTaskContextMenu}
                    onFocus={onTaskFocus}
                    onLinkPointerDown={onLinkPointerDown}
                    onMouseEnter={onTaskMouseEnter}
                    onMouseLeave={onTaskMouseLeave}
                    progressEditableTaskIds={progressEditableTaskIds}
                    rovingViewKey={rovingViewKey}
                    slots={slots}
                    taskDomIds={taskDomIds}
                    tasks={scene.taskBars}
                    timelineHeight={scene.bounds.timelineHeight}
                    tooltipId={tooltipId}
                    tooltipViewKey={tooltip?.viewKey}
                  />
                </svg>
                <InteractionPreview interaction={interaction} />
              </div>
              <ProgressPreviewValue interaction={interaction} />
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
    label: suppliedLabel,
    onDiagnostics,
    onTaskEditRequest,
    overlayContainer,
    slots,
  } = props;
  const localization = useMemo(
    () =>
      createGanttLocalization({
        ...(props.direction === undefined ? {} : { direction: props.direction }),
        ...(props.formatters === undefined ? {} : { formatters: props.formatters }),
        ...(props.locale === undefined ? {} : { locale: props.locale }),
        ...(props.messages === undefined ? {} : { messages: props.messages }),
        timeZone: props.timeZone,
      }),
    [props.direction, props.formatters, props.locale, props.messages, props.timeZone],
  );
  const label = suppliedLabel ?? localization.message('chart.label');
  const appearanceRegistrySignature = useMemo(
    () => createAppearanceRegistry(props.appearanceVariants).signature,
    [props.appearanceVariants],
  );
  const deliveredAppearanceDiagnostics = useRef<{
    readonly signature: string;
    readonly variants: Set<string>;
  }>({ signature: appearanceRegistrySignature, variants: new Set() });
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
    const seenDiagnostics = new Set<string>();
    const diagnostics = [...scene.diagnostics, ...localization.diagnostics].filter((diagnostic) => {
      const diagnosticKey = `${diagnostic.code}\u0000${diagnostic.path ?? ''}\u0000${diagnostic.message}`;
      if (seenDiagnostics.has(diagnosticKey)) {
        return false;
      }
      seenDiagnostics.add(diagnosticKey);
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
    if (
      diagnostics.length > 0 ||
      scene.diagnostics.length + localization.diagnostics.length === 0
    ) {
      onDiagnostics(diagnostics);
    }
  }, [appearanceRegistrySignature, localization, onDiagnostics, scene.diagnostics]);
  useMeasuredViewport({
    bodyRef,
    empty: scene.emptyState !== undefined,
    runtime,
    timelineRef,
  });
  useWheelNavigation({
    bodyRef,
    chartRef,
    direction: localization.direction,
    empty: scene.emptyState !== undefined,
    runtime,
    timelineRef,
  });

  return (
    <GanttRuntimeProvider runtime={runtime}>
      <GanttLocalizationProvider value={localization}>
        <GanttSurface
          appearanceVariants={props.appearanceVariants}
          bodyRef={bodyRef}
          chartRef={chartRef}
          className={className}
          classNames={classNames}
          columns={columns}
          contextMenuItems={contextMenuItems}
          disabled={disabled}
          features={features}
          interactionMappers={interactionMappers}
          label={label}
          localization={localization}
          onTaskEditRequest={onTaskEditRequest}
          overlayContainer={overlayContainer}
          panCapable={props.defaultRange !== undefined || props.onRangeChange !== undefined}
          runtime={runtime}
          scene={scene}
          slots={slots}
          timelineRef={timelineRef}
        />
      </GanttLocalizationProvider>
    </GanttRuntimeProvider>
  );
});

Gantt.displayName = 'Gantt';

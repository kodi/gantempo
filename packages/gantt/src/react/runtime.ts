import type { EntityReference, GanttCommand } from '../commands/types';
import { mapInteractionIntent } from '../interaction/command-mapping';
import {
  createInteractionPreview,
  IDLE_INTERACTION_GESTURE,
  reduceInteractionGesture,
} from '../interaction/gesture';
import { createInteractionHitTestIndex } from '../interaction/hit-test';
import {
  adjustKeyboardInteraction,
  beginKeyboardInteraction,
  keyboardCreationIntent,
} from '../interaction/keyboard';
import { navigateRuntimeOccurrence } from '../interaction/navigation';
import {
  beginViewportPanGesture,
  endViewportPanGesture,
  IDLE_VIEWPORT_PAN_GESTURE,
  moveViewportPanGesture,
  type ViewportPanAxis,
  type ViewportPanGestureState,
} from '../interaction/pan-gesture';
import {
  pageTimeRange,
  pageVerticalViewport,
  shiftVerticalViewport,
} from '../interaction/viewport-navigation';
import type {
  InteractionGestureOptions,
  InteractionGestureState,
  InteractionKeyboardAdjustment,
  InteractionKeyboardMode,
  InteractionKeyboardState,
  InteractionNavigationDirection,
  InteractionPoint,
  InteractionPointerType,
  InteractionPreviewPrimitive,
} from '../interaction/types';
import type { Diagnostic } from '../model/diagnostics';
import { createGanttLocalization, type GanttLocalization } from '../localization/format';
import type { GanttDirection } from '../localization/types';
import type { EntityId, EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import { validateDocumentReferences } from '../model/validate';
import { resolveTaskPresentations } from '../presentation/resolve-task-presentations';
import { createChartScenePipeline, type ChartSceneOccurrence } from '../render/scene-pipeline';
import type { ChartScene, TaskBarPrimitive } from '../render/primitives';
import {
  createGanttCommandBus,
  createGanttCommandCancellationController,
} from '../runtime/command-bus';
import { sessionEqual } from '../runtime/session';
import { createGanttRuntimeStore } from '../runtime/store';
import { createRangeProposalController } from '../runtime/range-proposals';
import {
  adjacentTimeScaleLevel,
  clampTimeScaleLevel,
  fitTimeRange,
  resolveAdaptiveScaleLevel,
  timeScaleLevelSpan,
  zoomRangeToLevel,
  type GanttTimeScaleDefinition,
  type GanttTimeScaleLevel,
} from '../time/adaptive-scale';
import type {
  GanttCommandBus,
  GanttCommandSource,
  GanttDispatchResult,
  GanttInteractionTarget,
  GanttDependencyTarget,
  GanttRuntimeErrorEvent,
  GanttRuntimeOccurrence,
  GanttRuntimeSnapshot,
  GanttRuntimeStore,
  GanttSessionState,
  GanttTaskTarget,
  GanttViewportMeasurement,
} from '../runtime/types';
import type {
  GanttHandle,
  GanttInteractionAction,
  GanttInteractionPreview,
  GanttInteractionState,
  GanttProps,
  GanttScrollOptions,
  GanttSelectorSnapshot,
  GanttSemanticEvent,
  GanttVisibleOccurrence,
} from './types';
import { sameViewDefinition } from '../view/definition-equality';

export interface GanttReactRuntimeSnapshot {
  readonly occurrenceCatalog: readonly ChartSceneOccurrence[];
  readonly scene: ChartScene;
  readonly selector: GanttSelectorSnapshot;
  readonly version: number;
}

export interface GanttReactRuntime {
  activate(): void;
  beginDependencyLink(viewKey: string, pointerType?: InteractionPointerType): boolean;
  cancelDependencyLink(): boolean;
  clearMeasurement(): void;
  clearTaskFocusAndSelection(): boolean;
  deactivate(): void;
  dispose(): void;
  dispatchAction(
    command: GanttCommand,
    options: {
      readonly action: GanttInteractionAction;
      readonly source: Extract<GanttCommandSource, { readonly kind: 'context-menu' | 'editor' }>;
      readonly target: GanttInteractionTarget;
    },
  ): Promise<GanttDispatchResult>;
  fitToProject(options?: Parameters<GanttHandle['fitToProject']>[0]): boolean;
  getHandle(): GanttHandle;
  getSnapshot(): GanttReactRuntimeSnapshot;
  inspectLane(viewKey: string): boolean;
  inspectDependency(dependencyId: string): boolean;
  inspectTask(viewKey: string): boolean;
  keyboardAction(input: GanttKeyboardActionInput): boolean;
  keyboardFocus(viewKey: string): boolean;
  measure(measurement: GanttViewportMeasurement): void;
  navigateViewport(input: GanttViewportNavigationInput): GanttViewportNavigationResult;
  panPointerCancel(pointerId: number): boolean;
  panPointerDown(input: GanttPanPointerInput): boolean;
  panPointerMove(input: GanttPanPointerMoveInput): GanttPanPointerMoveResult;
  panPointerUp(pointerId: number): GanttPanPointerEndResult;
  pointerCancel(pointerId: number): boolean;
  pointerDown(input: GanttPointerInput): boolean;
  pointerMove(input: GanttPointerMoveInput): boolean;
  pointerUp(pointerId: number): Promise<void>;
  commitDependencyLink(): Promise<boolean>;
  reconcile(props: GanttProps): void;
  subscribe(subscriber: () => void): () => void;
  toggleProjectTask(taskId: EntityId, expanded?: boolean): boolean;
  updateDependencyLink(viewKey?: string): boolean;
  updateCallbacks(props: GanttProps): void;
  zoomTo(level: GanttTimeScaleLevel, options?: Parameters<GanttHandle['zoomTo']>[1]): boolean;
}

export interface GanttPointerGeometry {
  readonly height: number;
  readonly verticalStart: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface GanttPointerInput {
  readonly candidateViewKey?: string;
  readonly geometry: GanttPointerGeometry;
  readonly point: InteractionPoint;
  readonly pointerId: number;
  readonly pointerType: InteractionPointerType;
  readonly progressCandidateViewKey?: string;
}

export interface GanttPointerMoveInput {
  readonly candidateViewKey?: string;
  readonly geometry: GanttPointerGeometry;
  readonly point: InteractionPoint;
  readonly pointerId: number;
  readonly progressCandidateViewKey?: string;
}

export interface GanttViewportNavigationInput {
  readonly horizontalDelta?: number;
  readonly reason?: 'pan' | 'scroll';
  readonly source?: Extract<GanttSemanticEvent['source'], 'imperative' | 'runtime'>;
  readonly verticalDelta?: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

export interface GanttViewportNavigationResult {
  readonly horizontal: boolean;
  readonly vertical: boolean;
}

export interface GanttPanPointerInput {
  readonly axis: ViewportPanAxis;
  readonly geometry: GanttPointerGeometry;
  readonly point: InteractionPoint;
  readonly pointerId: number;
}

export interface GanttPanPointerMoveInput {
  readonly geometry: GanttPointerGeometry;
  readonly point: InteractionPoint;
  readonly pointerId: number;
}

export interface GanttPanPointerMoveResult {
  readonly active: boolean;
  readonly handled: boolean;
}

export interface GanttPanPointerEndResult {
  readonly active: boolean;
  readonly handled: boolean;
}

export type GanttKeyboardAction =
  | {
      readonly accelerated?: boolean;
      readonly boundary?: 'end' | 'start';
      readonly direction: InteractionKeyboardAdjustment;
      readonly type: 'adjust';
    }
  | { readonly mode: InteractionKeyboardMode; readonly type: 'begin' }
  | { readonly type: 'activate' | 'cancel' | 'commit' | 'create' | 'delete' | 'link' }
  | { readonly direction: InteractionNavigationDirection; readonly type: 'navigate' }
  | {
      readonly axis: 'horizontal' | 'vertical';
      readonly direction: -1 | 1;
      readonly type: 'page';
    }
  | { readonly action: 'redo' | 'undo'; readonly type: 'history' }
  | { readonly direction: 'in' | 'out'; readonly type: 'zoom' }
  | { readonly type: 'fit' }
  | { readonly type: 'toggle-selection' };

export interface GanttKeyboardActionInput {
  readonly action: GanttKeyboardAction;
  readonly geometry?: GanttPointerGeometry;
}

interface DisplayInputs {
  readonly appearanceVariants: GanttProps['appearanceVariants'];
  readonly direction: GanttDirection;
  readonly formatters: GanttProps['formatters'];
  readonly locale: string;
  readonly localization: GanttLocalization;
  readonly messages: GanttProps['messages'];
  readonly range: TimeRange;
  readonly taskVariants: GanttProps['taskVariants'];
  readonly timeScale: GanttTimeScaleDefinition;
  readonly tickAnchor: number;
  readonly tickInterval: number;
  readonly timeZone: string;
  readonly view: GanttProps['view'];
}

function controlledDocument(props: GanttProps): GanttDocument | undefined {
  return props.document;
}

function initialDocument(props: GanttProps): GanttDocument {
  return props.document ?? props.defaultDocument;
}

function initialSession(props: GanttProps) {
  if (props.session !== undefined) {
    return { kind: 'controlled' as const, value: props.session };
  }
  return props.defaultSession === undefined
    ? { kind: 'uncontrolled' as const }
    : { kind: 'uncontrolled' as const, value: props.defaultSession };
}

function displayInputs(props: GanttProps, rangeOverride?: TimeRange): DisplayInputs {
  const localization = createGanttLocalization({
    ...(props.direction === undefined ? {} : { direction: props.direction }),
    ...(props.formatters === undefined ? {} : { formatters: props.formatters }),
    ...(props.locale === undefined ? {} : { locale: props.locale }),
    ...(props.messages === undefined ? {} : { messages: props.messages }),
    timeZone: props.timeZone,
  });
  const timeScale: GanttTimeScaleDefinition = props.timeScale ?? {
    kind: 'fixed',
    tickAnchor: props.tickAnchor!,
    tickInterval: props.tickInterval!,
  };
  return Object.freeze({
    appearanceVariants: props.appearanceVariants,
    direction: localization.direction,
    formatters: props.formatters,
    locale: localization.locale,
    localization,
    messages: props.messages,
    range: Object.freeze({ ...(rangeOverride ?? props.range ?? props.defaultRange) }),
    taskVariants: props.taskVariants,
    tickAnchor: timeScale.kind === 'fixed' ? timeScale.tickAnchor : 0,
    tickInterval: timeScale.kind === 'fixed' ? timeScale.tickInterval : timeScaleLevelSpan('day'),
    timeScale: Object.freeze({ ...timeScale }),
    timeZone: localization.timeZone,
    view: props.view,
  });
}

function displayEqual(previous: DisplayInputs, next: DisplayInputs): boolean {
  return (
    JSON.stringify(previous.appearanceVariants) === JSON.stringify(next.appearanceVariants) &&
    previous.direction === next.direction &&
    previous.formatters === next.formatters &&
    previous.locale === next.locale &&
    JSON.stringify(previous.messages) === JSON.stringify(next.messages) &&
    previous.range.start === next.range.start &&
    previous.range.end === next.range.end &&
    previous.tickAnchor === next.tickAnchor &&
    previous.tickInterval === next.tickInterval &&
    JSON.stringify(previous.timeScale) === JSON.stringify(next.timeScale) &&
    previous.timeZone === next.timeZone &&
    JSON.stringify(previous.taskVariants) === JSON.stringify(next.taskVariants) &&
    sameViewDefinition(previous.view, next.view)
  );
}

function timeScaleDiagnostics(timeScale: GanttTimeScaleDefinition): readonly Diagnostic[] {
  if (
    timeScale.kind !== 'adaptive' ||
    timeScale.minLevel === undefined ||
    timeScale.maxLevel === undefined ||
    timeScaleLevelSpan(timeScale.minLevel) <= timeScaleLevelSpan(timeScale.maxLevel)
  ) {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      code: 'time-scale.invalid-bounds' as const,
      message: 'Adaptive minimum level exceeds its maximum; the minimum bound is used.',
      path: '/timeScale',
      severity: 'warning' as const,
    }),
  ]);
}

function uniqueDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  const seen = new Set<string>();
  return Object.freeze(
    diagnostics.filter((diagnostic) => {
      const key = `${diagnostic.code}\u0000${diagnostic.path ?? ''}\u0000${diagnostic.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

function projectSessionPart(session: GanttSessionState) {
  return session.project === undefined ? {} : { project: session.project };
}

function projectCollapsedTaskIds(
  document: GanttDocument,
  session: GanttSessionState,
  taskId: EntityId,
  expanded?: boolean,
): readonly EntityId[] | undefined {
  const parentIds = new Set(
    document.tasks.flatMap((task) => (task.parentId === undefined ? [] : [task.parentId])),
  );
  if (!parentIds.has(taskId)) {
    return undefined;
  }
  const collapsed = new Set(session.project?.collapsedTaskIds ?? []);
  const currentlyExpanded = !collapsed.has(taskId);
  const nextExpanded = expanded ?? !currentlyExpanded;
  if (nextExpanded === currentlyExpanded) {
    return undefined;
  }
  if (nextExpanded) {
    collapsed.delete(taskId);
  } else {
    collapsed.add(taskId);
  }
  return Object.freeze(
    document.tasks
      .filter((task) => collapsed.has(task.id) && parentIds.has(task.id))
      .map((task) => task.id),
  );
}

function taskTarget(task: TaskBarPrimitive | ChartSceneOccurrence): GanttTaskTarget {
  return Object.freeze({
    ...(task.assignmentId === undefined ? {} : { assignmentId: task.assignmentId }),
    kind: 'task',
    ...(task.laneId === undefined ? {} : { laneId: task.laneId }),
    laneViewKey: task.laneViewKey,
    ...(task.placementId === undefined ? {} : { placementId: task.placementId }),
    ...(task.resourceId === undefined ? {} : { resourceId: task.resourceId }),
    ...(task.segmentId === undefined ? {} : { segmentId: task.segmentId }),
    taskId: task.taskId,
    viewKey: task.viewKey,
  });
}

function laneTarget(
  lane: ChartScene['lanes'][number],
): Extract<GanttInteractionTarget, { readonly kind: 'lane' }> {
  return Object.freeze({
    kind: 'lane',
    ...(lane.laneId === undefined ? {} : { laneId: lane.laneId }),
    ...(lane.resourceId === undefined ? {} : { resourceId: lane.resourceId }),
    viewKey: lane.viewKey,
  });
}

function dependencyTarget(dependencyId: EntityId): GanttDependencyTarget {
  return Object.freeze({ dependencyId, kind: 'dependency' });
}

function occurrences(
  scene: ChartScene,
  catalog: readonly ChartSceneOccurrence[],
): {
  readonly dependencies: GanttSelectorSnapshot['dependencies'];
  readonly runtime: readonly GanttRuntimeOccurrence[];
  readonly visible: readonly GanttVisibleOccurrence[];
} {
  const visible = scene.taskBars.map((task) =>
    Object.freeze({
      ...(task.presentation.project?.depth === undefined
        ? {}
        : { depth: task.presentation.project.depth }),
      ...(task.presentation.summary === undefined
        ? {}
        : { descendantCount: task.presentation.summary.descendantCount }),
      end: task.end,
      ...(task.presentation.project?.expanded === undefined
        ? {}
        : { expanded: task.presentation.project.expanded }),
      ...(task.presentation.project?.filterMatch === undefined
        ? {}
        : { filterMatch: task.presentation.project.filterMatch }),
      ...(task.presentation.project?.hasChildren === undefined
        ? {}
        : { hasChildren: task.presentation.project.hasChildren }),
      intervalSource: task.presentation.intervalSource,
      kind: task.presentation.kind,
      ...(task.progress === undefined ? {} : { progress: task.progress.value }),
      ...(task.presentation.summary === undefined
        ? {}
        : { resolvedDescendantCount: task.presentation.summary.resolvedDescendantCount }),
      start: task.start,
      target: taskTarget(task),
      ...(task.presentation.summary === undefined
        ? {}
        : { unresolvedDescendantCount: task.presentation.summary.unresolvedDescendantCount }),
    }),
  );
  return Object.freeze({
    dependencies: Object.freeze(
      scene.dependencySummaries.map((summary) =>
        Object.freeze({
          dependency: Object.freeze({ ...summary.dependency }),
          fromTitle: summary.fromTitle,
          hiddenEndpoint: summary.hiddenEndpoint,
          status: summary.status,
          target: dependencyTarget(summary.dependency.id),
          toTitle: summary.toTitle,
        }),
      ),
    ),
    runtime: Object.freeze([
      ...scene.lanes.map((lane, laneIndex) =>
        Object.freeze({
          horizontalCenter: 0,
          laneIndex,
          target: laneTarget(lane),
        }),
      ),
      ...catalog.map((task) =>
        Object.freeze({
          horizontalCenter: task.start + (task.end - task.start) / 2,
          laneIndex: task.laneIndex,
          target: taskTarget(task),
        }),
      ),
      ...scene.dependencySummaries.map((dependency) =>
        Object.freeze({
          horizontalCenter: 0,
          laneIndex: 0,
          target: dependencyTarget(dependency.dependency.id),
        }),
      ),
    ]),
    visible: Object.freeze(visible),
  });
}

function targetIdentity(target: GanttInteractionTarget | undefined): string | undefined {
  return target === undefined
    ? undefined
    : target.kind === 'dependency'
      ? `${target.kind}\u0000${target.dependencyId}`
      : `${target.kind}\u0000${target.viewKey}`;
}

function selectionEqual(
  previous: readonly GanttInteractionTarget[],
  next: readonly GanttInteractionTarget[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((target, index) => targetIdentity(target) === targetIdentity(next[index]))
  );
}

function viewportEvent(snapshot: GanttSelectorSnapshot): import('./types').GanttViewportChange {
  return Object.freeze({
    range: snapshot.range,
    session: snapshot.session.viewport,
    measured: snapshot.viewport,
  });
}

function createSelectorSnapshot(
  store: GanttRuntimeSnapshot,
  display: DisplayInputs,
  dependencies: GanttSelectorSnapshot['dependencies'],
  visible: readonly GanttVisibleOccurrence[],
  interaction: GanttInteractionState,
  scaleLevel: GanttTimeScaleLevel,
): GanttSelectorSnapshot {
  return Object.freeze({
    canRedo: store.history.canRedo,
    canUndo: store.history.canUndo,
    document: store.document,
    dependencies,
    interaction,
    occurrences: visible,
    range: display.range,
    scaleLevel,
    session: store.session,
    viewport: store.viewport,
  });
}

function scheduleHostError(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}

function runtimeDiagnostic(callback: GanttRuntimeErrorEvent['callback']): Diagnostic {
  return Object.freeze({
    code: 'runtime.callback-threw',
    message: `${callback} threw while observing an adopted runtime state.`,
    path: `/runtime/${callback}`,
    severity: 'error',
  });
}

function progressEditingDiagnostic(document: GanttDocument, target: GanttTaskTarget): Diagnostic {
  const task = document.tasks.find((candidate) => candidate.id === target.taskId);
  const message =
    task === undefined
      ? `Cannot edit progress for missing task "${target.taskId}".`
      : target.segmentId !== undefined
        ? 'Built-in progress editing does not modify task segments.'
        : task.kind !== 'task'
          ? `Progress editing is not available for ${task.kind} tasks.`
          : 'Progress editing is not available for this occurrence.';
  return Object.freeze({
    code: task === undefined ? 'command.missing-target' : 'command.unsupported-target',
    entityIds: Object.freeze([
      target.taskId,
      ...(target.segmentId === undefined ? [] : [target.segmentId]),
    ]),
    message,
    path: '/interaction',
    severity: 'error',
  });
}

function interactionActionLabel(action: GanttInteractionAction | 'interaction'): string {
  return `${action[0]!.toUpperCase()}${action.slice(1)}`;
}

function derivationInvalidation(snapshot: GanttRuntimeSnapshot):
  | { readonly affected: readonly EntityReference[]; readonly kind: 'affected' }
  | {
      readonly kind: 'external';
    } {
  return snapshot.derivation.kind === 'affected'
    ? Object.freeze({ affected: snapshot.derivation.affected, kind: 'affected' })
    : Object.freeze({ kind: 'external' });
}

export function createGanttReactRuntime(initialProps: GanttProps): GanttReactRuntime {
  const initialValidation = validateDocumentReferences(initialDocument(initialProps));
  let callbacks = initialProps;
  let display = displayInputs(initialProps);
  let inputDiagnostics = Object.freeze([
    ...initialValidation.diagnostics,
    ...display.localization.diagnostics,
    ...timeScaleDiagnostics(display.timeScale),
  ]);
  const documentControlled = controlledDocument(initialProps) !== undefined;
  const sessionControlled = initialProps.session !== undefined;
  const rangeControlled = initialProps.range !== undefined;
  let active = false;
  let activationVersion = 0;
  let disposed = false;
  let rebuilding = false;
  let rebuildPending = false;
  let semanticSource: GanttSemanticEvent['source'] = 'runtime';
  let lastDocument: GanttDocument | undefined;
  let gesture: InteractionGestureState = IDLE_INTERACTION_GESTURE;
  let panGesture: ViewportPanGestureState = IDLE_VIEWPORT_PAN_GESTURE;
  let gestureGeometry: GanttPointerGeometry | undefined;
  let keyboardGesture: InteractionKeyboardState | undefined;
  let dependencyLink:
    | {
        readonly candidate?: GanttTaskTarget;
        readonly pointerType?: InteractionPointerType;
        readonly source: GanttTaskTarget;
      }
    | undefined;
  let dependencyFocusRestore: GanttTaskTarget | undefined;
  let pendingRangeAnnouncement = false;
  let rangeChangeContext: {
    readonly anchorTime?: number;
    readonly reason: import('./types').GanttRangeChangeEvent['reason'];
  } = { reason: 'pan' };
  let interaction: GanttInteractionState = Object.freeze({ status: 'idle' });
  const subscribers = new Set<() => void>();
  const pipeline = createChartScenePipeline();
  const scheduleFrame = (update: () => void): (() => void) | undefined => {
    if (typeof requestAnimationFrame !== 'function') {
      update();
      return undefined;
    }
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  };
  const store: GanttRuntimeStore = createGanttRuntimeStore({
    document: documentControlled
      ? { kind: 'controlled', value: initialValidation.document }
      : { kind: 'uncontrolled', value: initialValidation.document },
    ...(initialProps.historyCapacity === undefined
      ? {}
      : { historyCapacity: initialProps.historyCapacity }),
    session: initialSession(initialProps),
    viewport: {
      schedule: scheduleFrame,
    },
  });
  const rangeProposals = createRangeProposalController({
    canPublish: () => !rangeControlled || callbacks.onRangeChange !== undefined,
    initialRange: display.range,
    publish(range, source) {
      if (!rangeControlled) {
        display = Object.freeze({ ...display, range: Object.freeze({ ...range }) });
        rangeProposals.adopt(range);
        rebuild();
      }
      const event = Object.freeze({
        ...(rangeChangeContext.anchorTime === undefined
          ? {}
          : { anchorTime: rangeChangeContext.anchorTime }),
        reason: rangeChangeContext.reason,
        source,
      });
      emitCallback('onRangeChange', () => callbacks.onRangeChange?.(range, event));
    },
    schedule: scheduleFrame,
  });

  function requestRange(
    range: TimeRange,
    reason: import('./types').GanttRangeChangeEvent['reason'],
    source: 'imperative' | 'runtime',
    anchorTime?: number,
  ): boolean {
    rangeChangeContext = Object.freeze({
      ...(anchorTime === undefined ? {} : { anchorTime }),
      reason,
    });
    return rangeProposals.requestRange(range, source);
  }

  function canChangeRange(): boolean {
    return !rangeControlled || callbacks.onRangeChange !== undefined;
  }

  function localizedAction(action: GanttInteractionAction | 'interaction'): string {
    const key =
      action === 'create'
        ? 'interaction.create'
        : action === 'dependency'
          ? 'interaction.link'
          : action === 'move'
            ? 'interaction.move'
            : action === 'progress'
              ? 'interaction.progress'
              : action === 'resize'
                ? 'interaction.resize'
                : undefined;
    return key === undefined ? interactionActionLabel(action) : display.localization.message(key);
  }

  const bus: GanttCommandBus = createGanttCommandBus({
    canProposeControlledDocument: () => callbacks.onDocumentChange !== undefined,
    ...(initialProps.interceptors === undefined ? {} : { interceptors: initialProps.interceptors }),
    onCommandCommitted(event) {
      if (
        event.source.kind === 'pointer' ||
        event.source.kind === 'keyboard' ||
        event.source.kind === 'history' ||
        event.source.kind === 'context-menu' ||
        event.source.kind === 'editor'
      ) {
        const action =
          event.source.kind === 'history'
            ? event.source.action
            : 'action' in interaction
              ? interaction.action
              : 'preview' in interaction
                ? interaction.preview?.kind
                : undefined;
        const label = localizedAction(action ?? 'interaction');
        const interactionTarget = 'target' in interaction ? interaction.target : undefined;
        if (
          interactionTarget?.kind === 'dependency' &&
          store
            .getSnapshot()
            .document.dependencies.some(
              (dependency) => dependency.id === interactionTarget.dependencyId,
            )
        ) {
          const session = store.getSnapshot().session;
          updateSession(
            Object.freeze({
              focused: interactionTarget,
              ...projectSessionPart(session),
              selection: Object.freeze([interactionTarget]),
              viewport: session.viewport,
            }),
            'runtime',
          );
        } else if (
          interactionTarget?.kind === 'dependency' &&
          dependencyFocusRestore !== undefined
        ) {
          const session = store.getSnapshot().session;
          updateSession(
            Object.freeze({
              focused: dependencyFocusRestore,
              ...projectSessionPart(session),
              selection: Object.freeze([]),
              viewport: session.viewport,
            }),
            'runtime',
          );
        }
        dependencyFocusRestore = undefined;
        setInteraction(
          Object.freeze({
            announcement: display.localization.message('interaction.committed', { action: label }),
            status: 'idle',
          }),
        );
      }
      callbacks.onCommandCommitted?.(event);
    },
    onCommandRejected(event) {
      if (
        event.source.kind === 'pointer' ||
        event.source.kind === 'keyboard' ||
        event.source.kind === 'history' ||
        event.source.kind === 'context-menu' ||
        event.source.kind === 'editor'
      ) {
        const target = 'target' in interaction ? interaction.target : undefined;
        setInteraction(
          Object.freeze({
            announcement:
              event.diagnostics[0]?.message ?? display.localization.message('interaction.rejected'),
            ...(target === undefined ? {} : { target }),
            status: 'rejected',
          }),
        );
      }
      callbacks.onCommandRejected?.(event);
    },
    onDocumentChange(change) {
      callbacks.onDocumentChange?.(change);
    },
    onRuntimeError(event) {
      callbacks.onRuntimeError?.(event);
    },
    reportHostError: scheduleHostError,
    store,
  });

  let snapshot!: GanttReactRuntimeSnapshot;

  function composedInteraction(storeSnapshot = store.getSnapshot()): GanttInteractionState {
    if (storeSnapshot.interaction.status !== 'document-proposal-pending') {
      return interaction;
    }
    const pointerType = 'pointerType' in interaction ? interaction.pointerType : undefined;
    const preview = 'preview' in interaction ? interaction.preview : undefined;
    const target = 'target' in interaction ? interaction.target : undefined;
    const action = 'action' in interaction ? interaction.action : undefined;
    return Object.freeze({
      ...(action === undefined ? {} : { action }),
      ...(pointerType === undefined ? {} : { pointerType }),
      ...(preview === undefined ? {} : { preview }),
      proposalId: storeSnapshot.interaction.proposalId,
      status: 'pending',
      ...(target === undefined ? {} : { target }),
    });
  }

  function setInteraction(next: GanttInteractionState): void {
    interaction = next;
    if (disposed || snapshot === undefined) {
      return;
    }
    publish(
      Object.freeze({
        occurrenceCatalog: snapshot.occurrenceCatalog,
        scene: snapshot.scene,
        selector: Object.freeze({
          ...snapshot.selector,
          interaction: composedInteraction(),
        }),
        version: snapshot.version + 1,
      }),
    );
  }

  function emitCallback(
    name: GanttRuntimeErrorEvent['callback'],
    callback: (() => void) | undefined,
  ): void {
    if (callback === undefined) {
      return;
    }
    try {
      callback();
    } catch (error) {
      const event = Object.freeze({
        callback: name,
        diagnostic: runtimeDiagnostic(name),
        type: 'runtimeError',
      }) satisfies GanttRuntimeErrorEvent;
      try {
        callbacks.onRuntimeError?.(event);
      } catch (runtimeError) {
        scheduleHostError(runtimeError);
      }
      scheduleHostError(error);
    }
  }

  function emitSessionChanges(
    previous: GanttSelectorSnapshot | undefined,
    next: GanttSelectorSnapshot,
  ): void {
    if (!active || previous === undefined || sessionEqual(previous.session, next.session)) {
      return;
    }
    const event = Object.freeze({ source: semanticSource });
    emitCallback('onSessionChange', () => callbacks.onSessionChange?.(next.session, event));
    if (!selectionEqual(previous.session.selection, next.session.selection)) {
      emitCallback('onSelectionChange', () =>
        callbacks.onSelectionChange?.(next.session.selection, event),
      );
    }
    if (targetIdentity(previous.session.focused) !== targetIdentity(next.session.focused)) {
      emitCallback('onFocusChange', () => callbacks.onFocusChange?.(next.session.focused, event));
    }
    if (previous.session.viewport.verticalStart !== next.session.viewport.verticalStart) {
      emitCallback('onViewportChange', () =>
        callbacks.onViewportChange?.(viewportEvent(next), event),
      );
    }
  }

  function emitControlledSessionProposal(
    previous: GanttSessionState,
    next: GanttSessionState,
    source: GanttSemanticEvent['source'],
  ): void {
    if (!active || callbacks.onSessionChange === undefined || sessionEqual(previous, next)) {
      return;
    }
    const event = Object.freeze({ source });
    emitCallback('onSessionChange', () => callbacks.onSessionChange?.(next, event));
  }

  function publish(next: GanttReactRuntimeSnapshot): void {
    const previous = snapshot;
    snapshot = next;
    emitSessionChanges(previous?.selector, next.selector);
    for (const subscriber of Array.from(subscribers)) {
      if (subscribers.has(subscriber)) {
        subscriber();
      }
    }
  }

  function buildSnapshot(): GanttReactRuntimeSnapshot {
    const storeSnapshot = store.getSnapshot();
    const documentChanged = lastDocument !== storeSnapshot.document;
    const invalidation =
      documentChanged && lastDocument !== undefined
        ? derivationInvalidation(storeSnapshot)
        : undefined;
    const viewport =
      storeSnapshot.viewport.status === 'measured' && storeSnapshot.viewport.queryVerticalExtent > 0
        ? {
            verticalExtent: storeSnapshot.viewport.queryVerticalExtent,
            verticalStart: storeSnapshot.viewport.queryVerticalStart,
          }
        : undefined;
    const scaleWidth =
      storeSnapshot.viewport.status === 'measured' && storeSnapshot.viewport.clientWidth > 0
        ? storeSnapshot.viewport.clientWidth
        : 960;
    const scaleLevel = resolveAdaptiveScaleLevel(
      display.range,
      scaleWidth,
      display.timeScale.kind === 'adaptive' ? display.timeScale : { kind: 'adaptive' },
    );
    const derived = pipeline.build(
      {
        ...(display.appearanceVariants === undefined
          ? {}
          : { appearanceVariants: display.appearanceVariants }),
        document: storeSnapshot.document,
        direction: display.direction,
        ...(display.formatters === undefined ? {} : { formatters: display.formatters }),
        range: display.range,
        tickAnchor: display.tickAnchor,
        tickInterval: display.tickInterval,
        ...(display.timeScale.kind === 'adaptive' ? { timeScaleLevel: scaleLevel } : {}),
        ...(display.timeScale.kind === 'adaptive' ? { timeScaleWidth: scaleWidth } : {}),
        timeZone: display.timeZone,
        locale: display.locale,
        ...(storeSnapshot.session.project === undefined
          ? {}
          : { projectQuery: storeSnapshot.session.project }),
        ...(display.view === undefined ? {} : { view: display.view }),
        ...(viewport === undefined ? {} : { viewport }),
        ...(display.taskVariants === undefined ? {} : { taskVariants: display.taskVariants }),
      },
      invalidation,
    );
    const derivedScene = derived.scene;
    const currentInputDiagnostics = uniqueDiagnostics([
      ...inputDiagnostics,
      ...display.localization.diagnostics,
    ]);
    const scene =
      currentInputDiagnostics.length === 0
        ? derivedScene
        : Object.freeze({
            ...derivedScene,
            diagnostics: uniqueDiagnostics([
              ...currentInputDiagnostics,
              ...derivedScene.diagnostics,
            ]),
          });
    lastDocument = storeSnapshot.document;
    const sceneOccurrences = occurrences(scene, derived.occurrences);
    store.setOccurrences(sceneOccurrences.runtime);
    const reconciledStore = store.getSnapshot();
    return Object.freeze({
      occurrenceCatalog: derived.occurrences,
      scene,
      selector: createSelectorSnapshot(
        reconciledStore,
        display,
        sceneOccurrences.dependencies,
        sceneOccurrences.visible,
        composedInteraction(reconciledStore),
        scaleLevel,
      ),
      version: (snapshot?.version ?? -1) + 1,
    });
  }

  function rebuild(): void {
    if (disposed) {
      return;
    }
    if (rebuilding) {
      rebuildPending = true;
      return;
    }
    rebuilding = true;
    try {
      do {
        rebuildPending = false;
        publish(buildSnapshot());
      } while (rebuildPending);
    } finally {
      rebuilding = false;
    }
  }

  const unsubscribeStore = store.subscribe(rebuild);
  rebuild();

  function updateSession(
    next: GanttSessionState,
    source: GanttSemanticEvent['source'] = 'imperative',
  ): boolean {
    if (sessionControlled) {
      if (callbacks.onSessionChange === undefined) {
        return false;
      }
      emitControlledSessionProposal(store.getSnapshot().session, next, source);
      return true;
    }
    semanticSource = source;
    try {
      store.updateUncontrolledSession(next);
    } finally {
      semanticSource = 'runtime';
    }
    return true;
  }

  function visibleTarget(target: GanttTaskTarget): GanttTaskTarget | undefined {
    return snapshot.selector.occurrences.find(
      (occurrence) => occurrence.target.viewKey === target.viewKey,
    )?.target;
  }

  function catalogOccurrence(target: GanttTaskTarget): ChartSceneOccurrence | undefined {
    return snapshot.occurrenceCatalog.find((occurrence) => occurrence.viewKey === target.viewKey);
  }

  function alignedVerticalStart(
    task: Pick<ChartSceneOccurrence, 'height' | 'y'>,
    options?: GanttScrollOptions,
  ): number {
    const extent =
      snapshot.selector.viewport.status === 'measured'
        ? snapshot.selector.viewport.clientHeight
        : snapshot.scene.bounds.defaultLaneHeight;
    const align = options?.align ?? 'center';
    const start =
      align === 'start'
        ? task.y
        : align === 'end'
          ? task.y + task.height - extent
          : task.y + task.height / 2 - extent / 2;
    return Math.max(0, Math.min(start, Math.max(0, snapshot.scene.bounds.timelineHeight - extent)));
  }

  function alignedTaskRange(
    task: Pick<ChartSceneOccurrence, 'end' | 'start'>,
    options?: GanttScrollOptions,
  ): TimeRange {
    const duration = display.range.end - display.range.start;
    const align = options?.align ?? 'center';
    const start =
      align === 'start'
        ? task.start
        : align === 'end'
          ? task.end - duration
          : task.start + (task.end - task.start) / 2 - duration / 2;
    return Object.freeze({ start, end: start + duration });
  }

  function interactionOptions(geometry: GanttPointerGeometry): InteractionGestureOptions {
    if (
      !Number.isFinite(geometry.x) ||
      !Number.isFinite(geometry.y) ||
      !Number.isFinite(geometry.width) ||
      !Number.isFinite(geometry.height) ||
      !Number.isFinite(geometry.verticalStart) ||
      geometry.width <= 0 ||
      geometry.height <= 0 ||
      geometry.verticalStart < 0
    ) {
      throw new RangeError('Pointer interaction geometry must be finite and visible.');
    }
    const snap = callbacks.interactionSnap ?? {
      anchor: display.tickAnchor,
      step: display.tickInterval,
    };
    return {
      ...(callbacks.interactionCreationDuration === undefined
        ? {}
        : { creationDuration: callbacks.interactionCreationDuration }),
      index: createInteractionHitTestIndex(
        snapshot.scene,
        {
          height: geometry.height,
          verticalStart: geometry.verticalStart,
          width: geometry.width,
          x: geometry.x,
          y: geometry.y,
        },
        {
          progressTaskIds: store
            .getSnapshot()
            .document.tasks.filter((task) => task.kind === 'task')
            .map((task) => task.id),
        },
      ),
      snap: Object.freeze({ anchor: snap.anchor, step: snap.step }),
    };
  }

  function publicPreview(
    preview: InteractionPreviewPrimitive,
    geometry: GanttPointerGeometry,
  ): GanttInteractionPreview {
    return Object.freeze({
      description: preview.description,
      destination: preview.destination,
      end: preview.end,
      height: preview.height,
      kind: preview.kind,
      ...(preview.progress === undefined ? {} : { progress: preview.progress }),
      ...(preview.source === undefined ? {} : { source: preview.source }),
      start: preview.start,
      width: preview.width,
      x: preview.x - geometry.x,
      y: preview.y - geometry.y + geometry.verticalStart,
    });
  }

  function pendingKeyboardInteraction(
    action: GanttInteractionAction,
    target: GanttInteractionTarget | undefined,
    preview: GanttInteractionPreview | undefined,
    proposalId?: string,
  ): GanttInteractionState {
    return Object.freeze({
      action,
      ...(preview === undefined ? {} : { preview }),
      ...(proposalId === undefined ? {} : { proposalId }),
      status: 'pending',
      ...(target === undefined ? {} : { target }),
    });
  }

  function rejectKeyboardInteraction(
    diagnostic: Diagnostic,
    target: GanttInteractionTarget | undefined,
  ): void {
    keyboardGesture = undefined;
    setInteraction(
      Object.freeze({
        announcement: diagnostic.message,
        status: 'rejected',
        ...(target === undefined ? {} : { target }),
      }),
    );
  }

  async function dispatchKeyboardCommand(
    command: Parameters<GanttCommandBus['dispatch']>[0],
    action: GanttInteractionAction,
    target: GanttInteractionTarget | undefined,
    preview?: GanttInteractionPreview,
  ): Promise<void> {
    keyboardGesture = undefined;
    setInteraction(pendingKeyboardInteraction(action, target, preview));
    const result = await bus.dispatch(command, {
      source: Object.freeze({ kind: 'keyboard' }),
      ...(target === undefined ? {} : { target }),
    });
    if (disposed) {
      return;
    }
    const pendingDocument = store.getSnapshot().ownership.pendingDocument;
    if (result.status === 'proposed' && pendingDocument?.proposalId === result.proposalId) {
      setInteraction(pendingKeyboardInteraction(action, target, preview, result.proposalId));
    }
  }

  async function dispatchAction(
    command: GanttCommand,
    options: {
      readonly action: GanttInteractionAction;
      readonly source: Extract<GanttCommandSource, { readonly kind: 'context-menu' | 'editor' }>;
      readonly target: GanttInteractionTarget;
    },
  ): Promise<GanttDispatchResult> {
    keyboardGesture = undefined;
    setInteraction(pendingKeyboardInteraction(options.action, options.target, undefined));
    const result = await bus.dispatch(command, {
      source: options.source,
      target: options.target,
    });
    if (disposed) {
      return result;
    }
    const pendingDocument = store.getSnapshot().ownership.pendingDocument;
    if (result.status === 'proposed' && pendingDocument?.proposalId === result.proposalId) {
      setInteraction(
        pendingKeyboardInteraction(options.action, options.target, undefined, result.proposalId),
      );
    }
    return result;
  }

  async function dispatchKeyboardHistory(
    action: 'redo' | 'undo',
    target: GanttTaskTarget | undefined,
  ): Promise<void> {
    keyboardGesture = undefined;
    setInteraction(pendingKeyboardInteraction(action, target, undefined));
    const result = await bus[action](target === undefined ? undefined : { target });
    if (disposed) {
      return;
    }
    const pendingDocument = store.getSnapshot().ownership.pendingDocument;
    if (result.status === 'proposed' && pendingDocument?.proposalId === result.proposalId) {
      setInteraction(pendingKeyboardInteraction(action, target, undefined, result.proposalId));
    }
  }

  function dispatchKeyboardIntent(
    intent: Parameters<typeof mapInteractionIntent>[0],
    geometry: GanttPointerGeometry,
  ): boolean {
    const target = intent.kind === 'create' ? intent.destination : intent.source;
    const preview = publicPreview(
      createInteractionPreview(intent, interactionOptions(geometry)),
      geometry,
    );
    const mapping = mapInteractionIntent(intent, {
      document: store.getSnapshot().document,
      ...(callbacks.interactionMappers === undefined
        ? {}
        : { mappers: callbacks.interactionMappers }),
    });
    if (mapping.status === 'rejected') {
      rejectKeyboardInteraction(mapping.diagnostic, target);
      return true;
    }
    const action: GanttInteractionAction = intent.kind === 'resize' ? 'resize' : intent.kind;
    void dispatchKeyboardCommand(mapping.command, action, target, preview);
    return true;
  }

  function focusedKeyboardTarget(): GanttTaskTarget | undefined {
    const focused = store.getSnapshot().session.focused;
    return focused?.kind === 'task' && catalogOccurrence(focused) !== undefined
      ? focused
      : undefined;
  }

  function taskTitle(target: GanttTaskTarget): string {
    return (
      snapshot.scene.taskBars.find((task) => task.viewKey === target.viewKey)?.title ??
      target.taskId
    );
  }

  function dependencyPreview(
    source: GanttTaskTarget,
    candidate?: GanttTaskTarget,
  ): import('./types').GanttDependencyInteractionPreview {
    return Object.freeze({
      kind: 'dependency',
      source,
      ...(candidate === undefined ? {} : { target: candidate }),
      type: 'finish-to-start',
    });
  }

  function publishDependencyLink(): void {
    if (dependencyLink === undefined) return;
    const sourceTitle = taskTitle(dependencyLink.source);
    const candidateTitle =
      dependencyLink.candidate === undefined ? undefined : taskTitle(dependencyLink.candidate);
    setInteraction(
      Object.freeze({
        action: 'dependency',
        announcement:
          candidateTitle === undefined
            ? display.localization.message(
                'dependency.create',
                { source: sourceTitle },
                'Linking from {source}. Choose a target.',
              )
            : display.localization.message(
                'interaction.link',
                { source: sourceTitle, target: candidateTitle },
                'Link {source} to {target}. Press Enter or release to commit.',
              ),
        mode: 'link',
        ...(dependencyLink.pointerType === undefined
          ? {}
          : { pointerType: dependencyLink.pointerType }),
        preview: dependencyPreview(dependencyLink.source, dependencyLink.candidate),
        status: 'linking',
        target: dependencyLink.source,
      }),
    );
  }

  function uniqueDependencyId(fromTaskId: string, toTaskId: string): string {
    const ids = new Set(
      store.getSnapshot().document.dependencies.map((dependency) => dependency.id),
    );
    const base = `dependency:${fromTaskId}:${toTaskId}`;
    if (!ids.has(base)) return base;
    let suffix = 2;
    while (ids.has(`${base}:${suffix}`)) suffix += 1;
    return `${base}:${suffix}`;
  }

  async function commitDependencyLink(): Promise<boolean> {
    const link = dependencyLink;
    if (link?.candidate === undefined) {
      if (link !== undefined) {
        setInteraction(
          Object.freeze({
            announcement: display.localization.message(
              'dependency.invalid',
              undefined,
              'Choose a different task as the dependency target.',
            ),
            status: 'rejected',
            target: link.source,
          }),
        );
      }
      return false;
    }
    dependencyLink = undefined;
    const target = dependencyTarget(uniqueDependencyId(link.source.taskId, link.candidate.taskId));
    const preview = dependencyPreview(link.source, link.candidate);
    setInteraction(pendingKeyboardInteraction('dependency', target, preview));
    const result = await bus.dispatch(
      {
        value: {
          fromTaskId: link.source.taskId,
          id: target.dependencyId,
          toTaskId: link.candidate.taskId,
          type: 'finish-to-start',
        },
        type: 'dependency.add',
      },
      {
        source:
          link.pointerType === undefined
            ? Object.freeze({ kind: 'keyboard' as const })
            : Object.freeze({ kind: 'pointer' as const, pointerType: link.pointerType }),
        target,
      },
    );
    if (disposed) return true;
    const pendingDocument = store.getSnapshot().ownership.pendingDocument;
    if (result.status === 'proposed' && pendingDocument?.proposalId === result.proposalId) {
      setInteraction(pendingKeyboardInteraction('dependency', target, preview, result.proposalId));
    }
    return true;
  }

  function revealKeyboardTarget(target: GanttTaskTarget): boolean {
    const task = catalogOccurrence(target);
    if (task === undefined) {
      return false;
    }
    const session = store.getSnapshot().session;
    const extent =
      snapshot.selector.viewport.status === 'measured'
        ? snapshot.selector.viewport.clientHeight
        : snapshot.scene.bounds.defaultLaneHeight;
    const currentStart = session.viewport.verticalStart;
    const currentEnd = currentStart + extent;
    const unclampedVerticalStart =
      task.y < currentStart
        ? task.y
        : task.y + task.height > currentEnd
          ? task.y + task.height - extent
          : currentStart;
    const verticalStart = Math.max(
      0,
      Math.min(unclampedVerticalStart, Math.max(0, snapshot.scene.bounds.timelineHeight - extent)),
    );
    const horizontalRange =
      task.end <= display.range.start || task.start >= display.range.end
        ? alignedTaskRange(task)
        : undefined;
    if (
      (sessionControlled && callbacks.onSessionChange === undefined) ||
      (horizontalRange !== undefined && !canChangeRange())
    ) {
      return false;
    }
    if (horizontalRange !== undefined && !requestRange(horizontalRange, 'scroll', 'runtime')) {
      return false;
    }
    return updateSession(
      Object.freeze({
        focused: target,
        ...projectSessionPart(session),
        selection: session.selection,
        viewport: Object.freeze({ verticalStart }),
      }),
      'runtime',
    );
  }

  function pageKeyboardViewport(
    axis: 'horizontal' | 'vertical',
    direction: -1 | 1,
    geometry: GanttPointerGeometry,
  ): boolean {
    if (axis === 'horizontal') {
      const range = pageTimeRange(display.range, direction);
      if (range === undefined || !canChangeRange()) {
        return false;
      }
      pendingRangeAnnouncement = true;
      if (!requestRange(range, 'scroll', 'runtime')) {
        pendingRangeAnnouncement = false;
        return false;
      }
      return true;
    }
    const session = store.getSnapshot().session;
    const verticalStart = pageVerticalViewport(
      session.viewport.verticalStart,
      direction,
      snapshot.scene.bounds.timelineHeight,
      geometry.height,
      snapshot.scene.bounds.defaultLaneHeight,
    );
    if (verticalStart === undefined || verticalStart === session.viewport.verticalStart) {
      return false;
    }
    const updated = updateSession(
      Object.freeze({
        ...(session.focused === undefined ? {} : { focused: session.focused }),
        ...projectSessionPart(session),
        selection: session.selection,
        viewport: Object.freeze({ verticalStart }),
      }),
      'runtime',
    );
    if (updated) {
      setInteraction(
        Object.freeze({
          announcement: `Timeline moved ${direction < 0 ? 'up' : 'down'} one page.`,
          status: 'idle',
        }),
      );
    }
    return updated;
  }

  function toggleKeyboardSelection(target: GanttTaskTarget): void {
    const session = store.getSnapshot().session;
    const identity = targetIdentity(target);
    const selected = session.selection.some((candidate) => targetIdentity(candidate) === identity);
    const selection = selected
      ? session.selection.filter((candidate) => targetIdentity(candidate) !== identity)
      : [...session.selection, target];
    if (
      updateSession(
        Object.freeze({
          focused: target,
          ...projectSessionPart(session),
          selection: Object.freeze(selection),
          viewport: session.viewport,
        }),
        'runtime',
      )
    ) {
      setInteraction(
        Object.freeze({
          announcement: display.localization.message('interaction.selection', {
            state: selected ? 'deselected' : 'selected',
            title: taskTitle(target),
          }),
          status: 'idle',
        }),
      );
    }
  }

  function beginKeyboardMode(
    target: GanttTaskTarget,
    mode: InteractionKeyboardMode,
    geometry: GanttPointerGeometry,
  ): boolean {
    const record = store.getSnapshot().document.tasks.find((task) => task.id === target.taskId);
    if (record?.kind !== 'task') {
      const message =
        mode === 'progress'
          ? `Progress editing is not available for ${record?.kind} tasks.`
          : `${record?.kind === 'summary' ? 'Summary' : 'Milestone'} tasks do not support direct ${
              mode === 'move' ? 'moving' : 'resizing'
            }.`;
      setInteraction(Object.freeze({ announcement: message, status: 'rejected', target }));
      return true;
    }
    const next = beginKeyboardInteraction(target, mode, interactionOptions(geometry));
    if (next === undefined) {
      if (mode === 'progress') {
        rejectKeyboardInteraction(
          progressEditingDiagnostic(store.getSnapshot().document, target),
          target,
        );
        return true;
      }
      return false;
    }
    keyboardGesture = next;
    const action = mode === 'move' ? 'move' : mode === 'progress' ? 'progress' : 'resize';
    setInteraction(
      Object.freeze({
        action,
        announcement: `${interactionActionLabel(action)} mode. Use arrow keys, Enter to commit, or Escape to cancel.`,
        mode,
        preview: publicPreview(next.preview, geometry),
        status: 'keyboard',
        target,
      }),
    );
    return true;
  }

  function hitTarget(
    state: Extract<InteractionGestureState, { readonly status: 'pressed' }>,
  ): GanttInteractionTarget {
    return state.hit.kind === 'timeline-position' ? state.hit.lane.target : state.hit.task.target;
  }

  function selectPointerTarget(target: GanttTaskTarget): void {
    const session = store.getSnapshot().session;
    updateSession(
      Object.freeze({
        focused: target,
        ...projectSessionPart(session),
        selection: Object.freeze([target]),
        viewport: session.viewport,
      }),
      'runtime',
    );
  }

  function navigateViewport(input: GanttViewportNavigationInput): GanttViewportNavigationResult {
    const source = input.source ?? 'runtime';
    rangeChangeContext = Object.freeze({ reason: input.reason ?? 'scroll' });
    const horizontalDelta =
      input.horizontalDelta === undefined
        ? undefined
        : input.horizontalDelta * (display.direction === 'rtl' ? -1 : 1);
    const horizontal =
      horizontalDelta === undefined
        ? false
        : rangeProposals.shiftByPixels(horizontalDelta, input.viewportWidth, source);
    let vertical = false;
    if (input.verticalDelta !== undefined) {
      const session = store.getSnapshot().session;
      const verticalStart = shiftVerticalViewport(
        session.viewport.verticalStart,
        input.verticalDelta,
        snapshot.scene.bounds.timelineHeight,
        input.viewportHeight,
      );
      if (verticalStart !== undefined && verticalStart !== session.viewport.verticalStart) {
        vertical = updateSession(
          Object.freeze({
            ...(session.focused === undefined ? {} : { focused: session.focused }),
            ...projectSessionPart(session),
            selection: session.selection,
            viewport: Object.freeze({ verticalStart }),
          }),
          source,
        );
      }
    }
    return Object.freeze({ horizontal, vertical });
  }

  function panPointerDown(input: GanttPanPointerInput): boolean {
    if (
      disposed ||
      gesture.status !== 'idle' ||
      panGesture.status !== 'idle' ||
      !canChangeRange() ||
      !Number.isFinite(input.geometry.width) ||
      input.geometry.width <= 0 ||
      !Number.isFinite(input.geometry.height) ||
      input.geometry.height <= 0
    ) {
      return false;
    }
    panGesture = beginViewportPanGesture(input.pointerId, input.point, input.axis);
    return panGesture.status !== 'idle';
  }

  function panPointerMove(input: GanttPanPointerMoveInput): GanttPanPointerMoveResult {
    const moved = moveViewportPanGesture(panGesture, input.pointerId, input.point);
    panGesture = moved.state;
    if (!moved.handled || panGesture.status !== 'active') {
      return Object.freeze({ active: false, handled: moved.handled });
    }
    navigateViewport({
      ...(moved.deltaX === 0 ? {} : { horizontalDelta: moved.deltaX }),
      ...(moved.deltaY === 0 ? {} : { verticalDelta: moved.deltaY }),
      reason: 'pan',
      viewportHeight: input.geometry.height,
      viewportWidth: input.geometry.width,
    });
    return Object.freeze({ active: true, handled: true });
  }

  function panPointerEnd(pointerId: number): GanttPanPointerEndResult {
    const ended = endViewportPanGesture(panGesture, pointerId);
    panGesture = ended.state;
    return Object.freeze({ active: ended.active, handled: ended.handled });
  }

  function autoPan(input: GanttPointerMoveInput, options: InteractionGestureOptions): void {
    if (gesture.status !== 'active' || gesture.intent.kind === 'progress') {
      return;
    }
    const edge = Math.min(40, input.geometry.height / 3, input.geometry.width / 3);
    const relativeY = input.point.y - input.geometry.y;
    const verticalDirection =
      relativeY < edge ? -1 : relativeY > input.geometry.height - edge ? 1 : 0;
    if (verticalDirection !== 0) {
      const session = store.getSnapshot().session;
      const strength =
        verticalDirection < 0
          ? (edge - Math.max(0, relativeY)) / edge
          : (edge - Math.max(0, input.geometry.height - relativeY)) / edge;
      const delta =
        verticalDirection *
        Math.max(4, Math.round(snapshot.scene.bounds.defaultLaneHeight * 0.35 * strength));
      const maxStart = Math.max(0, snapshot.scene.bounds.timelineHeight - input.geometry.height);
      const verticalStart = Math.max(0, Math.min(maxStart, session.viewport.verticalStart + delta));
      if (verticalStart !== session.viewport.verticalStart) {
        updateSession(
          Object.freeze({
            ...(session.focused === undefined ? {} : { focused: session.focused }),
            ...projectSessionPart(session),
            selection: session.selection,
            viewport: Object.freeze({ verticalStart }),
          }),
          'runtime',
        );
      }
    }

    const relativeX = input.point.x - input.geometry.x;
    const horizontalDirection =
      relativeX < edge ? -1 : relativeX > input.geometry.width - edge ? 1 : 0;
    if (horizontalDirection !== 0) {
      const shift =
        horizontalDirection * options.snap.step * (display.direction === 'rtl' ? -1 : 1);
      rangeChangeContext = Object.freeze({ reason: 'scroll' });
      rangeProposals.shiftByTime(shift, 'runtime');
    }
  }

  function fitProject(
    fitOptions: Parameters<GanttHandle['fitToProject']>[0],
    source: 'imperative' | 'runtime',
  ): boolean {
    const presentations = resolveTaskPresentations(
      store.getSnapshot().document,
      display.timeZone,
    ).presentations;
    const intervals = presentations.flatMap((presentation) =>
      presentation.interval === undefined ? [] : [presentation.interval],
    );
    if (intervals.length === 0) {
      setInteraction(
        Object.freeze({
          announcement: display.localization.message('chart.empty'),
          status: 'idle',
        }),
      );
      return false;
    }
    const bounds = Object.freeze({
      end: Math.max(...intervals.map((interval) => interval.end)),
      start: Math.min(...intervals.map((interval) => interval.start)),
    });
    const width =
      snapshot.selector.viewport.status === 'measured'
        ? snapshot.selector.viewport.clientWidth
        : 960;
    const range = fitTimeRange(bounds, width, fitOptions);
    return range === undefined ? false : requestRange(range, 'fit', source);
  }

  function zoomLevel(
    level: GanttTimeScaleLevel,
    zoomOptions: Parameters<GanttHandle['zoomTo']>[1],
    source: 'imperative' | 'runtime',
  ): boolean {
    const acceptedLevel =
      display.timeScale.kind === 'adaptive' ? clampTimeScaleLevel(level, display.timeScale) : level;
    const range = zoomRangeToLevel(display.range, acceptedLevel, zoomOptions);
    const anchorRatio = zoomOptions?.anchorRatio ?? 0.5;
    const anchorTime =
      zoomOptions?.anchorTime ??
      display.range.start + (display.range.end - display.range.start) * anchorRatio;
    return range === undefined ? false : requestRange(range, 'zoom', source, anchorTime);
  }

  const handleValue: GanttHandle = {
    canRedo: () => store.getSnapshot().history.canRedo,
    canUndo: () => store.getSnapshot().history.canUndo,
    dispatch: (command, options) => bus.dispatch(command, options),
    focusTask(target) {
      const occurrence = catalogOccurrence(target);
      if (occurrence === undefined) {
        return false;
      }
      const current = taskTarget(occurrence);
      return updateSession(
        Object.freeze({
          focused: current,
          ...projectSessionPart(store.getSnapshot().session),
          selection: store.getSnapshot().session.selection,
          viewport: store.getSnapshot().session.viewport,
        }),
      );
    },
    fitToProject: (options) => fitProject(options, 'imperative'),
    getDocument: () => store.getSnapshot().document,
    getSelection: () => store.getSnapshot().session.selection,
    getSession: () => store.getSnapshot().session,
    redo: () => bus.redo(),
    scrollToTask(target, options) {
      const task = catalogOccurrence(target);
      if (task === undefined) {
        return false;
      }
      const session = store.getSnapshot().session;
      const verticalStart = alignedVerticalStart(task, options);
      const verticalChanged = verticalStart !== session.viewport.verticalStart;
      const horizontalChanged = task.start < display.range.start || task.end > display.range.end;
      if (
        (horizontalChanged && !canChangeRange()) ||
        (verticalChanged && sessionControlled && callbacks.onSessionChange === undefined)
      ) {
        return false;
      }
      if (horizontalChanged) {
        const range = alignedTaskRange(task, options);
        if (!requestRange(range, 'scroll', 'imperative')) {
          return false;
        }
      }
      if (!verticalChanged) {
        return true;
      }
      return updateSession(
        Object.freeze({
          ...(session.focused === undefined ? {} : { focused: session.focused }),
          ...projectSessionPart(session),
          selection: session.selection,
          viewport: Object.freeze({ verticalStart }),
        }),
      );
    },
    scrollToTime(time: EpochMilliseconds, options?: GanttScrollOptions) {
      if (!Number.isFinite(time)) {
        return false;
      }
      const duration = display.range.end - display.range.start;
      const align = options?.align ?? 'center';
      const start =
        align === 'start' ? time : align === 'end' ? time - duration : time - duration / 2;
      const range = Object.freeze({ start, end: start + duration });
      return requestRange(range, 'scroll', 'imperative');
    },
    undo: () => bus.undo(),
    zoomTo: (level, options) => zoomLevel(level, options, 'imperative'),
  };
  const handle: GanttHandle = Object.freeze(handleValue);

  const runtime: GanttReactRuntime = {
    activate() {
      if (disposed) {
        throw new Error('The Gantt React runtime has been disposed.');
      }
      activationVersion += 1;
      active = true;
      const pendingSession = store.getSnapshot().ownership.pendingSession;
      if (pendingSession !== undefined) {
        emitControlledSessionProposal(initialProps.session!, pendingSession, 'controlled-prop');
      }
    },

    beginDependencyLink(viewKey, pointerType) {
      if (disposed || dependencyLink !== undefined || composedInteraction().status === 'pending') {
        return false;
      }
      const source = snapshot.selector.occurrences.find(
        (occurrence) => occurrence.target.viewKey === viewKey,
      )?.target;
      if (source === undefined) return false;
      dependencyLink = Object.freeze({
        ...(pointerType === undefined ? {} : { pointerType }),
        source,
      });
      const session = store.getSnapshot().session;
      updateSession(
        Object.freeze({
          focused: source,
          ...projectSessionPart(session),
          selection: Object.freeze([source]),
          viewport: session.viewport,
        }),
        'runtime',
      );
      publishDependencyLink();
      return true;
    },

    cancelDependencyLink() {
      if (dependencyLink === undefined) return false;
      const source = dependencyLink.source;
      dependencyLink = undefined;
      setInteraction(
        Object.freeze({
          announcement: display.localization.message(
            'interaction.cancelled',
            { source: taskTitle(source) },
            'Linking from {source} cancelled.',
          ),
          status: 'idle',
        }),
      );
      return true;
    },

    clearMeasurement() {
      if (disposed) {
        return;
      }
      store.clearViewportMeasurement();
    },

    clearTaskFocusAndSelection() {
      if (disposed) {
        return false;
      }
      const session = store.getSnapshot().session;
      if (session.focused === undefined && session.selection.length === 0) {
        return false;
      }
      return updateSession(
        Object.freeze({
          ...projectSessionPart(session),
          selection: Object.freeze([]),
          viewport: session.viewport,
        }),
        'runtime',
      );
    },

    deactivate() {
      active = false;
      const version = activationVersion;
      queueMicrotask(() => {
        // React Strict Mode replays effects without recreating component state. Delay
        // final disposal so the paired activation can retain the same instance runtime.
        if (!disposed && !active && activationVersion === version) {
          runtime.dispose();
        }
      });
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      dependencyLink = undefined;
      panGesture = IDLE_VIEWPORT_PAN_GESTURE;
      unsubscribeStore();
      subscribers.clear();
      rangeProposals.dispose();
      bus.dispose();
    },

    dispatchAction,

    fitToProject: (options) => fitProject(options, 'runtime'),

    getHandle() {
      return handle;
    },

    getSnapshot() {
      return snapshot;
    },

    keyboardAction(input) {
      if (
        disposed ||
        gesture.status === 'pressed' ||
        gesture.status === 'active' ||
        composedInteraction().status === 'pending'
      ) {
        return false;
      }
      if (input.action.type === 'history' && keyboardGesture === undefined) {
        void dispatchKeyboardHistory(input.action.action, focusedKeyboardTarget());
        return true;
      }
      if (keyboardGesture === undefined && dependencyLink === undefined) {
        if (input.action.type === 'fit') return fitProject(undefined, 'runtime');
        if (input.action.type === 'zoom') {
          const level = adjacentTimeScaleLevel(
            snapshot.selector.scaleLevel,
            input.action.direction,
            display.timeScale.kind === 'adaptive' ? display.timeScale : { kind: 'adaptive' },
          );
          return zoomLevel(level, undefined, 'runtime');
        }
      }
      if (dependencyLink !== undefined) {
        if (input.action.type === 'cancel') return runtime.cancelDependencyLink();
        if (input.action.type === 'commit') {
          void commitDependencyLink();
          return true;
        }
        if (input.action.type === 'navigate') {
          const direction =
            display.direction === 'rtl' && input.action.direction === 'left'
              ? 'right'
              : display.direction === 'rtl' && input.action.direction === 'right'
                ? 'left'
                : input.action.direction;
          const current = dependencyLink.candidate ?? dependencyLink.source;
          const next = navigateRuntimeOccurrence(
            occurrences(snapshot.scene, snapshot.occurrenceCatalog).runtime,
            current,
            direction,
          );
          if (next?.kind !== 'task' || next.taskId === dependencyLink.source.taskId) return false;
          dependencyLink = Object.freeze({ ...dependencyLink, candidate: next });
          revealKeyboardTarget(next);
          publishDependencyLink();
          return true;
        }
        return false;
      }
      if (input.geometry === undefined) {
        return false;
      }
      if (input.action.type === 'page' && keyboardGesture === undefined) {
        return pageKeyboardViewport(input.action.axis, input.action.direction, input.geometry);
      }
      const options = interactionOptions(input.geometry);
      if (keyboardGesture !== undefined) {
        if (input.action.type === 'cancel') {
          keyboardGesture = undefined;
          setInteraction(
            Object.freeze({
              announcement: display.localization.message('interaction.cancelled'),
              status: 'idle',
            }),
          );
          return true;
        }
        if (input.action.type === 'commit') {
          return dispatchKeyboardIntent(keyboardGesture.intent, input.geometry);
        }
        if (input.action.type !== 'adjust') {
          return false;
        }
        const direction =
          display.direction === 'rtl' && input.action.direction === 'left'
            ? 'right'
            : display.direction === 'rtl' && input.action.direction === 'right'
              ? 'left'
              : input.action.direction;
        const next = adjustKeyboardInteraction(keyboardGesture, direction, options, {
          ...(input.action.accelerated === undefined
            ? {}
            : { accelerated: input.action.accelerated }),
          ...(input.action.boundary === undefined ? {} : { boundary: input.action.boundary }),
        });
        keyboardGesture = next;
        const target = next.intent.source;
        const action =
          next.intent.kind === 'resize'
            ? 'resize'
            : next.intent.kind === 'progress'
              ? 'progress'
              : 'move';
        setInteraction(
          Object.freeze({
            action,
            announcement: next.preview.description,
            mode: next.mode,
            preview: publicPreview(next.preview, input.geometry),
            status: 'keyboard',
            target,
          }),
        );
        return true;
      }

      const focused = store.getSnapshot().session.focused;
      if (focused?.kind === 'dependency') {
        if (input.action.type === 'delete') {
          void dispatchKeyboardCommand(
            { id: focused.dependencyId, type: 'dependency.delete' },
            'delete',
            focused,
          );
          return true;
        }
        if (input.action.type === 'toggle-selection') {
          const session = store.getSnapshot().session;
          updateSession(
            Object.freeze({
              focused,
              ...projectSessionPart(session),
              selection: Object.freeze([focused]),
              viewport: session.viewport,
            }),
            'runtime',
          );
          return true;
        }
        if (input.action.type === 'activate') {
          setInteraction(
            Object.freeze({
              announcement: display.localization.message(
                'dependency.edit',
                undefined,
                'Dependency activated.',
              ),
              status: 'idle',
            }),
          );
          return true;
        }
        return false;
      }
      const target = focusedKeyboardTarget();
      if (target === undefined) {
        return false;
      }
      if (input.action.type === 'navigate') {
        const direction =
          display.direction === 'rtl' && input.action.direction === 'left'
            ? 'right'
            : display.direction === 'rtl' && input.action.direction === 'right'
              ? 'left'
              : input.action.direction;
        const currentLane = snapshot.scene.lanes.find(
          (lane) => lane.viewKey === target.laneViewKey,
        );
        if (currentLane?.project !== undefined && (direction === 'left' || direction === 'right')) {
          const record = store
            .getSnapshot()
            .document.tasks.find((task) => task.id === target.taskId);
          if (direction === 'left') {
            if (currentLane.project.hasChildren && currentLane.project.expanded) {
              return runtime.toggleProjectTask(target.taskId, false);
            }
            if (record?.parentId !== undefined) {
              const parent = snapshot.occurrenceCatalog.find(
                (occurrence) => occurrence.taskId === record.parentId,
              );
              return parent === undefined ? false : revealKeyboardTarget(taskTarget(parent));
            }
            return false;
          }
          if (currentLane.project.hasChildren && currentLane.project.expanded === false) {
            return runtime.toggleProjectTask(target.taskId, true);
          }
          const child = snapshot.occurrenceCatalog.find(
            (occurrence) =>
              store.getSnapshot().document.tasks.find((task) => task.id === occurrence.taskId)
                ?.parentId === target.taskId,
          );
          return child === undefined ? false : revealKeyboardTarget(taskTarget(child));
        }
        const next = navigateRuntimeOccurrence(
          occurrences(snapshot.scene, snapshot.occurrenceCatalog).runtime,
          target,
          direction,
        );
        if (next === undefined) {
          return false;
        }
        return revealKeyboardTarget(next);
      }
      if (input.action.type === 'toggle-selection') {
        toggleKeyboardSelection(target);
        return true;
      }
      if (input.action.type === 'activate') {
        const event = Object.freeze({ source: 'runtime' as const });
        setInteraction(
          Object.freeze({
            announcement: `${taskTitle(target)} activated.`,
            status: 'idle',
          }),
        );
        emitCallback('onTaskActivate', () => callbacks.onTaskActivate?.(target, event));
        return true;
      }
      if (input.action.type === 'begin') {
        return beginKeyboardMode(target, input.action.mode, input.geometry);
      }
      if (input.action.type === 'link') {
        return runtime.beginDependencyLink(target.viewKey);
      }
      if (input.action.type === 'create') {
        const intent = keyboardCreationIntent(target, options);
        return intent === undefined ? false : dispatchKeyboardIntent(intent, input.geometry);
      }
      if (input.action.type === 'delete') {
        void dispatchKeyboardCommand(
          { cascade: true, id: target.taskId, type: 'task.delete' },
          'delete',
          target,
        );
        return true;
      }
      return false;
    },

    inspectLane(viewKey) {
      if (disposed) {
        return false;
      }
      const lane = snapshot.scene.lanes.find((candidate) => candidate.viewKey === viewKey);
      if (lane === undefined) {
        return false;
      }
      const target = laneTarget(lane);
      const session = store.getSnapshot().session;
      return updateSession(
        Object.freeze({
          focused: target,
          ...projectSessionPart(session),
          selection: Object.freeze([target]),
          viewport: session.viewport,
        }),
        'runtime',
      );
    },

    inspectDependency(dependencyId) {
      if (disposed) return false;
      const target = snapshot.selector.dependencies.find(
        (dependency) => dependency.target.dependencyId === dependencyId,
      )?.target;
      if (target === undefined) return false;
      const dependency = store
        .getSnapshot()
        .document.dependencies.find((candidate) => candidate.id === dependencyId);
      const sourceOccurrence =
        dependency === undefined
          ? undefined
          : snapshot.occurrenceCatalog.find(
              (occurrence) => occurrence.taskId === dependency.fromTaskId,
            );
      dependencyFocusRestore =
        sourceOccurrence === undefined ? undefined : taskTarget(sourceOccurrence);
      const session = store.getSnapshot().session;
      return updateSession(
        Object.freeze({
          focused: target,
          ...projectSessionPart(session),
          selection: Object.freeze([target]),
          viewport: session.viewport,
        }),
        'runtime',
      );
    },

    inspectTask(viewKey) {
      if (disposed) {
        return false;
      }
      const target = snapshot.selector.occurrences.find(
        (occurrence) => occurrence.target.viewKey === viewKey,
      )?.target;
      if (target === undefined) {
        return false;
      }
      const session = store.getSnapshot().session;
      return updateSession(
        Object.freeze({
          focused: target,
          ...projectSessionPart(session),
          selection: Object.freeze([target]),
          viewport: session.viewport,
        }),
        'runtime',
      );
    },

    keyboardFocus(viewKey) {
      if (disposed) {
        return false;
      }
      const target = snapshot.selector.occurrences.find(
        (occurrence) => occurrence.target.viewKey === viewKey,
      )?.target;
      if (target === undefined) {
        return false;
      }
      const session = store.getSnapshot().session;
      if (targetIdentity(session.focused) === targetIdentity(target)) {
        return true;
      }
      return updateSession(
        Object.freeze({
          focused: target,
          ...projectSessionPart(session),
          selection: session.selection,
          viewport: session.viewport,
        }),
        'runtime',
      );
    },

    measure(measurement) {
      store.scheduleViewportMeasurement(measurement);
    },

    navigateViewport,

    panPointerCancel(pointerId) {
      return panPointerEnd(pointerId).handled;
    },

    panPointerDown,

    panPointerMove,

    panPointerUp: panPointerEnd,

    commitDependencyLink,

    pointerCancel(pointerId) {
      if (
        (gesture.status !== 'pressed' && gesture.status !== 'active') ||
        gesture.pointerId !== pointerId
      ) {
        return false;
      }
      gesture = reduceInteractionGesture(
        gesture,
        { type: 'cancel' },
        interactionOptions(gestureGeometry!),
      );
      gesture = IDLE_INTERACTION_GESTURE;
      gestureGeometry = undefined;
      setInteraction(
        Object.freeze({
          announcement: 'Interaction cancelled.',
          status: 'idle',
        }),
      );
      return true;
    },

    pointerDown(input) {
      if (
        disposed ||
        keyboardGesture !== undefined ||
        panGesture.status !== 'idle' ||
        gesture.status === 'pressed' ||
        gesture.status === 'active' ||
        composedInteraction().status === 'pending'
      ) {
        return false;
      }
      const next = reduceInteractionGesture(
        IDLE_INTERACTION_GESTURE,
        {
          ...(input.candidateViewKey === undefined
            ? {}
            : { candidateViewKey: input.candidateViewKey }),
          ...(input.progressCandidateViewKey === undefined
            ? {}
            : { progressCandidateViewKey: input.progressCandidateViewKey }),
          point: input.point,
          pointerId: input.pointerId,
          pointerType: input.pointerType,
          type: 'press',
        },
        interactionOptions(input.geometry),
      );
      if (next.status !== 'pressed') {
        return false;
      }
      gesture = next;
      gestureGeometry = input.geometry;
      const target = hitTarget(next);
      if (target.kind === 'task') {
        selectPointerTarget(target);
      }
      setInteraction(
        Object.freeze({
          ...(next.hit.kind === 'task-edge' ? { edge: next.hit.edge } : {}),
          pointerType: next.pointerType,
          status: 'pressing',
          target,
        }),
      );
      return true;
    },

    pointerMove(input) {
      if (
        (gesture.status !== 'pressed' && gesture.status !== 'active') ||
        gesture.pointerId !== input.pointerId
      ) {
        return false;
      }
      const pressedTask =
        gesture.status === 'pressed' && gesture.hit.kind !== 'timeline-position'
          ? gesture.hit.task.primitive
          : undefined;
      if (pressedTask !== undefined && pressedTask.presentation.kind !== 'task') {
        return false;
      }
      const options = interactionOptions(input.geometry);
      const next = reduceInteractionGesture(
        gesture,
        {
          ...(input.candidateViewKey === undefined
            ? {}
            : { candidateViewKey: input.candidateViewKey }),
          ...(input.progressCandidateViewKey === undefined
            ? {}
            : { progressCandidateViewKey: input.progressCandidateViewKey }),
          point: input.point,
          pointerId: input.pointerId,
          type: 'move',
        },
        options,
      );
      gesture = next;
      gestureGeometry = input.geometry;
      if (next.status !== 'active') {
        return false;
      }
      const target =
        next.origin.kind === 'timeline-position'
          ? next.origin.lane.target
          : next.origin.task.target;
      setInteraction(
        Object.freeze({
          pointerType: next.pointerType,
          preview: publicPreview(next.preview, input.geometry),
          status:
            next.intent.kind === 'move'
              ? 'dragging'
              : next.intent.kind === 'resize'
                ? 'resizing'
                : next.intent.kind === 'progress'
                  ? 'progressing'
                  : 'creating',
          target,
        }),
      );
      autoPan(input, options);
      return true;
    },

    async pointerUp(pointerId) {
      if (
        (gesture.status !== 'pressed' && gesture.status !== 'active') ||
        gesture.pointerId !== pointerId ||
        gestureGeometry === undefined
      ) {
        return;
      }
      const previous = gesture;
      const geometry = gestureGeometry;
      const released = reduceInteractionGesture(
        gesture,
        { pointerId, type: 'release' },
        interactionOptions(geometry),
      );
      gesture = IDLE_INTERACTION_GESTURE;
      gestureGeometry = undefined;
      if (previous.status === 'pressed') {
        if (previous.hit.kind === 'task-body' || previous.hit.kind === 'task-edge') {
          const target = previous.hit.task.target;
          const event = Object.freeze({ source: 'runtime' as const });
          setInteraction(
            Object.freeze({
              announcement: `${previous.hit.task.primitive.title} activated.`,
              status: 'idle',
            }),
          );
          emitCallback('onTaskActivate', () => callbacks.onTaskActivate?.(target, event));
        } else {
          setInteraction(Object.freeze({ status: 'idle' }));
        }
        return;
      }
      if (released.status !== 'committed') {
        setInteraction(Object.freeze({ status: 'idle' }));
        return;
      }
      const target =
        released.intent.kind === 'create' ? released.intent.destination : released.intent.source;
      const preview = publicPreview(released.preview, geometry);
      setInteraction(
        Object.freeze({
          pointerType: previous.pointerType,
          preview,
          status: 'pending',
          target,
        }),
      );
      const mapping = mapInteractionIntent(released.intent, {
        document: store.getSnapshot().document,
        ...(callbacks.interactionMappers === undefined
          ? {}
          : { mappers: callbacks.interactionMappers }),
      });
      if (mapping.status === 'rejected') {
        setInteraction(
          Object.freeze({
            announcement: mapping.diagnostic.message,
            status: 'rejected',
            target,
          }),
        );
        return;
      }
      const cancellation = createGanttCommandCancellationController();
      const result = await bus.dispatch(mapping.command, {
        cancellation: cancellation.signal,
        source: Object.freeze({
          kind: 'pointer',
          pointerType: previous.pointerType,
        }),
        target,
      });
      if (disposed) {
        cancellation.abort();
        return;
      }
      const pendingDocument = store.getSnapshot().ownership.pendingDocument;
      if (result.status === 'proposed' && pendingDocument?.proposalId === result.proposalId) {
        setInteraction(
          Object.freeze({
            pointerType: previous.pointerType,
            preview,
            proposalId: result.proposalId,
            status: 'pending',
            target,
          }),
        );
      }
    },

    reconcile(props) {
      if (disposed) {
        return;
      }
      const nextDocumentControlled = controlledDocument(props) !== undefined;
      const nextSessionControlled = props.session !== undefined;
      const nextRangeControlled = props.range !== undefined;
      if (
        nextDocumentControlled !== documentControlled ||
        nextSessionControlled !== sessionControlled ||
        nextRangeControlled !== rangeControlled
      ) {
        throw new Error('Gantt ownership modes cannot change after mount.');
      }
      bus.updateInterceptors(props.interceptors ?? []);
      const nextDisplay = displayInputs(props, rangeControlled ? undefined : display.range);
      const changedDisplay = !displayEqual(display, nextDisplay);
      const validation = validateDocumentReferences(
        documentControlled ? props.document! : store.getSnapshot().document,
      );
      const nextInputDiagnostics = Object.freeze([
        ...validation.diagnostics,
        ...nextDisplay.localization.diagnostics,
        ...timeScaleDiagnostics(nextDisplay.timeScale),
      ]);
      const changedDiagnostics =
        JSON.stringify(nextInputDiagnostics) !== JSON.stringify(inputDiagnostics);
      const previousSelector = snapshot.selector;
      const previousVersion = snapshot.version;
      display = nextDisplay;
      rangeProposals.adopt(display.range);
      inputDiagnostics = nextInputDiagnostics;
      semanticSource = 'controlled-prop';
      try {
        if (documentControlled) {
          bus.updateControlledDocument(validation.document);
        }
        if (sessionControlled) {
          store.updateControlledSession(props.session!);
        }
        if ((changedDisplay || changedDiagnostics) && snapshot.version === previousVersion) {
          rebuild();
        }
        if (
          keyboardGesture !== undefined &&
          visibleTarget(keyboardGesture.intent.source) === undefined
        ) {
          keyboardGesture = undefined;
          setInteraction(
            Object.freeze({
              announcement: display.localization.message(
                'tree.hidden-focus',
                undefined,
                'Keyboard interaction cancelled because its task is no longer visible.',
              ),
              status: 'idle',
            }),
          );
        }
        if (
          dependencyLink !== undefined &&
          catalogOccurrence(dependencyLink.source) === undefined
        ) {
          dependencyLink = undefined;
          setInteraction(
            Object.freeze({
              announcement: display.localization.message(
                'interaction.cancelled',
                undefined,
                'Dependency linking cancelled because its source is no longer available.',
              ),
              status: 'idle',
            }),
          );
        } else if (
          dependencyLink?.candidate !== undefined &&
          catalogOccurrence(dependencyLink.candidate) === undefined
        ) {
          dependencyLink = Object.freeze({
            ...(dependencyLink.pointerType === undefined
              ? {}
              : { pointerType: dependencyLink.pointerType }),
            source: dependencyLink.source,
          });
          publishDependencyLink();
        }
      } finally {
        semanticSource = 'runtime';
      }
      if (
        active &&
        (previousSelector.range.start !== snapshot.selector.range.start ||
          previousSelector.range.end !== snapshot.selector.range.end)
      ) {
        const event = Object.freeze({ source: 'controlled-prop' as const });
        emitCallback('onViewportChange', () =>
          callbacks.onViewportChange?.(viewportEvent(snapshot.selector), event),
        );
      }
      if (
        pendingRangeAnnouncement &&
        (previousSelector.range.start !== snapshot.selector.range.start ||
          previousSelector.range.end !== snapshot.selector.range.end)
      ) {
        pendingRangeAnnouncement = false;
        setInteraction(
          Object.freeze({
            announcement: `Visible time range ${new Date(snapshot.selector.range.start).toISOString()} to ${new Date(snapshot.selector.range.end).toISOString()}.`,
            status: 'idle',
          }),
        );
      }
    },

    subscribe(subscriber) {
      if (disposed) {
        throw new Error('The Gantt React runtime has been disposed.');
      }
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    toggleProjectTask(taskId, expanded) {
      if (disposed || display.view?.kind !== 'project') {
        return false;
      }
      const document = store.getSnapshot().document;
      const session = store.getSnapshot().session;
      const collapsedTaskIds = projectCollapsedTaskIds(document, session, taskId, expanded);
      if (collapsedTaskIds === undefined) {
        return false;
      }
      const parentByTaskId = new Map(document.tasks.map((task) => [task.id, task.parentId]));
      const isHiddenDescendant = (target: GanttInteractionTarget): boolean => {
        if (target.kind !== 'task') {
          return false;
        }
        let parentId = parentByTaskId.get(target.taskId);
        while (parentId !== undefined) {
          if (parentId === taskId) {
            return true;
          }
          parentId = parentByTaskId.get(parentId);
        }
        return false;
      };
      const collapsing = collapsedTaskIds.includes(taskId);
      const parentOccurrence = snapshot.occurrenceCatalog.find(
        (occurrence) => occurrence.taskId === taskId,
      );
      const parentTarget =
        parentOccurrence === undefined ? undefined : taskTarget(parentOccurrence);
      const focused =
        collapsing && session.focused !== undefined && isHiddenDescendant(session.focused)
          ? parentTarget
          : session.focused;
      const selection = collapsing
        ? session.selection.filter((target) => !isHiddenDescendant(target))
        : session.selection;
      const next = Object.freeze({
        ...(focused === undefined ? {} : { focused }),
        project: Object.freeze({ collapsedTaskIds }),
        selection: Object.freeze(selection),
        viewport: session.viewport,
      });
      if (!updateSession(next, 'runtime')) {
        return false;
      }
      const title = document.tasks.find((task) => task.id === taskId)?.title ?? taskId;
      setInteraction(
        Object.freeze({
          announcement: display.localization.message('interaction.selection', {
            state: collapsing ? 'collapsed' : 'expanded',
            title,
          }),
          status: 'idle',
        }),
      );
      return true;
    },

    updateDependencyLink(viewKey) {
      if (dependencyLink === undefined) return false;
      const candidate = snapshot.selector.occurrences.find(
        (occurrence) => occurrence.target.viewKey === viewKey,
      )?.target;
      if (candidate === undefined || candidate.taskId === dependencyLink.source.taskId) {
        if (dependencyLink.candidate === undefined) return false;
        dependencyLink = Object.freeze({
          ...(dependencyLink.pointerType === undefined
            ? {}
            : { pointerType: dependencyLink.pointerType }),
          source: dependencyLink.source,
        });
      } else {
        dependencyLink = Object.freeze({ ...dependencyLink, candidate });
      }
      publishDependencyLink();
      return true;
    },

    updateCallbacks(props) {
      callbacks = props;
    },

    zoomTo: (level, options) => zoomLevel(level, options, 'runtime'),
  };
  return Object.freeze(runtime);
}

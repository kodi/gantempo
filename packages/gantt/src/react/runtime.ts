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
import { navigateInteractionOccurrence } from '../interaction/navigation';
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
import type { EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import { validateDocumentReferences } from '../model/validate';
import { createChartScenePipeline } from '../render/scene-pipeline';
import type { ChartScene, TaskBarPrimitive } from '../render/primitives';
import {
  createGanttCommandBus,
  createGanttCommandCancellationController,
} from '../runtime/command-bus';
import { sessionEqual } from '../runtime/session';
import { createGanttRuntimeStore } from '../runtime/store';
import type {
  GanttCommandBus,
  GanttCommandSource,
  GanttDispatchResult,
  GanttInteractionTarget,
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

export interface GanttReactRuntimeSnapshot {
  readonly scene: ChartScene;
  readonly selector: GanttSelectorSnapshot;
  readonly version: number;
}

export interface GanttReactRuntime {
  activate(): void;
  clearMeasurement(): void;
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
  getHandle(): GanttHandle;
  getSnapshot(): GanttReactRuntimeSnapshot;
  keyboardAction(input: GanttKeyboardActionInput): boolean;
  keyboardFocus(viewKey: string): boolean;
  measure(measurement: GanttViewportMeasurement): void;
  pointerCancel(pointerId: number): boolean;
  pointerDown(input: GanttPointerInput): boolean;
  pointerMove(input: GanttPointerMoveInput): boolean;
  pointerUp(pointerId: number): Promise<void>;
  reconcile(props: GanttProps): void;
  subscribe(subscriber: () => void): () => void;
  updateCallbacks(props: GanttProps): void;
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
}

export interface GanttPointerMoveInput {
  readonly candidateViewKey?: string;
  readonly geometry: GanttPointerGeometry;
  readonly point: InteractionPoint;
  readonly pointerId: number;
}

export type GanttKeyboardAction =
  | { readonly direction: InteractionKeyboardAdjustment; readonly type: 'adjust' }
  | { readonly mode: InteractionKeyboardMode; readonly type: 'begin' }
  | { readonly type: 'activate' | 'cancel' | 'commit' | 'create' | 'delete' }
  | { readonly direction: InteractionNavigationDirection; readonly type: 'navigate' }
  | { readonly action: 'redo' | 'undo'; readonly type: 'history' }
  | { readonly type: 'toggle-selection' };

export interface GanttKeyboardActionInput {
  readonly action: GanttKeyboardAction;
  readonly geometry?: GanttPointerGeometry;
}

interface DisplayInputs {
  readonly locale: string;
  readonly range: TimeRange;
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

function displayInputs(props: GanttProps): DisplayInputs {
  return Object.freeze({
    locale: props.locale ?? 'en-US',
    range: Object.freeze({ ...props.range }),
    tickAnchor: props.tickAnchor,
    tickInterval: props.tickInterval,
    timeZone: props.timeZone,
    view: props.view,
  });
}

function displayEqual(previous: DisplayInputs, next: DisplayInputs): boolean {
  return (
    previous.locale === next.locale &&
    previous.range.start === next.range.start &&
    previous.range.end === next.range.end &&
    previous.tickAnchor === next.tickAnchor &&
    previous.tickInterval === next.tickInterval &&
    previous.timeZone === next.timeZone &&
    JSON.stringify(previous.view) === JSON.stringify(next.view)
  );
}

function taskTarget(task: TaskBarPrimitive): GanttTaskTarget {
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

function occurrences(scene: ChartScene): {
  readonly runtime: readonly GanttRuntimeOccurrence[];
  readonly visible: readonly GanttVisibleOccurrence[];
} {
  const lanes = new Map(scene.lanes.map((lane, index) => [lane.viewKey, index]));
  const visible = scene.taskBars.map((task) =>
    Object.freeze({
      end: task.end,
      start: task.start,
      target: taskTarget(task),
    }),
  );
  return Object.freeze({
    runtime: Object.freeze(
      scene.taskBars.map((task, index) =>
        Object.freeze({
          horizontalCenter: task.x + task.width / 2,
          laneIndex: lanes.get(task.laneViewKey) ?? index,
          target: visible[index]!.target,
        }),
      ),
    ),
    visible: Object.freeze(visible),
  });
}

function targetIdentity(target: GanttInteractionTarget | undefined): string | undefined {
  return target === undefined ? undefined : `${target.kind}\u0000${target.viewKey}`;
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
  visible: readonly GanttVisibleOccurrence[],
  interaction: GanttInteractionState,
): GanttSelectorSnapshot {
  return Object.freeze({
    canRedo: store.history.canRedo,
    canUndo: store.history.canUndo,
    document: store.document,
    interaction,
    occurrences: visible,
    range: display.range,
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
  let inputDiagnostics = initialValidation.diagnostics;
  const documentControlled = controlledDocument(initialProps) !== undefined;
  const sessionControlled = initialProps.session !== undefined;
  let active = false;
  let activationVersion = 0;
  let disposed = false;
  let rebuilding = false;
  let rebuildPending = false;
  let semanticSource: GanttSemanticEvent['source'] = 'runtime';
  let lastDocument: GanttDocument | undefined;
  let gesture: InteractionGestureState = IDLE_INTERACTION_GESTURE;
  let gestureGeometry: GanttPointerGeometry | undefined;
  let keyboardGesture: InteractionKeyboardState | undefined;
  let interaction: GanttInteractionState = Object.freeze({ status: 'idle' });
  const subscribers = new Set<() => void>();
  const pipeline = createChartScenePipeline();
  const store: GanttRuntimeStore = createGanttRuntimeStore({
    document: documentControlled
      ? { kind: 'controlled', value: initialValidation.document }
      : { kind: 'uncontrolled', value: initialValidation.document },
    ...(initialProps.historyCapacity === undefined
      ? {}
      : { historyCapacity: initialProps.historyCapacity }),
    session: initialSession(initialProps),
    viewport: {
      schedule(update) {
        if (typeof requestAnimationFrame !== 'function') {
          update();
          return;
        }
        const frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
      },
    },
  });

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
        const label = interactionActionLabel(action ?? 'interaction');
        setInteraction(
          Object.freeze({
            announcement: `${label} committed.`,
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
            announcement: event.diagnostics[0]?.message ?? 'Interaction rejected.',
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
    const derivedScene = pipeline.build(
      {
        document: storeSnapshot.document,
        range: display.range,
        tickAnchor: display.tickAnchor,
        tickInterval: display.tickInterval,
        timeZone: display.timeZone,
        locale: display.locale,
        ...(display.view === undefined ? {} : { view: display.view }),
        ...(viewport === undefined ? {} : { viewport }),
      },
      invalidation,
    ).scene;
    const scene =
      inputDiagnostics.length === 0
        ? derivedScene
        : Object.freeze({
            ...derivedScene,
            diagnostics: Object.freeze([...inputDiagnostics, ...derivedScene.diagnostics]),
          });
    lastDocument = storeSnapshot.document;
    const sceneOccurrences = occurrences(scene);
    store.setOccurrences(sceneOccurrences.runtime);
    const reconciledStore = store.getSnapshot();
    return Object.freeze({
      scene,
      selector: createSelectorSnapshot(
        reconciledStore,
        display,
        sceneOccurrences.visible,
        composedInteraction(reconciledStore),
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

  function alignedVerticalStart(task: TaskBarPrimitive, options?: GanttScrollOptions): number {
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
      index: createInteractionHitTestIndex(snapshot.scene, {
        height: geometry.height,
        verticalStart: geometry.verticalStart,
        width: geometry.width,
        x: geometry.x,
        y: geometry.y,
      }),
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
    return focused?.kind === 'task' ? visibleTarget(focused) : undefined;
  }

  function taskTitle(target: GanttTaskTarget): string {
    return (
      snapshot.scene.taskBars.find((task) => task.viewKey === target.viewKey)?.title ??
      target.taskId
    );
  }

  function revealKeyboardTarget(target: GanttTaskTarget): void {
    const task = snapshot.scene.taskBars.find((candidate) => candidate.viewKey === target.viewKey);
    if (task === undefined) {
      return;
    }
    const session = store.getSnapshot().session;
    const extent =
      snapshot.selector.viewport.status === 'measured'
        ? snapshot.selector.viewport.clientHeight
        : snapshot.scene.bounds.defaultLaneHeight;
    const currentStart = session.viewport.verticalStart;
    const currentEnd = currentStart + extent;
    const verticalStart =
      task.y < currentStart
        ? task.y
        : task.y + task.height > currentEnd
          ? task.y + task.height - extent
          : currentStart;
    updateSession(
      Object.freeze({
        focused: target,
        selection: session.selection,
        viewport: Object.freeze({
          verticalStart: Math.max(
            0,
            Math.min(verticalStart, Math.max(0, snapshot.scene.bounds.timelineHeight - extent)),
          ),
        }),
      }),
      'runtime',
    );
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
          selection: Object.freeze(selection),
          viewport: session.viewport,
        }),
        'runtime',
      )
    ) {
      setInteraction(
        Object.freeze({
          announcement: `${taskTitle(target)} ${selected ? 'deselected' : 'selected'}.`,
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
    const next = beginKeyboardInteraction(target, mode, interactionOptions(geometry));
    if (next === undefined) {
      return false;
    }
    keyboardGesture = next;
    const action = mode === 'move' ? 'move' : 'resize';
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
        selection: Object.freeze([target]),
        viewport: session.viewport,
      }),
      'runtime',
    );
  }

  function autoPan(input: GanttPointerMoveInput, options: InteractionGestureOptions): void {
    if (gesture.status !== 'active') {
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
    if (horizontalDirection !== 0 && callbacks.onRangeChange !== undefined) {
      const shift = horizontalDirection * options.snap.step;
      const range = Object.freeze({
        end: display.range.end + shift,
        start: display.range.start + shift,
      });
      const event = Object.freeze({ source: 'runtime' as const });
      emitCallback('onRangeChange', () => callbacks.onRangeChange?.(range, event));
    }
  }

  const handleValue: GanttHandle = {
    canRedo: () => store.getSnapshot().history.canRedo,
    canUndo: () => store.getSnapshot().history.canUndo,
    dispatch: (command, options) => bus.dispatch(command, options),
    focusTask(target) {
      const current = visibleTarget(target);
      if (current === undefined) {
        return false;
      }
      return updateSession(
        Object.freeze({
          focused: current,
          selection: store.getSnapshot().session.selection,
          viewport: store.getSnapshot().session.viewport,
        }),
      );
    },
    getDocument: () => store.getSnapshot().document,
    getSelection: () => store.getSnapshot().session.selection,
    getSession: () => store.getSnapshot().session,
    redo: () => bus.redo(),
    scrollToTask(target, options) {
      const task = snapshot.scene.taskBars.find(
        (candidate) => candidate.viewKey === target.viewKey,
      );
      if (task === undefined) {
        return false;
      }
      const session = store.getSnapshot().session;
      return updateSession(
        Object.freeze({
          ...(session.focused === undefined ? {} : { focused: session.focused }),
          selection: session.selection,
          viewport: Object.freeze({
            verticalStart: alignedVerticalStart(task, options),
          }),
        }),
      );
    },
    scrollToTime(time: EpochMilliseconds, options?: GanttScrollOptions) {
      if (!Number.isFinite(time) || callbacks.onRangeChange === undefined) {
        return false;
      }
      const duration = display.range.end - display.range.start;
      const align = options?.align ?? 'center';
      const start =
        align === 'start' ? time : align === 'end' ? time - duration : time - duration / 2;
      const range = Object.freeze({ start, end: start + duration });
      const event = Object.freeze({ source: 'imperative' as const });
      emitCallback('onRangeChange', () => callbacks.onRangeChange?.(range, event));
      return true;
    },
    undo: () => bus.undo(),
  };
  const handle: GanttHandle = Object.freeze(handleValue);

  const runtime: GanttReactRuntime = {
    activate() {
      if (disposed) {
        throw new Error('The Gantt React runtime has been disposed.');
      }
      activationVersion += 1;
      active = true;
    },

    clearMeasurement() {
      if (disposed) {
        return;
      }
      store.clearViewportMeasurement();
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
      unsubscribeStore();
      subscribers.clear();
      bus.dispose();
    },

    dispatchAction,

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
      if (input.geometry === undefined) {
        return false;
      }
      const options = interactionOptions(input.geometry);
      if (keyboardGesture !== undefined) {
        if (input.action.type === 'cancel') {
          keyboardGesture = undefined;
          setInteraction(
            Object.freeze({
              announcement: 'Keyboard interaction cancelled.',
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
        const next = adjustKeyboardInteraction(keyboardGesture, input.action.direction, options);
        keyboardGesture = next;
        const target = next.intent.source;
        const action = next.intent.kind === 'resize' ? 'resize' : 'move';
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

      const target = focusedKeyboardTarget();
      if (target === undefined) {
        return false;
      }
      if (input.action.type === 'navigate') {
        const next = navigateInteractionOccurrence(options.index, target, input.action.direction);
        if (next === undefined) {
          return false;
        }
        revealKeyboardTarget(next);
        return true;
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
          selection: session.selection,
          viewport: session.viewport,
        }),
        'runtime',
      );
    },

    measure(measurement) {
      store.scheduleViewportMeasurement(measurement);
    },

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
      const options = interactionOptions(input.geometry);
      const next = reduceInteractionGesture(
        gesture,
        {
          ...(input.candidateViewKey === undefined
            ? {}
            : { candidateViewKey: input.candidateViewKey }),
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
      if (
        nextDocumentControlled !== documentControlled ||
        nextSessionControlled !== sessionControlled
      ) {
        throw new Error('Gantt ownership modes cannot change after mount.');
      }
      bus.updateInterceptors(props.interceptors ?? []);
      const nextDisplay = displayInputs(props);
      const changedDisplay = !displayEqual(display, nextDisplay);
      const validation = documentControlled
        ? validateDocumentReferences(props.document!)
        : undefined;
      const changedDiagnostics =
        validation !== undefined &&
        JSON.stringify(validation.diagnostics) !== JSON.stringify(inputDiagnostics);
      const previousSelector = snapshot.selector;
      const previousVersion = snapshot.version;
      display = nextDisplay;
      if (validation !== undefined) {
        inputDiagnostics = validation.diagnostics;
      }
      semanticSource = 'controlled-prop';
      try {
        if (documentControlled) {
          bus.updateControlledDocument(validation!.document);
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
              announcement: 'Keyboard interaction cancelled because its task is no longer visible.',
              status: 'idle',
            }),
          );
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
    },

    subscribe(subscriber) {
      if (disposed) {
        throw new Error('The Gantt React runtime has been disposed.');
      }
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    updateCallbacks(props) {
      callbacks = props;
    },
  };
  return Object.freeze(runtime);
}

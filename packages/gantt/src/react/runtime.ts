import type { EntityReference } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import { validateDocumentReferences } from '../model/validate';
import { createChartScenePipeline } from '../render/scene-pipeline';
import type { ChartScene, TaskBarPrimitive } from '../render/primitives';
import { createGanttCommandBus } from '../runtime/command-bus';
import { sessionEqual } from '../runtime/session';
import { createGanttRuntimeStore } from '../runtime/store';
import type {
  GanttCommandBus,
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
  getHandle(): GanttHandle;
  getSnapshot(): GanttReactRuntimeSnapshot;
  measure(measurement: GanttViewportMeasurement): void;
  reconcile(props: GanttProps): void;
  subscribe(subscriber: () => void): () => void;
  updateCallbacks(props: GanttProps): void;
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
): GanttSelectorSnapshot {
  return Object.freeze({
    canRedo: store.history.canRedo,
    canUndo: store.history.canUndo,
    document: store.document,
    interaction: store.interaction,
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
      callbacks.onCommandCommitted?.(event);
    },
    onCommandRejected(event) {
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
  ): void {
    if (!active || callbacks.onSessionChange === undefined || sessionEqual(previous, next)) {
      return;
    }
    const event = Object.freeze({ source: 'imperative' as const });
    emitCallback('onSessionChange', () => callbacks.onSessionChange?.(next, event));
    if (!selectionEqual(previous.selection, next.selection)) {
      emitCallback('onSelectionChange', () => callbacks.onSelectionChange?.(next.selection, event));
    }
    if (targetIdentity(previous.focused) !== targetIdentity(next.focused)) {
      emitCallback('onFocusChange', () => callbacks.onFocusChange?.(next.focused, event));
    }
    if (previous.viewport.verticalStart !== next.viewport.verticalStart) {
      emitCallback('onViewportChange', () =>
        callbacks.onViewportChange?.(
          Object.freeze({
            measured: snapshot.selector.viewport,
            range: snapshot.selector.range,
            session: next.viewport,
          }),
          event,
        ),
      );
    }
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
      selector: createSelectorSnapshot(reconciledStore, display, sceneOccurrences.visible),
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

  function updateSession(next: GanttSessionState): boolean {
    if (sessionControlled) {
      if (callbacks.onSessionChange === undefined) {
        return false;
      }
      emitControlledSessionProposal(store.getSnapshot().session, next);
      return true;
    }
    semanticSource = 'imperative';
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

    getHandle() {
      return handle;
    },

    getSnapshot() {
      return snapshot;
    },

    measure(measurement) {
      store.scheduleViewportMeasurement(measurement);
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

import { applyGanttCommand } from '../commands/reduce';
import type { CommandOutcome, GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import {
  commitGanttRuntimeHistory,
  createGanttRuntimeHistory,
  rebaseGanttRuntimeHistory,
  redoGanttRuntimeHistory,
  undoGanttRuntimeHistory,
  type GanttRuntimeHistoryState,
} from './runtime-history';
import { cloneInteractionTarget } from './session';
import type {
  CreateGanttCommandBusOptions,
  GanttCommandBus,
  GanttCommandCancellation,
  GanttCommandCancellationController,
  GanttCommandCommittedEvent,
  GanttCommandInterception,
  GanttCommandProposal,
  GanttCommandRejectedEvent,
  GanttCommandSource,
  GanttDispatchOptions,
  GanttDispatchResult,
  GanttDocumentChange,
  GanttInteractionTarget,
  GanttRuntimeErrorEvent,
  UpdateControlledDocumentResult,
} from './types';

type CancellationReason = 'aborted' | 'disposed';

interface LifecycleContext {
  readonly command?: GanttCommand;
  readonly operation: 'dispatch' | 'redo' | 'undo';
  readonly originalCommand?: GanttCommand;
  readonly proposalId: string;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
}

interface PendingControlledOperation {
  readonly change: GanttDocumentChange;
  readonly context: LifecycleContext;
  readonly history?: GanttRuntimeHistoryState;
  readonly outcome?: Extract<CommandOutcome, { readonly status: 'committed' }>;
}

interface OperationCancellation {
  cleanup(): void;
  readonly promise: Promise<CancellationReason>;
  readonly reason: CancellationReason | undefined;
  subscribe(subscriber: (reason: CancellationReason) => void): () => void;
}

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly Diagnostic[];

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndFreezeData(input: unknown, ancestors = new WeakSet<object>()): unknown {
  if (
    input === null ||
    input === undefined ||
    typeof input === 'boolean' ||
    typeof input === 'number' ||
    typeof input === 'string'
  ) {
    return input;
  }
  if (typeof input !== 'object') {
    throw new TypeError('Runtime command data must contain only plain data.');
  }
  if (ancestors.has(input)) {
    throw new TypeError('Runtime command data must not contain cycles.');
  }
  ancestors.add(input);
  if (Array.isArray(input)) {
    const output: unknown[] = [];
    for (let index = 0; index < input.length; index += 1) {
      if (!Object.hasOwn(input, index)) {
        throw new TypeError('Runtime command arrays must not be sparse.');
      }
      output.push(cloneAndFreezeData(input[index], ancestors));
    }
    ancestors.delete(input);
    return Object.freeze(output);
  }
  if (!isPlainObject(input)) {
    throw new TypeError('Runtime command objects must be plain objects.');
  }
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    output[key] = cloneAndFreezeData(input[key], ancestors);
  }
  ancestors.delete(input);
  return Object.freeze(output);
}

function cloneCommand(command: GanttCommand): GanttCommand {
  const cloned = cloneAndFreezeData(command);
  if (!isPlainObject(cloned) || typeof cloned.type !== 'string') {
    throw new TypeError('A runtime command must be a plain object with a string type.');
  }
  return cloned as unknown as GanttCommand;
}

function diagnostic(code: Diagnostic['code'], message: string, path = '/runtime'): Diagnostic {
  return Object.freeze({ code, message, path, severity: 'error' });
}

function freezeDiagnostic(input: Diagnostic): Diagnostic {
  if (
    !isPlainObject(input) ||
    typeof input.code !== 'string' ||
    typeof input.message !== 'string' ||
    !['error', 'info', 'warning'].includes(String(input.severity))
  ) {
    throw new TypeError('An interceptor rejection requires a valid diagnostic.');
  }
  const entityIds = input.entityIds === undefined ? undefined : Object.freeze([...input.entityIds]);
  return Object.freeze({
    code: input.code,
    ...(input.details === undefined
      ? {}
      : {
          details: cloneAndFreezeData(input.details) as NonNullable<Diagnostic['details']>,
        }),
    ...(entityIds === undefined ? {} : { entityIds }),
    message: input.message,
    ...(input.path === undefined ? {} : { path: input.path }),
    severity: input.severity,
  });
}

function normalizeSource(input: GanttCommandSource | undefined): GanttCommandSource {
  const source = input ?? { kind: 'imperative' };
  switch (source.kind) {
    case 'pointer':
      if (!['mouse', 'pen', 'touch'].includes(source.pointerType)) {
        throw new TypeError('Pointer command source requires mouse, pen, or touch.');
      }
      return Object.freeze({ kind: 'pointer', pointerType: source.pointerType });
    case 'history':
      if (source.action !== 'undo' && source.action !== 'redo') {
        throw new TypeError('History command source requires undo or redo.');
      }
      return Object.freeze({ action: source.action, kind: 'history' });
    case 'context-menu':
    case 'editor':
    case 'imperative':
    case 'keyboard':
    case 'toolbar':
      return Object.freeze({ kind: source.kind });
    default:
      throw new TypeError('Unknown runtime command source.');
  }
}

function callbackMessage(name: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${name} threw: ${detail}`;
}

function freezeContext(context: LifecycleContext): LifecycleContext {
  return Object.freeze({
    ...(context.command === undefined ? {} : { command: context.command }),
    operation: context.operation,
    ...(context.originalCommand === undefined ? {} : { originalCommand: context.originalCommand }),
    proposalId: context.proposalId,
    source: context.source,
    ...(context.target === undefined ? {} : { target: context.target }),
  });
}

function cancellationDiagnostic(reason: CancellationReason): Diagnostic {
  return reason === 'disposed'
    ? diagnostic('runtime.disposed', 'The runtime was disposed before the operation completed.')
    : diagnostic('runtime.aborted', 'The runtime operation was aborted.');
}

export function createGanttCommandCancellationController(): GanttCommandCancellationController {
  let aborted = false;
  const subscribers = new Set<() => void>();
  const signal: GanttCommandCancellation = Object.freeze({
    get aborted() {
      return aborted;
    },
    subscribe(subscriber: () => void) {
      if (aborted) {
        subscriber();
        return () => {};
      }
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  });
  return Object.freeze({
    abort() {
      if (aborted) {
        return;
      }
      aborted = true;
      for (const subscriber of Array.from(subscribers)) {
        subscriber();
      }
      subscribers.clear();
    },
    signal,
  });
}

export function createGanttCommandBus(options: CreateGanttCommandBusOptions): GanttCommandBus {
  const { store } = options;
  const interceptors = Object.freeze([...(options.interceptors ?? [])]);
  let runtimeHistory = createGanttRuntimeHistory(
    store.getSnapshot().document,
    store.getSnapshot().history.capacity,
  );
  let pendingControlled: PendingControlledOperation | undefined;
  let proposalCounter = 0;
  let disposed = false;
  let queueTail = Promise.resolve();
  const disposalSubscribers = new Set<() => void>();
  const reportHostError =
    options.reportHostError ??
    ((error: unknown) => {
      queueMicrotask(() => {
        throw error;
      });
    });

  function proposalId(): string {
    proposalCounter += 1;
    return `proposal-${proposalCounter}`;
  }

  function reportCallbackError(callback: GanttRuntimeErrorEvent['callback'], error: unknown): void {
    const event = Object.freeze({
      callback,
      diagnostic: diagnostic(
        'runtime.callback-threw',
        callbackMessage(callback, error),
        `/runtime/callbacks/${callback}`,
      ),
      type: 'runtimeError' as const,
    });
    if (callback !== 'onRuntimeError' && options.onRuntimeError !== undefined) {
      try {
        options.onRuntimeError(event);
      } catch (runtimeError) {
        reportHostError(runtimeError);
      }
    }
    reportHostError(error);
  }

  function invokeCallback<T>(
    name: Exclude<GanttRuntimeErrorEvent['callback'], 'onRuntimeError'>,
    callback: ((value: T) => void) | undefined,
    value: T,
  ): void {
    if (callback === undefined) {
      return;
    }
    try {
      callback(value);
    } catch (error) {
      reportCallbackError(name, error);
    }
  }

  function emitRejected(
    context: LifecycleContext,
    diagnostics: readonly Diagnostic[],
  ): GanttDispatchResult {
    const frozenDiagnostics = Object.freeze([...diagnostics]);
    const event: GanttCommandRejectedEvent = Object.freeze({
      ...(context.command === undefined ? {} : { command: context.command }),
      diagnostics: frozenDiagnostics,
      operation: context.operation,
      ...(context.originalCommand === undefined
        ? {}
        : { originalCommand: context.originalCommand }),
      proposalId: context.proposalId,
      source: context.source,
      ...(context.target === undefined ? {} : { target: context.target }),
      type: 'commandRejected',
    });
    invokeCallback('onCommandRejected', options.onCommandRejected, event);
    return Object.freeze({
      diagnostics: frozenDiagnostics,
      proposalId: context.proposalId,
      status: 'rejected',
    });
  }

  function emitCommitted(
    context: LifecycleContext,
    change?: GanttDocumentChange,
  ): GanttDispatchResult {
    const event: GanttCommandCommittedEvent = Object.freeze({
      ...(change === undefined ? {} : { change }),
      ...(context.command === undefined ? {} : { command: context.command }),
      operation: context.operation,
      ...(context.originalCommand === undefined
        ? {}
        : { originalCommand: context.originalCommand }),
      proposalId: context.proposalId,
      source: context.source,
      ...(context.target === undefined ? {} : { target: context.target }),
      type: 'commandCommitted',
    });
    invokeCallback('onCommandCommitted', options.onCommandCommitted, event);
    return Object.freeze({
      ...(change === undefined ? {} : { change }),
      proposalId: context.proposalId,
      status: 'committed',
    });
  }

  function createOperationCancellation(
    external: GanttCommandCancellation | undefined,
  ): OperationCancellation {
    let reason: CancellationReason | undefined;
    let resolvePromise!: (reason: CancellationReason) => void;
    const subscribers = new Set<(reason: CancellationReason) => void>();
    const promise = new Promise<CancellationReason>((resolve) => {
      resolvePromise = resolve;
    });
    const cancel = (nextReason: CancellationReason) => {
      if (reason !== undefined) {
        return;
      }
      reason = nextReason;
      resolvePromise(nextReason);
      for (const subscriber of Array.from(subscribers)) {
        subscriber(nextReason);
      }
      subscribers.clear();
    };
    const disposeSubscriber = () => cancel('disposed');
    disposalSubscribers.add(disposeSubscriber);
    const unsubscribeExternal = external?.subscribe(() => cancel('aborted')) ?? (() => {});
    if (external?.aborted === true) {
      cancel('aborted');
    }
    if (disposed) {
      cancel('disposed');
    }
    return {
      cleanup() {
        disposalSubscribers.delete(disposeSubscriber);
        unsubscribeExternal();
        subscribers.clear();
      },
      promise,
      get reason() {
        return reason;
      },
      subscribe(subscriber) {
        if (reason !== undefined) {
          subscriber(reason);
          return () => {};
        }
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
    };
  }

  function enqueue(
    context: LifecycleContext,
    cancellationInput: GanttCommandCancellation | undefined,
    operation: (cancellation: OperationCancellation) => Promise<GanttDispatchResult>,
  ): Promise<GanttDispatchResult> {
    const cancellation = createOperationCancellation(cancellationInput);
    return new Promise<GanttDispatchResult>((resolve) => {
      let started = false;
      let settled = false;
      let unsubscribeCancellation = () => {};
      const settle = (result: GanttDispatchResult) => {
        if (settled) {
          return;
        }
        settled = true;
        unsubscribeCancellation();
        cancellation.cleanup();
        resolve(result);
      };
      unsubscribeCancellation = cancellation.subscribe((reason) => {
        if (!started) {
          settle(emitRejected(context, [cancellationDiagnostic(reason)]));
        }
      });
      const run = async () => {
        if (settled) {
          return;
        }
        started = true;
        try {
          settle(await operation(cancellation));
        } catch (error) {
          settle(
            emitRejected(context, [
              diagnostic(
                'runtime.internal-error',
                `The runtime operation failed unexpectedly: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              ),
            ]),
          );
        }
      };
      queueTail = queueTail.then(run, run).then(
        () => undefined,
        () => undefined,
      );
    });
  }

  function cloneDispatchContext(
    command: GanttCommand,
    dispatchOptions: GanttDispatchOptions | undefined,
  ): LifecycleContext {
    const originalCommand = cloneCommand(command);
    const target =
      dispatchOptions?.target === undefined
        ? undefined
        : cloneInteractionTarget(dispatchOptions.target);
    return freezeContext({
      command: originalCommand,
      operation: 'dispatch',
      originalCommand,
      proposalId: proposalId(),
      source: normalizeSource(dispatchOptions?.source),
      ...(target === undefined ? {} : { target }),
    });
  }

  async function interceptCommand(
    context: LifecycleContext,
    document: GanttDocument,
    cancellation: OperationCancellation,
  ): Promise<
    | { readonly command: GanttCommand; readonly status: 'allowed' }
    | { readonly diagnostics: readonly Diagnostic[]; readonly status: 'rejected' }
  > {
    let command = context.command!;
    for (const interceptor of interceptors) {
      if (cancellation.reason !== undefined) {
        return Object.freeze({
          diagnostics: Object.freeze([cancellationDiagnostic(cancellation.reason)]),
          status: 'rejected',
        });
      }
      const proposal: GanttCommandProposal = Object.freeze({
        command,
        document,
        proposalId: context.proposalId,
        source: context.source,
        ...(context.target === undefined ? {} : { target: context.target }),
      });
      const intercepted = Promise.resolve()
        .then(() => interceptor(proposal))
        .then(
          (value) => ({ kind: 'value' as const, value }),
          (error) => ({ error, kind: 'error' as const }),
        );
      const result = await Promise.race([
        intercepted,
        cancellation.promise.then((reason) => ({ kind: 'cancelled' as const, reason })),
      ]);
      if (result.kind === 'cancelled') {
        return Object.freeze({
          diagnostics: Object.freeze([cancellationDiagnostic(result.reason)]),
          status: 'rejected',
        });
      }
      if (result.kind === 'error') {
        return Object.freeze({
          diagnostics: Object.freeze([
            diagnostic(
              'runtime.interceptor-threw',
              `A command interceptor threw: ${
                result.error instanceof Error ? result.error.message : String(result.error)
              }`,
              '/runtime/interceptors',
            ),
          ]),
          status: 'rejected',
        });
      }
      const value = result.value;
      if (!isPlainObject(value) || !['allow', 'reject', 'replace'].includes(String(value.kind))) {
        return Object.freeze({
          diagnostics: Object.freeze([
            diagnostic(
              'runtime.invalid-interceptor-result',
              'A command interceptor returned an invalid result.',
              '/runtime/interceptors',
            ),
          ]),
          status: 'rejected',
        });
      }
      const interception = value as unknown as GanttCommandInterception;
      if (interception.kind === 'reject') {
        try {
          return Object.freeze({
            diagnostics: Object.freeze([freezeDiagnostic(interception.diagnostic)]),
            status: 'rejected',
          });
        } catch {
          return Object.freeze({
            diagnostics: Object.freeze([
              diagnostic(
                'runtime.invalid-interceptor-result',
                'A command interceptor returned an invalid rejection diagnostic.',
                '/runtime/interceptors',
              ),
            ]),
            status: 'rejected',
          });
        }
      }
      if (interception.kind === 'replace') {
        try {
          command = cloneCommand(interception.command);
        } catch {
          return Object.freeze({
            diagnostics: Object.freeze([
              diagnostic(
                'runtime.invalid-interceptor-result',
                'A command interceptor returned an invalid replacement command.',
                '/runtime/interceptors',
              ),
            ]),
            status: 'rejected',
          });
        }
      }
    }
    return Object.freeze({ command, status: 'allowed' });
  }

  function createChange(
    context: LifecycleContext,
    operation: GanttDocumentChange['operation'],
    originalCommand: GanttCommand,
    command: GanttCommand,
    document: GanttDocument,
    patches: GanttDocumentChange['patches'],
    inversePatches: GanttDocumentChange['inversePatches'],
    affected: GanttDocumentChange['affected'],
    diagnostics: GanttDocumentChange['diagnostics'],
    baseDocument: GanttDocument,
  ): GanttDocumentChange {
    return Object.freeze({
      affected,
      ...(baseDocument.revision === undefined ? {} : { baseRevision: baseDocument.revision }),
      command,
      diagnostics,
      document,
      inversePatches,
      operation,
      originalCommand,
      patches,
      proposalId: context.proposalId,
      source: context.source,
      ...(context.target === undefined ? {} : { target: context.target }),
    });
  }

  function syncHistoryCapabilities(): void {
    store.setHistoryCapabilities(
      (runtimeHistory?.past.length ?? 0) > 0,
      (runtimeHistory?.future.length ?? 0) > 0,
    );
  }

  function resetHistory(document: GanttDocument): void {
    runtimeHistory = createGanttRuntimeHistory(document, store.getSnapshot().history.capacity);
  }

  function runStoreBatch(operation: () => void): void {
    try {
      store.batch(operation);
    } catch (error) {
      // Store subscribers are host callbacks; committed runtime state is not rolled back.
      reportHostError(error);
    }
  }

  function commitUncontrolledHistory(
    outcome: Extract<CommandOutcome, { readonly status: 'committed' }>,
    change: GanttDocumentChange,
  ): void {
    if (runtimeHistory === undefined) {
      return;
    }
    const committed = commitGanttRuntimeHistory(runtimeHistory, outcome, change);
    if (committed.status === 'committed') {
      runtimeHistory = committed.history;
      return;
    }
    resetHistory(outcome.document);
  }

  async function executeDispatch(
    initialContext: LifecycleContext,
    cancellation: OperationCancellation,
  ): Promise<GanttDispatchResult> {
    if (cancellation.reason !== undefined) {
      return emitRejected(initialContext, [cancellationDiagnostic(cancellation.reason)]);
    }
    const controlled = store.getSnapshot().ownership.document === 'controlled';
    if (controlled && store.getSnapshot().ownership.pendingDocument !== undefined) {
      return emitRejected(initialContext, [
        diagnostic(
          'runtime.pending-proposal',
          'A controlled document proposal is already awaiting acknowledgement.',
        ),
      ]);
    }
    if (controlled && options.onDocumentChange === undefined) {
      return emitRejected(initialContext, [
        diagnostic('runtime.read-only', 'Controlled document mutation requires onDocumentChange.'),
      ]);
    }

    const capture = store.captureDocument();
    const interception = await interceptCommand(initialContext, capture.document, cancellation);
    if (interception.status === 'rejected') {
      return emitRejected(initialContext, interception.diagnostics);
    }
    const context = freezeContext({ ...initialContext, command: interception.command });
    if (cancellation.reason !== undefined) {
      return emitRejected(context, [cancellationDiagnostic(cancellation.reason)]);
    }
    if (store.captureDocument().serialization !== capture.serialization) {
      return emitRejected(context, [
        diagnostic(
          'runtime.stale-base',
          'The authoritative document changed while command interception was pending.',
        ),
      ]);
    }
    const outcome = applyGanttCommand(capture.document, interception.command);
    if (outcome.status === 'rejected') {
      return emitRejected(context, outcome.diagnostics);
    }
    if (outcome.patches.length === 0) {
      return emitCommitted(context);
    }
    const change = createChange(
      context,
      'dispatch',
      initialContext.originalCommand!,
      interception.command,
      outcome.document,
      outcome.patches,
      outcome.inversePatches,
      outcome.affected,
      outcome.diagnostics,
      capture.document,
    );

    if (controlled) {
      const staged = store.stageControlledDocumentProposal({
        baseSerialization: capture.serialization,
        candidate: outcome.document,
        proposalId: context.proposalId,
      });
      if (staged.status !== 'staged') {
        const code =
          staged.status === 'pending-proposal' ? 'runtime.pending-proposal' : 'runtime.stale-base';
        return emitRejected(context, [
          diagnostic(code, `The controlled candidate could not be staged: ${staged.status}.`),
        ]);
      }
      pendingControlled = Object.freeze({ change, context, outcome });
      invokeCallback('onDocumentChange', options.onDocumentChange, change);
      return Object.freeze({
        change,
        proposalId: context.proposalId,
        status: 'proposed',
      });
    }

    runStoreBatch(() => {
      store.adoptUncontrolledDocument(outcome.document);
      commitUncontrolledHistory(outcome, change);
      syncHistoryCapabilities();
    });
    invokeCallback('onDocumentChange', options.onDocumentChange, change);
    return emitCommitted(context, change);
  }

  function historyContext(
    action: 'redo' | 'undo',
    dispatchOptions: Omit<GanttDispatchOptions, 'source'> | undefined,
  ): LifecycleContext {
    const target =
      dispatchOptions?.target === undefined
        ? undefined
        : cloneInteractionTarget(dispatchOptions.target);
    return freezeContext({
      operation: action,
      proposalId: proposalId(),
      source: Object.freeze({ action, kind: 'history' }),
      ...(target === undefined ? {} : { target }),
    });
  }

  async function executeHistory(
    action: 'redo' | 'undo',
    initialContext: LifecycleContext,
    cancellation: OperationCancellation,
  ): Promise<GanttDispatchResult> {
    if (cancellation.reason !== undefined) {
      return emitRejected(initialContext, [cancellationDiagnostic(cancellation.reason)]);
    }
    const controlled = store.getSnapshot().ownership.document === 'controlled';
    if (controlled && store.getSnapshot().ownership.pendingDocument !== undefined) {
      return emitRejected(initialContext, [
        diagnostic(
          'runtime.pending-proposal',
          'A controlled document proposal is already awaiting acknowledgement.',
        ),
      ]);
    }
    if (controlled && options.onDocumentChange === undefined) {
      return emitRejected(initialContext, [
        diagnostic('runtime.read-only', 'Controlled document history requires onDocumentChange.'),
      ]);
    }
    const capture = store.captureDocument();
    if (
      runtimeHistory !== undefined &&
      serializeGanttDocument(runtimeHistory.kernel.document) !== capture.serialization
    ) {
      return emitRejected(initialContext, [
        diagnostic(
          'runtime.history-rejected',
          'Runtime history does not descend from the authoritative document.',
        ),
      ]);
    }
    const operation =
      action === 'undo'
        ? undoGanttRuntimeHistory(runtimeHistory)
        : redoGanttRuntimeHistory(runtimeHistory);
    if (operation.status === 'empty') {
      return emitRejected(initialContext, [
        diagnostic('runtime.history-empty', `There is no ${action} history entry.`),
      ]);
    }
    if (operation.status === 'rejected') {
      return emitRejected(initialContext, [
        diagnostic('runtime.history-rejected', `The ${action} patch batch could not be applied.`),
        ...operation.diagnostics,
      ]);
    }
    const descriptor = operation.descriptor.change;
    const context = freezeContext({
      ...initialContext,
      command: descriptor.command,
      originalCommand: descriptor.originalCommand,
    });
    const patches = action === 'undo' ? descriptor.inversePatches : descriptor.patches;
    const inversePatches = action === 'undo' ? descriptor.patches : descriptor.inversePatches;
    const change = createChange(
      context,
      action,
      descriptor.originalCommand,
      descriptor.command,
      operation.document,
      patches,
      inversePatches,
      descriptor.affected,
      EMPTY_DIAGNOSTICS,
      capture.document,
    );

    if (controlled) {
      const staged = store.stageControlledDocumentProposal({
        baseSerialization: capture.serialization,
        candidate: operation.document,
        proposalId: context.proposalId,
      });
      if (staged.status !== 'staged') {
        return emitRejected(context, [
          diagnostic(
            staged.status === 'pending-proposal'
              ? 'runtime.pending-proposal'
              : 'runtime.stale-base',
            `The controlled ${action} candidate could not be staged: ${staged.status}.`,
          ),
        ]);
      }
      pendingControlled = Object.freeze({
        change,
        context,
        history: operation.history,
      });
      invokeCallback('onDocumentChange', options.onDocumentChange, change);
      return Object.freeze({
        change,
        proposalId: context.proposalId,
        status: 'proposed',
      });
    }

    runStoreBatch(() => {
      store.adoptUncontrolledDocument(operation.document);
      runtimeHistory = operation.history;
      syncHistoryCapabilities();
    });
    invokeCallback('onDocumentChange', options.onDocumentChange, change);
    return emitCommitted(context, change);
  }

  function updateControlledDocument(document: GanttDocument): UpdateControlledDocumentResult {
    if (disposed) {
      throw new Error('The Gantt command bus has been disposed.');
    }
    let result!: UpdateControlledDocumentResult;
    let committed: PendingControlledOperation | undefined;
    let diverged: PendingControlledOperation | undefined;
    const beforeInvalidation = store.getSnapshot().history.invalidationVersion;
    runStoreBatch(() => {
      result = store.updateControlledDocument(document);
      if (result.status === 'acknowledged') {
        committed = pendingControlled;
        pendingControlled = undefined;
        if (committed?.history !== undefined) {
          runtimeHistory = rebaseGanttRuntimeHistory(
            committed.history,
            store.getSnapshot().document,
          );
        } else if (committed?.outcome !== undefined && runtimeHistory !== undefined) {
          const historyCommit = commitGanttRuntimeHistory(
            runtimeHistory,
            committed.outcome,
            committed.change,
          );
          runtimeHistory =
            historyCommit.status === 'committed'
              ? historyCommit.history
              : createGanttRuntimeHistory(
                  store.getSnapshot().document,
                  store.getSnapshot().history.capacity,
                );
        }
      } else if (result.status === 'diverged') {
        diverged = pendingControlled;
        pendingControlled = undefined;
        if (store.getSnapshot().history.invalidationVersion !== beforeInvalidation) {
          resetHistory(store.getSnapshot().document);
        } else {
          runtimeHistory = rebaseGanttRuntimeHistory(runtimeHistory, store.getSnapshot().document);
        }
      } else if (result.status === 'external-content') {
        resetHistory(store.getSnapshot().document);
      } else if (result.status === 'revision-only') {
        runtimeHistory = rebaseGanttRuntimeHistory(runtimeHistory, store.getSnapshot().document);
      }
      syncHistoryCapabilities();
    });

    if (committed !== undefined) {
      emitCommitted(committed.context, committed.change);
    }
    if (diverged !== undefined) {
      emitRejected(diverged.context, [
        diagnostic(
          'runtime.controlled-proposal-diverged',
          'The controlled document changed without acknowledging the pending candidate.',
        ),
      ]);
    }
    return result;
  }

  const bus: GanttCommandBus = {
    dispatch(command, dispatchOptions) {
      let context: LifecycleContext;
      try {
        context = cloneDispatchContext(command, dispatchOptions);
      } catch (error) {
        const fallback = freezeContext({
          operation: 'dispatch',
          proposalId: proposalId(),
          source: Object.freeze({ kind: 'imperative' }),
        });
        return Promise.resolve(
          emitRejected(fallback, [
            diagnostic(
              'command.invalid-payload',
              `The command could not be normalized: ${
                error instanceof Error ? error.message : String(error)
              }`,
              '/command',
            ),
          ]),
        );
      }
      return enqueue(context, dispatchOptions?.cancellation, (cancellation) =>
        executeDispatch(context, cancellation),
      );
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const subscriber of Array.from(disposalSubscribers)) {
        subscriber();
      }
      disposalSubscribers.clear();
      if (pendingControlled !== undefined) {
        emitRejected(pendingControlled.context, [
          diagnostic(
            'runtime.disposed',
            'The runtime was disposed before the controlled proposal was acknowledged.',
          ),
        ]);
      }
      pendingControlled = undefined;
      store.dispose();
    },

    isDisposed() {
      return disposed;
    },

    redo(dispatchOptions) {
      const context = historyContext('redo', dispatchOptions);
      return enqueue(context, dispatchOptions?.cancellation, (cancellation) =>
        executeHistory('redo', context, cancellation),
      );
    },

    undo(dispatchOptions) {
      const context = historyContext('undo', dispatchOptions);
      return enqueue(context, dispatchOptions?.cancellation, (cancellation) =>
        executeHistory('undo', context, cancellation),
      );
    },

    updateControlledDocument,
  };

  return Object.freeze(bus);
}

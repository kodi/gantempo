import { parseGanttDocument } from '../model/codec';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import {
  normalizeOccurrences,
  normalizeSessionState,
  reconcileSessionOccurrences,
  sessionEqual,
} from './session';
import type {
  CreateGanttRuntimeStoreOptions,
  GanttRuntimeDocumentCapture,
  GanttRuntimeEquality,
  GanttRuntimeHistoryMetadata,
  GanttRuntimeInteractionState,
  GanttRuntimeOccurrence,
  GanttRuntimeOwnershipState,
  GanttRuntimeSelector,
  GanttRuntimeSelectorSubscriber,
  GanttRuntimeSnapshot,
  GanttRuntimeStore,
  GanttRuntimeSubscriber,
  GanttSessionState,
  StageControlledDocumentProposalInput,
  StageControlledDocumentProposalResult,
  UpdateControlledDocumentResult,
} from './types';

const IDLE_INTERACTION = Object.freeze({ status: 'idle' }) as GanttRuntimeInteractionState;

function cloneCanonicalDocument(document: GanttDocument): {
  readonly contentSerialization: string;
  readonly document: GanttDocument;
  readonly serialization: string;
} {
  const serialization = serializeGanttDocument(document);
  const parsed = parseGanttDocument(JSON.parse(serialization));
  if (
    parsed.document === undefined ||
    parsed.diagnostics.some((item) => item.severity === 'error')
  ) {
    throw new TypeError('The runtime requires a canonical GanttDocument.');
  }
  const { revision: _revision, ...content } = parsed.document;
  return Object.freeze({
    contentSerialization: serializeGanttDocument(content),
    document: parsed.document,
    serialization,
  });
}

function historyCapacity(input: number | undefined): number {
  const capacity = input ?? 100;
  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new RangeError('Runtime history capacity must be a non-negative integer.');
  }
  return capacity;
}

function pendingSessionEqual(
  previous: GanttSessionState | undefined,
  next: GanttSessionState | undefined,
): boolean {
  return (
    previous === next ||
    (previous !== undefined && next !== undefined && sessionEqual(previous, next))
  );
}

export function createGanttRuntimeStore(
  options: CreateGanttRuntimeStoreOptions,
): GanttRuntimeStore {
  const initialDocument = cloneCanonicalDocument(options.document.value);
  const documentMode = options.document.kind;
  const sessionMode = options.session?.kind ?? 'uncontrolled';
  let sourceSession = normalizeSessionState(options.session?.value);
  let documentSerialization = initialDocument.serialization;
  let documentContentSerialization = initialDocument.contentSerialization;
  let previousOccurrences = Object.freeze([]) as readonly GanttRuntimeOccurrence[];
  let currentOccurrences = previousOccurrences;
  let occurrencesInitialized = false;
  let disposed = false;
  let publishing = false;
  let publishPending = false;
  let batchDepth = 0;
  let dirty = false;
  const subscribers = new Set<GanttRuntimeSubscriber>();

  let snapshot: GanttRuntimeSnapshot = Object.freeze({
    document: initialDocument.document,
    history: Object.freeze({
      canRedo: false,
      canUndo: false,
      capacity: historyCapacity(options.historyCapacity),
      invalidationVersion: 0,
    }),
    interaction: IDLE_INTERACTION,
    ownership: Object.freeze({
      document: documentMode,
      lastDocumentReconciliation: 'unchanged',
      session: sessionMode,
    }),
    session: sourceSession,
    version: 0,
  });

  function assertActive(): void {
    if (disposed) {
      throw new Error('The Gantt runtime store has been disposed.');
    }
  }

  function publish(): void {
    if (batchDepth > 0) {
      dirty = true;
      return;
    }
    if (publishing) {
      publishPending = true;
      return;
    }
    let firstError: unknown;
    let hasError = false;
    do {
      publishPending = false;
      publishing = true;
      for (const subscriber of Array.from(subscribers)) {
        if (subscribers.has(subscriber)) {
          try {
            subscriber();
          } catch (error) {
            // Complete the snapshot publication so one host callback cannot starve peers.
            if (!hasError) {
              firstError = error;
              hasError = true;
            }
          }
        }
      }
      publishing = false;
    } while (publishPending);
    if (hasError) {
      throw firstError;
    }
  }

  function replaceSnapshot(changes: Partial<Omit<GanttRuntimeSnapshot, 'version'>>): void {
    snapshot = Object.freeze({
      ...snapshot,
      ...changes,
      version: snapshot.version + 1,
    });
    publish();
  }

  function invalidateHistory(history: GanttRuntimeHistoryMetadata): GanttRuntimeHistoryMetadata {
    return Object.freeze({
      canRedo: false,
      canUndo: false,
      capacity: history.capacity,
      invalidationVersion: history.invalidationVersion + 1,
      lastInvalidation: 'external-content',
    });
  }

  function ownershipWith(
    changes: Partial<GanttRuntimeOwnershipState>,
    clear: {
      readonly pendingDocument?: boolean;
      readonly pendingSession?: boolean;
    } = {},
  ): GanttRuntimeOwnershipState {
    const ownership = { ...snapshot.ownership, ...changes };
    if (clear.pendingDocument === true) {
      delete ownership.pendingDocument;
    }
    if (clear.pendingSession === true) {
      delete ownership.pendingSession;
    }
    return Object.freeze(ownership);
  }

  function effectiveSession(): {
    readonly pendingSession?: GanttSessionState;
    readonly session: GanttSessionState;
  } {
    if (!occurrencesInitialized) {
      return Object.freeze({ session: sourceSession });
    }
    const session = reconcileSessionOccurrences(
      sourceSession,
      previousOccurrences,
      currentOccurrences,
    );
    if (sessionMode === 'controlled' && !sessionEqual(sourceSession, session)) {
      return Object.freeze({ pendingSession: session, session });
    }
    return Object.freeze({ session });
  }

  function publishSessionIfChanged(): void {
    const effective = effectiveSession();
    if (sessionMode === 'uncontrolled') {
      sourceSession = effective.session;
    }
    const currentPending = snapshot.ownership.pendingSession;
    const nextPending = effective.pendingSession;
    if (
      sessionEqual(snapshot.session, effective.session) &&
      pendingSessionEqual(currentPending, nextPending)
    ) {
      return;
    }
    replaceSnapshot({
      ownership:
        nextPending === undefined
          ? ownershipWith({}, { pendingSession: true })
          : ownershipWith({ pendingSession: nextPending }),
      session: effective.session,
    });
  }

  const store: GanttRuntimeStore = {
    adoptUncontrolledDocument(document) {
      assertActive();
      if (documentMode !== 'uncontrolled') {
        throw new Error('Controlled document state cannot be adopted internally.');
      }
      const next = cloneCanonicalDocument(document);
      if (next.serialization === documentSerialization) {
        return false;
      }
      documentSerialization = next.serialization;
      documentContentSerialization = next.contentSerialization;
      replaceSnapshot({ document: next.document });
      return true;
    },

    batch<T>(operation: () => T): T {
      assertActive();
      batchDepth += 1;
      try {
        return operation();
      } finally {
        batchDepth -= 1;
        if (batchDepth === 0 && dirty) {
          dirty = false;
          publish();
        }
      }
    },

    captureDocument(): GanttRuntimeDocumentCapture {
      return Object.freeze({
        document: snapshot.document,
        serialization: documentSerialization,
      });
    },

    clearControlledDocumentProposal(proposalId) {
      assertActive();
      const pending = snapshot.ownership.pendingDocument;
      if (pending === undefined || pending.proposalId !== proposalId) {
        return false;
      }
      replaceSnapshot({
        interaction: IDLE_INTERACTION,
        ownership: ownershipWith({}, { pendingDocument: true }),
      });
      return true;
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      subscribers.clear();
    },

    getSnapshot() {
      return snapshot;
    },

    isDisposed() {
      return disposed;
    },

    setHistoryCapabilities(canUndo, canRedo) {
      assertActive();
      if (snapshot.history.canUndo === canUndo && snapshot.history.canRedo === canRedo) {
        return;
      }
      replaceSnapshot({
        history: Object.freeze({ ...snapshot.history, canRedo, canUndo }),
      });
    },

    setOccurrences(occurrences) {
      assertActive();
      const next = normalizeOccurrences(occurrences);
      previousOccurrences = currentOccurrences;
      currentOccurrences = next;
      occurrencesInitialized = true;
      publishSessionIfChanged();
    },

    stageControlledDocumentProposal(
      input: StageControlledDocumentProposalInput,
    ): StageControlledDocumentProposalResult {
      assertActive();
      if (documentMode !== 'controlled') {
        throw new Error('Only controlled document state stages acknowledgement proposals.');
      }
      if (snapshot.ownership.pendingDocument !== undefined) {
        return Object.freeze({ status: 'pending-proposal' });
      }
      if (input.baseSerialization !== documentSerialization) {
        return Object.freeze({ status: 'stale-base' });
      }
      if (typeof input.proposalId !== 'string' || input.proposalId.length === 0) {
        throw new TypeError('A controlled proposal ID must be a non-empty string.');
      }
      const candidate = cloneCanonicalDocument(input.candidate);
      if (candidate.serialization === documentSerialization) {
        return Object.freeze({ status: 'no-op' });
      }
      const pending = Object.freeze({
        baseSerialization: input.baseSerialization,
        candidate: candidate.document,
        candidateSerialization: candidate.serialization,
        proposalId: input.proposalId,
      });
      replaceSnapshot({
        interaction: Object.freeze({
          proposalId: input.proposalId,
          status: 'document-proposal-pending',
        }),
        ownership: ownershipWith({ pendingDocument: pending }),
      });
      return Object.freeze({ status: 'staged' });
    },

    subscribe(subscriber) {
      assertActive();
      subscribers.add(subscriber);
      let subscribed = true;
      return () => {
        if (!subscribed) {
          return;
        }
        subscribed = false;
        subscribers.delete(subscriber);
      };
    },

    updateControlledDocument(document): UpdateControlledDocumentResult {
      assertActive();
      if (documentMode !== 'controlled') {
        throw new Error('Uncontrolled document state cannot receive controlled replacement.');
      }
      const next = cloneCanonicalDocument(document);
      const pending = snapshot.ownership.pendingDocument;
      if (pending !== undefined && next.serialization === documentSerialization) {
        return Object.freeze({ status: 'unchanged' });
      }
      if (pending !== undefined && next.serialization === pending.candidateSerialization) {
        documentSerialization = next.serialization;
        documentContentSerialization = next.contentSerialization;
        replaceSnapshot({
          document: next.document,
          interaction: IDLE_INTERACTION,
          ownership: ownershipWith(
            { lastDocumentReconciliation: 'acknowledged' },
            { pendingDocument: true },
          ),
        });
        return Object.freeze({ proposalId: pending.proposalId, status: 'acknowledged' });
      }
      if (pending !== undefined) {
        const history =
          next.contentSerialization === documentContentSerialization
            ? snapshot.history
            : invalidateHistory(snapshot.history);
        documentSerialization = next.serialization;
        documentContentSerialization = next.contentSerialization;
        replaceSnapshot({
          document: next.document,
          history,
          interaction: IDLE_INTERACTION,
          ownership: ownershipWith(
            { lastDocumentReconciliation: 'diverged' },
            { pendingDocument: true },
          ),
        });
        return Object.freeze({ proposalId: pending.proposalId, status: 'diverged' });
      }
      if (next.serialization === documentSerialization) {
        return Object.freeze({ status: 'unchanged' });
      }
      if (next.contentSerialization === documentContentSerialization) {
        documentSerialization = next.serialization;
        documentContentSerialization = next.contentSerialization;
        replaceSnapshot({
          document: next.document,
          ownership: ownershipWith({ lastDocumentReconciliation: 'revision-only' }),
        });
        return Object.freeze({ status: 'revision-only' });
      }

      documentSerialization = next.serialization;
      documentContentSerialization = next.contentSerialization;
      replaceSnapshot({
        document: next.document,
        history: invalidateHistory(snapshot.history),
        ownership: ownershipWith({ lastDocumentReconciliation: 'external-content' }),
      });
      return Object.freeze({ status: 'external-content' });
    },

    updateControlledSession(session) {
      assertActive();
      if (sessionMode !== 'controlled') {
        throw new Error('Uncontrolled session state cannot receive controlled replacement.');
      }
      sourceSession = normalizeSessionState(session);
      publishSessionIfChanged();
    },

    updateUncontrolledSession(session) {
      assertActive();
      if (sessionMode !== 'uncontrolled') {
        throw new Error('Controlled session state cannot be updated internally.');
      }
      sourceSession = normalizeSessionState(session);
      publishSessionIfChanged();
    },
  };

  return Object.freeze(store);
}

export function subscribeGanttRuntimeSelector<T>(
  store: GanttRuntimeStore,
  selector: GanttRuntimeSelector<T>,
  subscriber: GanttRuntimeSelectorSubscriber<T>,
  isEqual: GanttRuntimeEquality<T> = Object.is,
): () => void {
  let selected = selector(store.getSnapshot());
  return store.subscribe(() => {
    const next = selector(store.getSnapshot());
    if (isEqual(selected, next)) {
      return;
    }
    const previous = selected;
    selected = next;
    subscriber(next, previous);
  });
}

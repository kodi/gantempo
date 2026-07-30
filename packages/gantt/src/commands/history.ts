import type { Diagnostic } from '../model/diagnostics';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { applyGanttPatches } from './patches';
import type { CommandOutcome, EntityReference, GanttPatch } from './types';

export interface GanttHistoryEntry {
  readonly affected: readonly EntityReference[];
  readonly inversePatches: readonly GanttPatch[];
  readonly patches: readonly GanttPatch[];
}

export interface GanttHistoryState {
  readonly capacity: number;
  readonly document: GanttDocument;
  readonly future: readonly GanttHistoryEntry[];
  readonly past: readonly GanttHistoryEntry[];
}

export type HistoryOperationResult =
  | {
      readonly diagnostics: readonly [];
      readonly history: GanttHistoryState;
      readonly status: 'applied';
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly history: GanttHistoryState;
      readonly status: 'rejected';
    };

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const EMPTY_ENTRIES = Object.freeze([]) as readonly [];

function applied(history: GanttHistoryState): HistoryOperationResult {
  return Object.freeze({
    diagnostics: EMPTY_DIAGNOSTICS,
    history,
    status: 'applied',
  });
}

function rejected(
  history: GanttHistoryState,
  diagnostics: readonly Diagnostic[],
): HistoryOperationResult {
  return Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    history,
    status: 'rejected',
  });
}

function freezeReference(reference: EntityReference): EntityReference {
  return Object.freeze({ collection: reference.collection, id: reference.id });
}

function createEntry(outcome: Extract<CommandOutcome, { readonly status: 'committed' }>) {
  return Object.freeze({
    affected: Object.freeze(outcome.affected.map(freezeReference)),
    inversePatches: Object.freeze([...outcome.inversePatches]),
    patches: Object.freeze([...outcome.patches]),
  });
}

function createState(
  document: GanttDocument,
  capacity: number,
  past: readonly GanttHistoryEntry[],
  future: readonly GanttHistoryEntry[],
): GanttHistoryState {
  return Object.freeze({
    capacity,
    document,
    future: Object.freeze([...future]),
    past: Object.freeze([...past]),
  });
}

export function createGanttHistory(document: GanttDocument, capacity: number): GanttHistoryState {
  if (!Number.isFinite(capacity) || !Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError('History capacity must be a positive finite integer.');
  }
  return createState(document, capacity, EMPTY_ENTRIES, EMPTY_ENTRIES);
}

export function commitGanttHistory(
  history: GanttHistoryState,
  outcome: CommandOutcome,
): HistoryOperationResult {
  if (outcome.status === 'rejected' || outcome.patches.length === 0) {
    return applied(history);
  }
  const replay = applyGanttPatches(history.document, outcome.patches);
  if (replay.status === 'rejected') {
    return rejected(history, replay.diagnostics);
  }
  if (serializeGanttDocument(replay.document) !== serializeGanttDocument(outcome.document)) {
    return rejected(history, [
      Object.freeze({
        code: 'history.stale-outcome',
        message: 'The committed outcome does not descend from the history present document.',
        path: '/history/document',
        severity: 'error',
      }),
    ]);
  }

  const past = [...history.past, createEntry(outcome)].slice(-history.capacity);
  return applied(createState(outcome.document, history.capacity, past, EMPTY_ENTRIES));
}

export function undoGanttHistory(history: GanttHistoryState): HistoryOperationResult {
  const entry = history.past.at(-1);
  if (!entry) {
    return applied(history);
  }
  const result = applyGanttPatches(history.document, entry.inversePatches);
  if (result.status === 'rejected') {
    return rejected(history, result.diagnostics);
  }
  return applied(
    createState(result.document, history.capacity, history.past.slice(0, -1), [
      ...history.future,
      entry,
    ]),
  );
}

export function redoGanttHistory(history: GanttHistoryState): HistoryOperationResult {
  const entry = history.future.at(-1);
  if (!entry) {
    return applied(history);
  }
  const result = applyGanttPatches(history.document, entry.patches);
  if (result.status === 'rejected') {
    return rejected(history, result.diagnostics);
  }
  return applied(
    createState(
      result.document,
      history.capacity,
      [...history.past, entry].slice(-history.capacity),
      history.future.slice(0, -1),
    ),
  );
}

export function clearGanttHistory(history: GanttHistoryState): GanttHistoryState {
  if (history.past.length === 0 && history.future.length === 0) {
    return history;
  }
  return createState(history.document, history.capacity, EMPTY_ENTRIES, EMPTY_ENTRIES);
}

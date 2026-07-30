import {
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
  type GanttHistoryState,
} from '../commands/history';
import type { CommandOutcome } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { GanttDocument } from '../model/types';
import type { GanttDocumentChange } from './types';

export interface GanttRuntimeHistoryDescriptor {
  readonly change: GanttDocumentChange;
}

export interface GanttRuntimeHistoryState {
  readonly future: readonly GanttRuntimeHistoryDescriptor[];
  readonly kernel: GanttHistoryState;
  readonly past: readonly GanttRuntimeHistoryDescriptor[];
}

export type GanttRuntimeHistoryCommitResult =
  | {
      readonly history: GanttRuntimeHistoryState;
      readonly status: 'committed';
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly status: 'rejected';
    };

export type GanttRuntimeHistoryOperationResult =
  | {
      readonly descriptor: GanttRuntimeHistoryDescriptor;
      readonly document: GanttDocument;
      readonly history: GanttRuntimeHistoryState;
      readonly status: 'applied';
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly status: 'rejected';
    }
  | {
      readonly status: 'empty';
    };

const EMPTY_DESCRIPTORS = Object.freeze([]) as readonly GanttRuntimeHistoryDescriptor[];

function createState(
  kernel: GanttHistoryState,
  past: readonly GanttRuntimeHistoryDescriptor[],
  future: readonly GanttRuntimeHistoryDescriptor[],
): GanttRuntimeHistoryState {
  return Object.freeze({
    future: Object.freeze([...future]),
    kernel,
    past: Object.freeze([...past]),
  });
}

export function createGanttRuntimeHistory(
  document: GanttDocument,
  capacity: number,
): GanttRuntimeHistoryState | undefined {
  if (capacity === 0) {
    return undefined;
  }
  return createState(createGanttHistory(document, capacity), EMPTY_DESCRIPTORS, EMPTY_DESCRIPTORS);
}

export function commitGanttRuntimeHistory(
  history: GanttRuntimeHistoryState,
  outcome: Extract<CommandOutcome, { readonly status: 'committed' }>,
  change: GanttDocumentChange,
): GanttRuntimeHistoryCommitResult {
  const committed = commitGanttHistory(history.kernel, outcome);
  if (committed.status === 'rejected') {
    return Object.freeze({
      diagnostics: committed.diagnostics,
      status: 'rejected',
    });
  }
  if (outcome.patches.length === 0) {
    return Object.freeze({ history, status: 'committed' });
  }
  const descriptor = Object.freeze({ change });
  return Object.freeze({
    history: createState(
      committed.history,
      [...history.past, descriptor].slice(-history.kernel.capacity),
      EMPTY_DESCRIPTORS,
    ),
    status: 'committed',
  });
}

export function undoGanttRuntimeHistory(
  history: GanttRuntimeHistoryState | undefined,
): GanttRuntimeHistoryOperationResult {
  const descriptor = history?.past.at(-1);
  if (history === undefined || descriptor === undefined) {
    return Object.freeze({ status: 'empty' });
  }
  const undone = undoGanttHistory(history.kernel);
  if (undone.status === 'rejected') {
    return Object.freeze({
      diagnostics: undone.diagnostics,
      status: 'rejected',
    });
  }
  return Object.freeze({
    descriptor,
    document: undone.history.document,
    history: createState(undone.history, history.past.slice(0, -1), [
      ...history.future,
      descriptor,
    ]),
    status: 'applied',
  });
}

export function redoGanttRuntimeHistory(
  history: GanttRuntimeHistoryState | undefined,
): GanttRuntimeHistoryOperationResult {
  const descriptor = history?.future.at(-1);
  if (history === undefined || descriptor === undefined) {
    return Object.freeze({ status: 'empty' });
  }
  const redone = redoGanttHistory(history.kernel);
  if (redone.status === 'rejected') {
    return Object.freeze({
      diagnostics: redone.diagnostics,
      status: 'rejected',
    });
  }
  return Object.freeze({
    descriptor,
    document: redone.history.document,
    history: createState(
      redone.history,
      [...history.past, descriptor].slice(-history.kernel.capacity),
      history.future.slice(0, -1),
    ),
    status: 'applied',
  });
}

export function rebaseGanttRuntimeHistory(
  history: GanttRuntimeHistoryState | undefined,
  document: GanttDocument,
): GanttRuntimeHistoryState | undefined {
  if (history === undefined) {
    return undefined;
  }
  const kernel = Object.freeze({ ...history.kernel, document });
  return createState(kernel, history.past, history.future);
}

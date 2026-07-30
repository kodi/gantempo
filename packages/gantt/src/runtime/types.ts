import type { Diagnostic } from '../model/diagnostics';
import type { GanttDocument } from '../model/types';
import type { EntityReference, GanttCommand, GanttPatch } from '../commands/types';

export interface GanttLaneTarget {
  readonly kind: 'lane';
  readonly laneId?: string;
  readonly resourceId?: string;
  readonly viewKey: string;
}

export interface GanttTaskTarget {
  readonly assignmentId?: string;
  readonly kind: 'task';
  readonly laneId?: string;
  readonly laneViewKey: string;
  readonly placementId?: string;
  readonly resourceId?: string;
  readonly segmentId?: string;
  readonly taskId: string;
  readonly viewKey: string;
}

export type GanttInteractionTarget = GanttLaneTarget | GanttTaskTarget;

export interface GanttViewportIntent {
  readonly verticalStart: number;
}

export interface GanttSessionState {
  readonly focused?: GanttInteractionTarget;
  readonly selection: readonly GanttInteractionTarget[];
  readonly viewport: GanttViewportIntent;
}

export interface GanttRuntimeOccurrence {
  readonly horizontalCenter: number;
  readonly laneIndex: number;
  readonly target: GanttInteractionTarget;
}

export type GanttRuntimeDocumentInput =
  | {
      readonly kind: 'controlled';
      readonly value: GanttDocument;
    }
  | {
      readonly kind: 'uncontrolled';
      readonly value: GanttDocument;
    };

export type GanttRuntimeSessionInput =
  | {
      readonly kind: 'controlled';
      readonly value: GanttSessionState;
    }
  | {
      readonly kind: 'uncontrolled';
      readonly value?: Partial<GanttSessionState>;
    };

export interface CreateGanttRuntimeStoreOptions {
  readonly document: GanttRuntimeDocumentInput;
  readonly historyCapacity?: number;
  readonly session?: GanttRuntimeSessionInput;
}

export interface GanttRuntimePendingDocumentProposal {
  readonly baseSerialization: string;
  readonly candidate: GanttDocument;
  readonly candidateSerialization: string;
  readonly proposalId: string;
}

export type GanttRuntimeDocumentReconciliation =
  | 'acknowledged'
  | 'diverged'
  | 'external-content'
  | 'revision-only'
  | 'unchanged';

export interface GanttRuntimeOwnershipState {
  readonly document: 'controlled' | 'uncontrolled';
  readonly lastDocumentReconciliation: GanttRuntimeDocumentReconciliation;
  readonly pendingDocument?: GanttRuntimePendingDocumentProposal;
  readonly pendingSession?: GanttSessionState;
  readonly session: 'controlled' | 'uncontrolled';
}

export type GanttRuntimeInteractionState =
  | {
      readonly status: 'idle';
    }
  | {
      readonly proposalId: string;
      readonly status: 'document-proposal-pending';
    };

export interface GanttRuntimeHistoryMetadata {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly capacity: number;
  readonly invalidationVersion: number;
  readonly lastInvalidation?: 'external-content';
}

export interface GanttRuntimeSnapshot {
  readonly document: GanttDocument;
  readonly history: GanttRuntimeHistoryMetadata;
  readonly interaction: GanttRuntimeInteractionState;
  readonly ownership: GanttRuntimeOwnershipState;
  readonly session: GanttSessionState;
  readonly version: number;
}

export interface GanttRuntimeDocumentCapture {
  readonly document: GanttDocument;
  readonly serialization: string;
}

export type StageControlledDocumentProposalResult =
  | { readonly status: 'no-op' }
  | { readonly status: 'pending-proposal' }
  | { readonly status: 'staged' }
  | { readonly status: 'stale-base' };

export type UpdateControlledDocumentResult =
  | { readonly status: 'acknowledged'; readonly proposalId: string }
  | { readonly status: 'diverged'; readonly proposalId: string }
  | { readonly status: 'external-content' }
  | { readonly status: 'revision-only' }
  | { readonly status: 'unchanged' };

export interface StageControlledDocumentProposalInput {
  readonly baseSerialization: string;
  readonly candidate: GanttDocument;
  readonly proposalId: string;
}

export type GanttRuntimeSubscriber = () => void;
export type GanttRuntimeSelector<T> = (snapshot: GanttRuntimeSnapshot) => T;
export type GanttRuntimeEquality<T> = (previous: T, next: T) => boolean;
export type GanttRuntimeSelectorSubscriber<T> = (next: T, previous: T) => void;

export interface GanttRuntimeStore {
  adoptUncontrolledDocument(document: GanttDocument): boolean;
  batch<T>(operation: () => T): T;
  captureDocument(): GanttRuntimeDocumentCapture;
  clearControlledDocumentProposal(proposalId: string): boolean;
  dispose(): void;
  getSnapshot(): GanttRuntimeSnapshot;
  isDisposed(): boolean;
  setHistoryCapabilities(canUndo: boolean, canRedo: boolean): void;
  setOccurrences(occurrences: readonly GanttRuntimeOccurrence[]): void;
  stageControlledDocumentProposal(
    input: StageControlledDocumentProposalInput,
  ): StageControlledDocumentProposalResult;
  subscribe(subscriber: GanttRuntimeSubscriber): () => void;
  updateControlledDocument(document: GanttDocument): UpdateControlledDocumentResult;
  updateControlledSession(session: GanttSessionState): void;
  updateUncontrolledSession(session: GanttSessionState): void;
}

export type GanttCommandSource =
  | { readonly kind: 'imperative' }
  | {
      readonly kind: 'pointer';
      readonly pointerType: 'mouse' | 'pen' | 'touch';
    }
  | { readonly kind: 'keyboard' }
  | { readonly kind: 'toolbar' }
  | { readonly kind: 'context-menu' }
  | { readonly kind: 'editor' }
  | { readonly action: 'redo' | 'undo'; readonly kind: 'history' };

export interface GanttCommandProposal {
  readonly command: GanttCommand;
  readonly document: GanttDocument;
  readonly proposalId: string;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
}

export type GanttCommandInterception =
  | { readonly kind: 'allow' }
  | { readonly diagnostic: Diagnostic; readonly kind: 'reject' }
  | { readonly command: GanttCommand; readonly kind: 'replace' };

export type GanttCommandInterceptor = (
  proposal: GanttCommandProposal,
) => GanttCommandInterception | Promise<GanttCommandInterception>;

export interface GanttCommandCancellation {
  readonly aborted: boolean;
  subscribe(subscriber: () => void): () => void;
}

export interface GanttDispatchOptions {
  readonly cancellation?: GanttCommandCancellation;
  readonly source?: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
}

export interface GanttDocumentChange {
  readonly affected: readonly EntityReference[];
  readonly baseRevision?: number | string;
  readonly command: GanttCommand;
  readonly diagnostics: readonly Diagnostic[];
  readonly document: GanttDocument;
  readonly inversePatches: readonly GanttPatch[];
  readonly operation: 'dispatch' | 'redo' | 'undo';
  readonly originalCommand: GanttCommand;
  readonly patches: readonly GanttPatch[];
  readonly proposalId: string;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
}

export interface GanttCommandCommittedEvent {
  readonly change?: GanttDocumentChange;
  readonly command?: GanttCommand;
  readonly operation: 'dispatch' | 'redo' | 'undo';
  readonly originalCommand?: GanttCommand;
  readonly proposalId: string;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
  readonly type: 'commandCommitted';
}

export interface GanttCommandRejectedEvent {
  readonly command?: GanttCommand;
  readonly diagnostics: readonly Diagnostic[];
  readonly operation: 'dispatch' | 'redo' | 'undo';
  readonly originalCommand?: GanttCommand;
  readonly proposalId: string;
  readonly source: GanttCommandSource;
  readonly target?: GanttInteractionTarget;
  readonly type: 'commandRejected';
}

export interface GanttRuntimeErrorEvent {
  readonly callback:
    | 'onCommandCommitted'
    | 'onCommandRejected'
    | 'onDocumentChange'
    | 'onRuntimeError';
  readonly diagnostic: Diagnostic;
  readonly type: 'runtimeError';
}

export type GanttDispatchResult =
  | {
      readonly change?: GanttDocumentChange;
      readonly proposalId: string;
      readonly status: 'committed';
    }
  | {
      readonly change: GanttDocumentChange;
      readonly proposalId: string;
      readonly status: 'proposed';
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly proposalId: string;
      readonly status: 'rejected';
    };

export interface CreateGanttCommandBusOptions {
  readonly interceptors?: readonly GanttCommandInterceptor[];
  readonly onCommandCommitted?: (event: GanttCommandCommittedEvent) => void;
  readonly onCommandRejected?: (event: GanttCommandRejectedEvent) => void;
  readonly onDocumentChange?: (change: GanttDocumentChange) => void;
  readonly onRuntimeError?: (event: GanttRuntimeErrorEvent) => void;
  readonly reportHostError?: (error: unknown) => void;
  readonly store: GanttRuntimeStore;
}

export interface GanttCommandBus {
  dispatch(command: GanttCommand, options?: GanttDispatchOptions): Promise<GanttDispatchResult>;
  dispose(): void;
  isDisposed(): boolean;
  redo(options?: Omit<GanttDispatchOptions, 'source'>): Promise<GanttDispatchResult>;
  undo(options?: Omit<GanttDispatchOptions, 'source'>): Promise<GanttDispatchResult>;
  updateControlledDocument(document: GanttDocument): UpdateControlledDocumentResult;
}

export interface GanttCommandCancellationController {
  abort(): void;
  readonly signal: GanttCommandCancellation;
}

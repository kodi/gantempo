import type { Diagnostic } from '../model/diagnostics';
import type { GanttDocument } from '../model/types';
import type {
  DocumentCollection,
  DomainRecordByCollection,
  EntityReference,
  GanttCommand,
  GanttPatch,
} from '../commands/types';

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

export interface GanttViewportRetainedRange {
  readonly end: number;
  readonly start: number;
}

export interface GanttViewportMeasurement {
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly retainedRange?: GanttViewportRetainedRange;
  readonly verticalStart: number;
}

export interface GanttMeasuredViewportState {
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly overscanAfter: number;
  readonly overscanBefore: number;
  readonly queryVerticalExtent: number;
  readonly queryVerticalStart: number;
  readonly status: 'measured' | 'unmeasured';
  readonly verticalStart: number;
}

export type GanttRuntimeUpdateScheduler = (update: () => void) => (() => void) | undefined | void;

export interface GanttRuntimeViewportOptions {
  readonly overscanAfter?: number;
  readonly overscanBefore?: number;
  readonly schedule?: GanttRuntimeUpdateScheduler;
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
  readonly viewport?: GanttRuntimeViewportOptions;
}

export interface GanttRuntimePendingDocumentProposal {
  readonly affected?: readonly EntityReference[];
  readonly baseSerialization: string;
  readonly candidate: GanttDocument;
  readonly candidateSerialization: string;
  readonly proposalId: string;
}

export type GanttRuntimeDerivationState =
  | {
      readonly affected: readonly EntityReference[];
      readonly kind: 'affected';
      readonly version: number;
    }
  | {
      readonly kind: 'external';
      readonly version: number;
    };

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
  readonly derivation: GanttRuntimeDerivationState;
  readonly document: GanttDocument;
  readonly history: GanttRuntimeHistoryMetadata;
  readonly interaction: GanttRuntimeInteractionState;
  readonly ownership: GanttRuntimeOwnershipState;
  readonly session: GanttSessionState;
  readonly version: number;
  readonly viewport: GanttMeasuredViewportState;
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
  readonly affected?: readonly EntityReference[];
  readonly baseSerialization: string;
  readonly candidate: GanttDocument;
  readonly proposalId: string;
}

export type GanttRuntimeSubscriber = () => void;
export type GanttRuntimeSelector<T> = (snapshot: GanttRuntimeSnapshot) => T;
export type GanttRuntimeEquality<T> = (previous: T, next: T) => boolean;
export type GanttRuntimeSelectorSubscriber<T> = (next: T, previous: T) => void;

export interface GanttRuntimeStore {
  adoptUncontrolledDocument(
    document: GanttDocument,
    affected?: readonly EntityReference[],
  ): boolean;
  batch<T>(operation: () => T): T;
  captureDocument(): GanttRuntimeDocumentCapture;
  clearViewportMeasurement(): boolean;
  clearControlledDocumentProposal(proposalId: string): boolean;
  dispose(): void;
  flushViewportMeasurement(): boolean;
  getSnapshot(): GanttRuntimeSnapshot;
  isDisposed(): boolean;
  scheduleViewportMeasurement(measurement: GanttViewportMeasurement): void;
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

export type GanttEntityCreateChange = {
  readonly [C in DocumentCollection]: {
    readonly after: DomainRecordByCollection[C];
    readonly collection: C;
    readonly id: DomainRecordByCollection[C]['id'];
    readonly kind: 'create';
  };
}[DocumentCollection];

export type GanttEntityUpdateChange = {
  readonly [C in DocumentCollection]: {
    readonly after: DomainRecordByCollection[C];
    readonly before: DomainRecordByCollection[C];
    readonly collection: C;
    readonly id: DomainRecordByCollection[C]['id'];
    readonly kind: 'update';
  };
}[DocumentCollection];

export type GanttEntityDeleteChange = {
  readonly [C in DocumentCollection]: {
    readonly before: DomainRecordByCollection[C];
    readonly collection: C;
    readonly id: DomainRecordByCollection[C]['id'];
    readonly kind: 'delete';
  };
}[DocumentCollection];

export type GanttEntityChange =
  | GanttEntityCreateChange
  | GanttEntityDeleteChange
  | GanttEntityUpdateChange;

export interface GanttDocumentChange {
  readonly affected: readonly EntityReference[];
  readonly baseRevision?: number | string;
  readonly command: GanttCommand;
  readonly diagnostics: readonly Diagnostic[];
  readonly document: GanttDocument;
  readonly entityChanges: readonly GanttEntityChange[];
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
    | 'onFocusChange'
    | 'onRangeChange'
    | 'onRuntimeError'
    | 'onSelectionChange'
    | 'onSessionChange'
    | 'onTaskActivate'
    | 'onViewportChange';
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
  readonly canProposeControlledDocument?: () => boolean;
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
  updateInterceptors(interceptors: readonly GanttCommandInterceptor[]): void;
}

export interface GanttCommandCancellationController {
  abort(): void;
  readonly signal: GanttCommandCancellation;
}

import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { EntityId, EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import type {
  InteractionCommandMappingResult,
  InteractionCreateTaskMapperIntent,
  InteractionMoveOccurrenceMapperIntent,
  InteractionPointerType,
  InteractionPreviewPrimitive,
  InteractionSnapPolicy,
} from '../interaction/types';
import type { GanttViewDefinition } from '../view/types';
import type {
  GanttCommandCommittedEvent,
  GanttCommandInterceptor,
  GanttCommandRejectedEvent,
  GanttDispatchOptions,
  GanttDispatchResult,
  GanttInteractionTarget,
  GanttMeasuredViewportState,
  GanttRuntimeErrorEvent,
  GanttSessionState,
  GanttTaskTarget,
} from '../runtime/types';

export interface GanttSemanticEvent {
  readonly source: 'controlled-prop' | 'imperative' | 'runtime';
}

export interface GanttViewportChange {
  readonly range: TimeRange;
  readonly session: GanttSessionState['viewport'];
  readonly measured: GanttMeasuredViewportState;
}

export interface GanttScrollOptions {
  readonly align?: 'center' | 'end' | 'start';
}

export interface GanttVisibleOccurrence {
  readonly end: EpochMilliseconds;
  readonly start: EpochMilliseconds;
  readonly target: GanttTaskTarget;
}

export type GanttCommandMappingResult = InteractionCommandMappingResult;
export type GanttCreateTaskIntent = InteractionCreateTaskMapperIntent;
export type GanttMoveOccurrenceIntent = InteractionMoveOccurrenceMapperIntent;
export type GanttInteractionSnapPolicy = InteractionSnapPolicy;

export interface GanttInteractionCommandMappers {
  readonly createTask?: (intent: GanttCreateTaskIntent) => GanttCommandMappingResult;
  readonly moveOccurrence?: (intent: GanttMoveOccurrenceIntent) => GanttCommandMappingResult;
}

export interface GanttInteractionPreview {
  readonly description: string;
  readonly destination: Extract<GanttInteractionTarget, { readonly kind: 'lane' }>;
  readonly end: EpochMilliseconds;
  readonly height: number;
  readonly kind: InteractionPreviewPrimitive['kind'];
  readonly source?: GanttTaskTarget;
  readonly start: EpochMilliseconds;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export type GanttInteractionAction = 'create' | 'delete' | 'move' | 'redo' | 'resize' | 'undo';

export type GanttInteractionState =
  | {
      readonly announcement?: string;
      readonly status: 'idle';
    }
  | {
      readonly edge?: 'end' | 'start';
      readonly pointerType: InteractionPointerType;
      readonly status: 'pressing';
      readonly target?: GanttInteractionTarget;
    }
  | {
      readonly pointerType: InteractionPointerType;
      readonly preview: GanttInteractionPreview;
      readonly status: 'creating' | 'dragging' | 'resizing';
      readonly target?: GanttInteractionTarget;
    }
  | {
      readonly action: 'move' | 'resize';
      readonly announcement: string;
      readonly mode: 'move' | 'resize-end' | 'resize-start';
      readonly preview: GanttInteractionPreview;
      readonly status: 'keyboard';
      readonly target: GanttTaskTarget;
    }
  | {
      readonly action?: GanttInteractionAction;
      readonly pointerType?: InteractionPointerType;
      readonly preview?: GanttInteractionPreview;
      readonly proposalId?: string;
      readonly status: 'pending';
      readonly target?: GanttInteractionTarget;
    }
  | {
      readonly announcement: string;
      readonly status: 'rejected';
      readonly target?: GanttInteractionTarget;
    };

export interface GanttSelectorSnapshot {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly document: GanttDocument;
  readonly interaction: GanttInteractionState;
  readonly occurrences: readonly GanttVisibleOccurrence[];
  readonly range: TimeRange;
  readonly session: GanttSessionState;
  readonly viewport: GanttMeasuredViewportState;
}

export interface GanttHandle {
  canRedo(): boolean;
  canUndo(): boolean;
  dispatch(command: GanttCommand, options?: GanttDispatchOptions): Promise<GanttDispatchResult>;
  focusTask(target: GanttTaskTarget): boolean;
  getDocument(): GanttDocument;
  getSelection(): readonly GanttInteractionTarget[];
  getSession(): GanttSessionState;
  redo(): Promise<GanttDispatchResult>;
  scrollToTask(target: GanttTaskTarget, options?: GanttScrollOptions): boolean;
  scrollToTime(time: EpochMilliseconds, options?: GanttScrollOptions): boolean;
  undo(): Promise<GanttDispatchResult>;
}

interface GanttBaseProps {
  readonly className?: string;
  readonly historyCapacity?: number;
  readonly interceptors?: readonly GanttCommandInterceptor[];
  readonly interactionCreationDuration?: number;
  readonly interactionMappers?: GanttInteractionCommandMappers;
  readonly interactionSnap?: GanttInteractionSnapPolicy;
  readonly label?: string;
  readonly locale?: string;
  readonly onCommandCommitted?: (event: GanttCommandCommittedEvent) => void;
  readonly onCommandRejected?: (event: GanttCommandRejectedEvent) => void;
  readonly onDiagnostics?: (diagnostics: readonly Diagnostic[]) => void;
  readonly onFocusChange?: (
    focused: GanttInteractionTarget | undefined,
    event: GanttSemanticEvent,
  ) => void;
  readonly onRangeChange?: (range: TimeRange, event: GanttSemanticEvent) => void;
  readonly onRuntimeError?: (event: GanttRuntimeErrorEvent) => void;
  readonly onSelectionChange?: (
    selection: readonly GanttInteractionTarget[],
    event: GanttSemanticEvent,
  ) => void;
  readonly onSessionChange?: (session: GanttSessionState, event: GanttSemanticEvent) => void;
  readonly onTaskActivate?: (target: GanttTaskTarget, event: GanttSemanticEvent) => void;
  readonly onViewportChange?: (viewport: GanttViewportChange, event: GanttSemanticEvent) => void;
  readonly range: TimeRange;
  readonly taskVariants?: Readonly<Record<EntityId, string>>;
  readonly tickAnchor: EpochMilliseconds;
  readonly tickInterval: number;
  readonly timeZone: string;
  readonly view?: GanttViewDefinition;
}

type GanttDocumentOwnership =
  | {
      readonly defaultDocument?: never;
      readonly document: GanttDocument;
      readonly onDocumentChange?: (change: import('../runtime/types').GanttDocumentChange) => void;
    }
  | {
      readonly defaultDocument: GanttDocument;
      readonly document?: never;
      readonly onDocumentChange?: (change: import('../runtime/types').GanttDocumentChange) => void;
    };

type GanttSessionOwnership =
  | {
      readonly defaultSession?: never;
      readonly session: GanttSessionState;
    }
  | {
      readonly defaultSession?: Partial<GanttSessionState>;
      readonly session?: never;
    };

export type GanttProps = GanttBaseProps & GanttDocumentOwnership & GanttSessionOwnership;

export type GanttSelector<T> = (snapshot: GanttSelectorSnapshot) => T;
export type GanttSelectorEquality<T> = (previous: T, next: T) => boolean;

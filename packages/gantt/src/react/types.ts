import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { EntityId, EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
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

export interface GanttSelectorSnapshot {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly document: GanttDocument;
  readonly interaction: {
    readonly proposalId?: string;
    readonly status: 'document-proposal-pending' | 'idle';
  };
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

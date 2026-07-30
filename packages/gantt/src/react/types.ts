import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { EntityId, EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import type { ComponentType, HTMLAttributes, ReactNode, RefCallback } from 'react';
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

export type GanttInteractionAction =
  | 'command'
  | 'create'
  | 'delete'
  | 'edit'
  | 'move'
  | 'redo'
  | 'resize'
  | 'undo';

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

export interface GanttTaskSummary {
  readonly end: EpochMilliseconds;
  readonly start: EpochMilliseconds;
  readonly target: GanttTaskTarget;
  readonly title: string;
  readonly variant?: string;
}

export interface GanttLaneSummary {
  readonly target: Extract<GanttInteractionTarget, { readonly kind: 'lane' }>;
  readonly title: string;
}

export interface GanttClassNameState {
  readonly disabled: boolean;
  readonly dragging: boolean;
  readonly focused: boolean;
  readonly invalid: boolean;
  readonly pending: boolean;
  readonly resizing: boolean;
  readonly selected: boolean;
  readonly target?: GanttInteractionTarget;
}

export type GanttClassNameValue = string | ((state: GanttClassNameState) => string | undefined);

export interface GanttClassNames {
  readonly chart?: GanttClassNameValue;
  readonly contextMenu?: GanttClassNameValue;
  readonly editor?: GanttClassNameValue;
  readonly lane?: GanttClassNameValue;
  readonly laneHeader?: GanttClassNameValue;
  readonly liveRegion?: GanttClassNameValue;
  readonly resizeHandle?: GanttClassNameValue;
  readonly root?: GanttClassNameValue;
  readonly task?: GanttClassNameValue;
  readonly taskContent?: GanttClassNameValue;
  readonly timelineCell?: GanttClassNameValue;
  readonly tooltip?: GanttClassNameValue;
}

export interface GanttTaskContentProps extends GanttClassNameState {
  readonly task: GanttTaskSummary;
}

export interface GanttLaneHeaderProps extends GanttClassNameState {
  readonly lane: GanttLaneSummary;
}

export interface GanttLaneColumnCellProps {
  readonly disabled: boolean;
  readonly lane: GanttLaneSummary;
}

export interface GanttLaneColumn {
  readonly header: ReactNode;
  readonly id: string;
  readonly renderCell?: (props: GanttLaneColumnCellProps) => ReactNode;
  readonly width?: number;
}

export type GanttOverlayBindings = Readonly<
  HTMLAttributes<HTMLDivElement> & {
    readonly ref: RefCallback<HTMLDivElement>;
  }
>;

export interface GanttTooltipProps {
  readonly bindings: GanttOverlayBindings;
  readonly task: GanttTaskSummary;
}

export type GanttBuiltInMenuAction = 'create' | 'delete' | 'edit';

export type GanttContextMenuItem =
  | {
      readonly action: GanttBuiltInMenuAction;
      readonly command?: never;
      readonly disabledReason?: string;
      readonly id: string;
      readonly label: string;
    }
  | {
      readonly action?: never;
      readonly command: GanttCommand;
      readonly disabledReason?: string;
      readonly id: string;
      readonly label: string;
    };

export type GanttContextMenuItems =
  | readonly GanttContextMenuItem[]
  | ((task: GanttTaskSummary) => readonly GanttContextMenuItem[]);

export interface GanttContextMenuProps {
  readonly bindings: GanttOverlayBindings;
  readonly items: readonly GanttContextMenuItem[];
  readonly onSelect: (item: GanttContextMenuItem) => void;
  readonly task: GanttTaskSummary;
}

export interface GanttTaskEditorValue {
  readonly end: EpochMilliseconds;
  readonly start: EpochMilliseconds;
  readonly title: string;
}

export interface GanttTaskEditorProps {
  readonly bindings: GanttOverlayBindings;
  readonly error?: string;
  readonly errorId: string;
  readonly initialValue: GanttTaskEditorValue;
  readonly onCancel: () => void;
  readonly onSubmit: (value: GanttTaskEditorValue) => void;
  readonly pending: boolean;
  readonly task: GanttTaskSummary;
}

export interface GanttSlots {
  readonly ContextMenu?: ComponentType<GanttContextMenuProps>;
  readonly LaneHeader?: ComponentType<GanttLaneHeaderProps>;
  readonly TaskContent?: ComponentType<GanttTaskContentProps>;
  readonly TaskEditor?: ComponentType<GanttTaskEditorProps>;
  readonly Tooltip?: ComponentType<GanttTooltipProps>;
}

export interface GanttFeatures {
  readonly contextMenu?: boolean;
  readonly editor?: boolean;
  readonly tooltip?: boolean;
}

interface GanttBaseProps {
  readonly className?: string;
  readonly classNames?: GanttClassNames;
  readonly columns?: readonly GanttLaneColumn[];
  readonly contextMenuItems?: GanttContextMenuItems;
  readonly features?: GanttFeatures;
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
  readonly slots?: GanttSlots;
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

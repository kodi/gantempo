import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type {
  EntityId,
  DependencyRecord,
  DependencyType,
  DurationValue,
  EpochMilliseconds,
  GanttAppearanceReference,
  GanttDocument,
  TaskKind,
  TimeRange,
} from '../model/types';
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
import type { GanttDirection, GanttFormatters, GanttMessages } from '../localization/types';
import type { GanttAppearanceVariantOption } from '../render/appearance';
import type {
  GanttFitToProjectOptions,
  GanttTimeScaleDefinition,
  GanttTimeScaleLevel,
  GanttZoomOptions,
} from '../time/adaptive-scale';
import type {
  GanttCommandCommittedEvent,
  GanttCommandInterceptor,
  GanttCommandRejectedEvent,
  GanttDispatchOptions,
  GanttDispatchResult,
  GanttDependencyTarget,
  GanttInteractionTarget,
  GanttMeasuredViewportState,
  GanttRuntimeErrorEvent,
  GanttSessionState,
  GanttTaskTarget,
} from '../runtime/types';

export interface GanttSemanticEvent {
  readonly source: 'controlled-prop' | 'imperative' | 'runtime';
}

export interface GanttRangeChangeEvent extends GanttSemanticEvent {
  readonly anchorTime?: EpochMilliseconds;
  readonly reason: 'fit' | 'pan' | 'scroll' | 'zoom';
}

export type {
  GanttFitToProjectOptions,
  GanttTimeScaleDefinition,
  GanttTimeScaleLevel,
  GanttZoomOptions,
} from '../time/adaptive-scale';
export type {
  GanttDirection,
  GanttFormatContext,
  GanttFormatters,
  GanttFormatUse,
  GanttMessageDescriptor,
  GanttMessageKey,
  GanttMessages,
  GanttMessageValue,
  GanttMessageValues,
} from '../localization/types';

export interface GanttTaskEditRequest {
  readonly source: 'context-menu';
  readonly target: GanttTaskTarget;
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
  readonly depth?: number;
  readonly descendantCount?: number;
  readonly end: EpochMilliseconds;
  readonly expanded?: boolean;
  readonly filterMatch?: 'ancestor' | 'direct';
  readonly hasChildren?: boolean;
  readonly intervalSource: 'canonical' | 'descendants';
  readonly kind: TaskKind;
  readonly progress?: number;
  readonly resolvedDescendantCount?: number;
  readonly start: EpochMilliseconds;
  readonly target: GanttTaskTarget;
  readonly unresolvedDescendantCount?: number;
}

export type GanttCommandMappingResult = InteractionCommandMappingResult;
export type GanttCreateTaskIntent = InteractionCreateTaskMapperIntent;
export type GanttMoveOccurrenceIntent = InteractionMoveOccurrenceMapperIntent;
export type GanttInteractionSnapPolicy = InteractionSnapPolicy;

export interface GanttInteractionCommandMappers {
  readonly createTask?: (intent: GanttCreateTaskIntent) => GanttCommandMappingResult;
  readonly moveOccurrence?: (intent: GanttMoveOccurrenceIntent) => GanttCommandMappingResult;
}

export interface GanttTaskInteractionPreview {
  readonly description: string;
  readonly destination: Extract<GanttInteractionTarget, { readonly kind: 'lane' }>;
  readonly end: EpochMilliseconds;
  readonly height: number;
  readonly kind: InteractionPreviewPrimitive['kind'];
  readonly progress?: number;
  readonly source?: GanttTaskTarget;
  readonly start: EpochMilliseconds;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface GanttDependencyInteractionPreview {
  readonly kind: 'dependency';
  readonly source: GanttTaskTarget;
  readonly target?: GanttTaskTarget;
  readonly type: DependencyType;
}

export type GanttInteractionPreview =
  | GanttDependencyInteractionPreview
  | GanttTaskInteractionPreview;

export type GanttInteractionAction =
  | 'command'
  | 'create'
  | 'dependency'
  | 'delete'
  | 'edit'
  | 'move'
  | 'progress'
  | 'redo'
  | 'resize'
  | 'undo';

export type GanttInteractionState =
  | {
      readonly action: 'dependency';
      readonly announcement: string;
      readonly mode: 'link';
      readonly pointerType?: InteractionPointerType;
      readonly preview: GanttDependencyInteractionPreview;
      readonly status: 'linking';
      readonly target: GanttTaskTarget;
    }
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
      readonly status: 'creating' | 'dragging' | 'progressing' | 'resizing';
      readonly target?: GanttInteractionTarget;
    }
  | {
      readonly action: 'move' | 'progress' | 'resize';
      readonly announcement: string;
      readonly mode: 'move' | 'progress' | 'resize-end' | 'resize-start';
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
  readonly dependencies: readonly GanttDependencySummary[];
  readonly interaction: GanttInteractionState;
  readonly occurrences: readonly GanttVisibleOccurrence[];
  readonly range: TimeRange;
  readonly scaleLevel: GanttTimeScaleLevel;
  readonly session: GanttSessionState;
  readonly viewport: GanttMeasuredViewportState;
}

export interface GanttHandle {
  canRedo(): boolean;
  canUndo(): boolean;
  dispatch(command: GanttCommand, options?: GanttDispatchOptions): Promise<GanttDispatchResult>;
  focusTask(target: GanttTaskTarget): boolean;
  fitToProject(options?: GanttFitToProjectOptions): boolean;
  getDocument(): GanttDocument;
  getSelection(): readonly GanttInteractionTarget[];
  getSession(): GanttSessionState;
  redo(): Promise<GanttDispatchResult>;
  scrollToTask(target: GanttTaskTarget, options?: GanttScrollOptions): boolean;
  scrollToTime(time: EpochMilliseconds, options?: GanttScrollOptions): boolean;
  undo(): Promise<GanttDispatchResult>;
  zoomTo(level: GanttTimeScaleLevel, options?: GanttZoomOptions): boolean;
}

export interface GanttTaskSummary {
  readonly depth?: number;
  readonly descendantCount?: number;
  readonly end: EpochMilliseconds;
  readonly expanded?: boolean;
  readonly filterMatch?: 'ancestor' | 'direct';
  readonly hasChildren?: boolean;
  readonly intervalSource: 'canonical' | 'descendants';
  readonly kind: TaskKind;
  readonly progress?: number;
  readonly resolvedDescendantCount?: number;
  readonly start: EpochMilliseconds;
  readonly target: GanttTaskTarget;
  readonly title: string;
  readonly unresolvedDescendantCount?: number;
  readonly variant?: string;
}

export interface GanttLaneSummary {
  readonly depth?: number;
  readonly expanded?: boolean;
  readonly filterMatch?: 'ancestor' | 'direct';
  readonly hasChildren?: boolean;
  readonly target: Extract<GanttInteractionTarget, { readonly kind: 'lane' }>;
  readonly title: string;
}

export interface GanttDependencySummary {
  readonly dependency: DependencyRecord;
  readonly fromTitle: string;
  readonly hiddenEndpoint: boolean;
  readonly status: 'invalid' | 'valid';
  readonly target: GanttDependencyTarget;
  readonly toTitle: string;
}

export interface GanttClassNameState {
  readonly disabled: boolean;
  readonly dragging: boolean;
  readonly focused: boolean;
  readonly invalid: boolean;
  readonly pending: boolean;
  readonly progressing: boolean;
  readonly resizing: boolean;
  readonly selected: boolean;
  readonly target?: GanttInteractionTarget;
}

export type GanttClassNameValue = string | ((state: GanttClassNameState) => string | undefined);

export interface GanttClassNames {
  readonly branchToggle?: GanttClassNameValue;
  readonly chart?: GanttClassNameValue;
  readonly contextMenu?: GanttClassNameValue;
  readonly dependencyMarker?: GanttClassNameValue;
  readonly dependencyPath?: GanttClassNameValue;
  readonly editor?: GanttClassNameValue;
  readonly lane?: GanttClassNameValue;
  readonly laneHeader?: GanttClassNameValue;
  readonly liveRegion?: GanttClassNameValue;
  readonly milestone?: GanttClassNameValue;
  readonly progressHandle?: GanttClassNameValue;
  readonly linkHandle?: GanttClassNameValue;
  readonly resizeHandle?: GanttClassNameValue;
  readonly root?: GanttClassNameValue;
  readonly summary?: GanttClassNameValue;
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

export type GanttItemPropertiesValue =
  | {
      readonly appearance?: GanttAppearanceReference;
      readonly description?: string;
      readonly end?: EpochMilliseconds;
      readonly kind: 'task';
      readonly laneId?: EntityId;
      readonly order?: number;
      readonly parentId?: EntityId;
      readonly placementId?: EntityId;
      readonly progress?: number;
      readonly start?: EpochMilliseconds;
      readonly taskId: EntityId;
      readonly taskKind: TaskKind;
      readonly title: string;
    }
  | {
      readonly appearance?: GanttAppearanceReference;
      readonly kind: 'lane';
      readonly laneId: EntityId;
      readonly title: string;
    };

export interface GanttItemPropertiesProps {
  readonly bindings: GanttOverlayBindings;
  readonly error?: string;
  readonly errorId: string;
  readonly initialValue: GanttItemPropertiesValue;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onSubmit: (value: GanttItemPropertiesValue) => void;
  readonly pending: boolean;
}

export interface GanttDependencyPropertiesValue {
  readonly dependencyId: EntityId;
  readonly fromTitle: string;
  readonly lag?: DurationValue;
  readonly toTitle: string;
  readonly type: DependencyType;
}

export interface GanttDependencyPropertiesProps {
  readonly bindings: GanttOverlayBindings;
  readonly error?: string;
  readonly errorId: string;
  readonly initialValue: GanttDependencyPropertiesValue;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onSubmit: (value: GanttDependencyPropertiesValue) => void;
  readonly pending: boolean;
  readonly readOnly: boolean;
}

export interface GanttSlots {
  readonly ContextMenu?: ComponentType<GanttContextMenuProps>;
  readonly DependencyProperties?: ComponentType<GanttDependencyPropertiesProps>;
  readonly ItemProperties?: ComponentType<GanttItemPropertiesProps>;
  readonly LaneHeader?: ComponentType<GanttLaneHeaderProps>;
  readonly TaskContent?: ComponentType<GanttTaskContentProps>;
  readonly TaskEditor?: ComponentType<GanttTaskEditorProps>;
  readonly Tooltip?: ComponentType<GanttTooltipProps>;
}

export interface GanttFeatures {
  readonly contextMenu?: boolean;
  readonly editor?: boolean;
  readonly properties?: boolean;
  readonly tooltip?: boolean;
}

export type GanttOverlayContainer =
  | 'document'
  | 'root'
  | Element
  | DocumentFragment
  | (() => Element | DocumentFragment | null);

interface GanttBaseProps {
  readonly appearanceVariants?: readonly GanttAppearanceVariantOption[];
  readonly className?: string;
  readonly classNames?: GanttClassNames;
  readonly columns?: readonly GanttLaneColumn[];
  readonly contextMenuItems?: GanttContextMenuItems;
  readonly direction?: GanttDirection;
  readonly features?: GanttFeatures;
  readonly formatters?: GanttFormatters;
  readonly historyCapacity?: number;
  readonly interceptors?: readonly GanttCommandInterceptor[];
  readonly interactionCreationDuration?: number;
  readonly interactionMappers?: GanttInteractionCommandMappers;
  readonly interactionSnap?: GanttInteractionSnapPolicy;
  readonly label?: string;
  readonly locale?: string;
  readonly messages?: GanttMessages;
  readonly onCommandCommitted?: (event: GanttCommandCommittedEvent) => void;
  readonly onCommandRejected?: (event: GanttCommandRejectedEvent) => void;
  readonly onDiagnostics?: (diagnostics: readonly Diagnostic[]) => void;
  readonly onFocusChange?: (
    focused: GanttInteractionTarget | undefined,
    event: GanttSemanticEvent,
  ) => void;
  readonly onRangeChange?: (range: TimeRange, event: GanttRangeChangeEvent) => void;
  readonly onRuntimeError?: (event: GanttRuntimeErrorEvent) => void;
  readonly onSelectionChange?: (
    selection: readonly GanttInteractionTarget[],
    event: GanttSemanticEvent,
  ) => void;
  readonly onSessionChange?: (session: GanttSessionState, event: GanttSemanticEvent) => void;
  readonly onTaskActivate?: (target: GanttTaskTarget, event: GanttSemanticEvent) => void;
  readonly onTaskEditRequest?: (request: GanttTaskEditRequest) => void;
  readonly onViewportChange?: (viewport: GanttViewportChange, event: GanttSemanticEvent) => void;
  readonly overlayContainer?: GanttOverlayContainer;
  readonly slots?: GanttSlots;
  readonly taskVariants?: Readonly<Record<EntityId, string>>;
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

export type GanttRangeOwnership =
  | { readonly defaultRange?: never; readonly range: TimeRange }
  | { readonly defaultRange: TimeRange; readonly range?: never };

type GanttScaleOwnership =
  | {
      readonly tickAnchor: EpochMilliseconds;
      readonly tickInterval: number;
      readonly timeScale?: never;
    }
  | {
      readonly tickAnchor?: never;
      readonly tickInterval?: never;
      readonly timeScale: GanttTimeScaleDefinition;
    };

export type GanttProps = GanttBaseProps &
  GanttDocumentOwnership &
  GanttRangeOwnership &
  GanttScaleOwnership &
  GanttSessionOwnership;

export type GanttSelector<T> = (snapshot: GanttSelectorSnapshot) => T;
export type GanttSelectorEquality<T> = (previous: T, next: T) => boolean;

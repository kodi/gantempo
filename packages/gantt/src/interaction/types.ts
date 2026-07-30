import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { EpochMilliseconds, GanttDocument, TimeRange } from '../model/types';
import type { ChartScene } from '../render/primitives';
import type { GanttInteractionTarget, GanttLaneTarget, GanttTaskTarget } from '../runtime/types';

export interface InteractionPoint {
  readonly x: number;
  readonly y: number;
}

export interface InteractionRectangle {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface InteractionTimelineBounds extends InteractionRectangle {
  readonly verticalStart: number;
}

export interface InteractionSnapPolicy {
  readonly anchor: EpochMilliseconds;
  readonly step: number;
}

export interface InteractionLaneNode {
  readonly index: number;
  readonly primitive: ChartScene['lanes'][number];
  readonly rect: InteractionRectangle;
  readonly target: GanttLaneTarget;
}

export interface InteractionTaskNode {
  readonly lane: InteractionLaneNode;
  readonly paintOrder: number;
  readonly primitive: ChartScene['taskBars'][number];
  readonly rect: InteractionRectangle;
  readonly target: GanttTaskTarget;
}

export interface InteractionHitTestIndex {
  readonly lanes: readonly InteractionLaneNode[];
  readonly range: TimeRange;
  readonly tasks: readonly InteractionTaskNode[];
  readonly tasksByLane: readonly (readonly InteractionTaskNode[])[];
  readonly timeline: InteractionTimelineBounds;
}

export type InteractionPointerType = 'mouse' | 'pen' | 'touch';

interface InteractionHitBase {
  readonly lane: InteractionLaneNode;
  readonly point: InteractionPoint;
  readonly time: EpochMilliseconds;
}

export interface InteractionTimelineHit extends InteractionHitBase {
  readonly kind: 'timeline-position';
}

export interface InteractionTaskBodyHit extends InteractionHitBase {
  readonly kind: 'task-body';
  readonly task: InteractionTaskNode;
}

export interface InteractionTaskEdgeHit extends InteractionHitBase {
  readonly edge: 'end' | 'start';
  readonly kind: 'task-edge';
  readonly task: InteractionTaskNode;
}

export type InteractionHit =
  | InteractionTaskBodyHit
  | InteractionTaskEdgeHit
  | InteractionTimelineHit;

export type InteractionNavigationDirection = 'down' | 'end' | 'home' | 'left' | 'right' | 'up';

interface InteractionIntentBase {
  readonly destination: GanttLaneTarget;
  readonly kind: 'create' | 'move' | 'resize';
}

export interface InteractionMoveIntent extends InteractionIntentBase {
  readonly delta: number;
  readonly end: EpochMilliseconds;
  readonly kind: 'move';
  readonly source: GanttTaskTarget;
  readonly sourceEnd: EpochMilliseconds;
  readonly sourceStart: EpochMilliseconds;
  readonly start: EpochMilliseconds;
  readonly task: InteractionTaskNode;
}

export interface InteractionResizeIntent extends InteractionIntentBase {
  readonly edge: 'end' | 'start';
  readonly end: EpochMilliseconds;
  readonly kind: 'resize';
  readonly source: GanttTaskTarget;
  readonly sourceEnd: EpochMilliseconds;
  readonly sourceStart: EpochMilliseconds;
  readonly start: EpochMilliseconds;
  readonly task: InteractionTaskNode;
  readonly time: EpochMilliseconds;
}

export interface InteractionCreateIntent extends InteractionIntentBase {
  readonly end: EpochMilliseconds;
  readonly kind: 'create';
  readonly start: EpochMilliseconds;
}

export type InteractionIntent =
  | InteractionCreateIntent
  | InteractionMoveIntent
  | InteractionResizeIntent;

export interface InteractionPreviewPrimitive {
  readonly description: string;
  readonly destination: GanttLaneTarget;
  readonly end: EpochMilliseconds;
  readonly height: number;
  readonly kind: InteractionIntent['kind'];
  readonly source?: GanttTaskTarget;
  readonly start: EpochMilliseconds;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export type InteractionGestureState =
  | { readonly status: 'idle' }
  | {
      readonly hit: InteractionHit;
      readonly pointerId: number;
      readonly pointerType: InteractionPointerType;
      readonly start: InteractionPoint;
      readonly status: 'pressed';
    }
  | {
      readonly intent: InteractionIntent;
      readonly origin: InteractionHit;
      readonly pointerId: number;
      readonly pointerType: InteractionPointerType;
      readonly preview: InteractionPreviewPrimitive;
      readonly start: InteractionPoint;
      readonly status: 'active';
    }
  | {
      readonly intent: InteractionIntent;
      readonly preview: InteractionPreviewPrimitive;
      readonly status: 'committed';
    }
  | {
      readonly reason: 'cancelled' | 'threshold-not-met';
      readonly status: 'cancelled';
    };

export type InteractionGestureEvent =
  | {
      readonly candidateViewKey?: string;
      readonly point: InteractionPoint;
      readonly pointerId: number;
      readonly pointerType: InteractionPointerType;
      readonly type: 'press';
    }
  | {
      readonly candidateViewKey?: string;
      readonly point: InteractionPoint;
      readonly pointerId: number;
      readonly type: 'move';
    }
  | {
      readonly pointerId: number;
      readonly type: 'release';
    }
  | {
      readonly type: 'cancel';
    }
  | {
      readonly type: 'reset';
    };

export interface InteractionGestureOptions {
  readonly creationDuration?: number;
  readonly index: InteractionHitTestIndex;
  readonly mouseThreshold?: number;
  readonly penThreshold?: number;
  readonly snap: InteractionSnapPolicy;
  readonly touchThreshold?: number;
}

export interface InteractionCreateTaskMapperIntent {
  readonly destination: GanttLaneTarget;
  readonly end: EpochMilliseconds;
  readonly kind: 'create';
  readonly start: EpochMilliseconds;
}

export interface InteractionMoveOccurrenceMapperIntent {
  readonly delta: number;
  readonly destination: GanttLaneTarget;
  readonly end: EpochMilliseconds;
  readonly kind: 'move-occurrence';
  readonly source: GanttTaskTarget;
  readonly start: EpochMilliseconds;
}

export type InteractionCommandMappingResult =
  | {
      readonly command: GanttCommand;
      readonly status: 'mapped';
    }
  | {
      readonly diagnostic: Diagnostic;
      readonly status: 'rejected';
    };

export interface InteractionCommandMappers {
  readonly createTask?: (
    intent: InteractionCreateTaskMapperIntent,
  ) => InteractionCommandMappingResult;
  readonly moveOccurrence?: (
    intent: InteractionMoveOccurrenceMapperIntent,
  ) => InteractionCommandMappingResult;
}

export interface MapInteractionIntentOptions {
  readonly document: GanttDocument;
  readonly mappers?: InteractionCommandMappers;
}

export interface InteractionOccurrenceGeometry {
  readonly horizontalCenter: number;
  readonly laneIndex: number;
  readonly target: GanttInteractionTarget;
}

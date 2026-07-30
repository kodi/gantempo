import type { Diagnostic } from '../model/diagnostics';
import type { EntityId } from '../model/types';

export interface DocumentViewDefinition {
  readonly kind: 'document';
}

export interface ProjectViewDefinition {
  readonly kind: 'project';
}

export interface ResourceViewDefinition {
  readonly kind: 'resource';
}

export interface CustomViewLane {
  readonly key: string;
  readonly title: string;
  readonly minimumHeight?: number;
}

export interface CustomViewPlacement {
  readonly key: string;
  readonly laneKey: string;
  readonly taskId: EntityId;
  readonly segmentId?: EntityId;
  readonly assignmentId?: EntityId;
}

export interface CustomViewDefinition {
  readonly kind: 'custom';
  readonly id: string;
  readonly lanes: readonly CustomViewLane[];
  readonly placements: readonly CustomViewPlacement[];
}

export type GanttViewDefinition =
  | CustomViewDefinition
  | DocumentViewDefinition
  | ProjectViewDefinition
  | ResourceViewDefinition;

declare const viewLaneKeyBrand: unique symbol;
declare const viewPlacementKeyBrand: unique symbol;

export type ViewLaneKey = string & { readonly [viewLaneKeyBrand]: true };
export type ViewPlacementKey = string & { readonly [viewPlacementKeyBrand]: true };

export type ViewLaneSource =
  | {
      readonly kind: 'document-lane';
      readonly laneId: EntityId;
      readonly resourceId?: EntityId;
    }
  | {
      readonly kind: 'project-task';
      readonly taskId: EntityId;
    }
  | {
      readonly kind: 'resource';
      readonly resourceId: EntityId;
    }
  | {
      readonly kind: 'custom';
      readonly viewId: string;
      readonly customLaneKey: string;
    };

export type ViewPlacementSource =
  | {
      readonly kind: 'document-placement';
      readonly placementId: EntityId;
      readonly laneId: EntityId;
    }
  | {
      readonly kind: 'project-task';
      readonly taskId: EntityId;
    }
  | {
      readonly kind: 'resource-assignment';
      readonly assignmentId: EntityId;
      readonly resourceId: EntityId;
    }
  | {
      readonly kind: 'custom';
      readonly viewId: string;
      readonly customPlacementKey: string;
    };

export interface ResolvedViewLane {
  readonly key: ViewLaneKey;
  readonly title: string;
  readonly sourceOrder: number;
  readonly minimumHeight?: number;
  readonly source: ViewLaneSource;
}

export interface ResolvedViewPlacement {
  readonly key: ViewPlacementKey;
  readonly laneKey: ViewLaneKey;
  readonly taskId: EntityId;
  readonly segmentId?: EntityId;
  readonly assignmentId?: EntityId;
  readonly sourceOrder: number;
  readonly source: ViewPlacementSource;
}

export interface ResolvedView {
  readonly kind: GanttViewDefinition['kind'];
  readonly lanes: readonly ResolvedViewLane[];
  readonly placements: readonly ResolvedViewPlacement[];
}

export type ResolveViewResult =
  | {
      readonly status: 'rejected';
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: 'resolved';
      readonly view: ResolvedView;
      readonly diagnostics: readonly Diagnostic[];
    };

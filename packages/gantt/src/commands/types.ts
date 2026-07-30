import type { Diagnostic } from '../model/diagnostics';
import type {
  AssignmentRecord,
  DependencyRecord,
  EntityId,
  GanttDocument,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
} from '../model/types';

export const DOCUMENT_COLLECTIONS = [
  'tasks',
  'resources',
  'lanes',
  'assignments',
  'placements',
  'dependencies',
] as const;

export type DocumentCollection = (typeof DOCUMENT_COLLECTIONS)[number];

export interface DomainRecordByCollection {
  readonly assignments: AssignmentRecord;
  readonly dependencies: DependencyRecord;
  readonly lanes: LaneRecord;
  readonly placements: PlacementRecord;
  readonly resources: ResourceRecord;
  readonly tasks: TaskRecord;
}

export interface EntityReference<C extends DocumentCollection = DocumentCollection> {
  readonly collection: C;
  readonly id: EntityId;
}

export type AddEntityPatch = {
  readonly [C in DocumentCollection]: {
    readonly index: number;
    readonly op: 'add';
    readonly patchVersion: 1;
    readonly target: EntityReference<C>;
    readonly value: DomainRecordByCollection[C];
  };
}[DocumentCollection];

export type ReplaceEntityPatch = {
  readonly [C in DocumentCollection]: {
    readonly op: 'replace';
    readonly patchVersion: 1;
    readonly target: EntityReference<C>;
    readonly value: DomainRecordByCollection[C];
  };
}[DocumentCollection];

export interface RemoveEntityPatch {
  readonly op: 'remove';
  readonly patchVersion: 1;
  readonly target: EntityReference;
}

export type GanttPatch = AddEntityPatch | RemoveEntityPatch | ReplaceEntityPatch;

export type PatchApplicationResult =
  | {
      readonly diagnostics: readonly [];
      readonly document: GanttDocument;
      readonly inversePatches: readonly GanttPatch[];
      readonly patches: readonly GanttPatch[];
      readonly status: 'applied';
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly document: GanttDocument;
      readonly inversePatches: readonly [];
      readonly patches: readonly [];
      readonly status: 'rejected';
    };

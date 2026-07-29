import type { EntityId } from '../model/types';

export type RenderDiagnosticCode =
  | 'dangling-lane-reference'
  | 'dangling-task-reference'
  | 'duplicate-lane-id'
  | 'duplicate-placement-id'
  | 'duplicate-task-id'
  | 'invalid-task-interval'
  | 'missing-task-schedule'
  | 'non-finite-task-time';

export interface RenderDiagnostic {
  readonly code: RenderDiagnosticCode;
  readonly entityId: EntityId;
  readonly message: string;
  readonly relatedEntityIds?: readonly EntityId[];
}

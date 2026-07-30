import type { JsonObject } from './json';
import type { EntityId } from './types';

export type DiagnosticSeverity = 'error' | 'info' | 'warning';

export type DiagnosticCode =
  | 'document.invalid-collection'
  | 'document.invalid-root'
  | 'patch.duplicate-target'
  | 'patch.invalid-index'
  | 'patch.invalid-operation'
  | 'patch.invalid-shape'
  | 'patch.invalid-target'
  | 'patch.invalid-value'
  | 'patch.invalid-version'
  | 'patch.missing-target'
  | 'record.duplicate-assignment'
  | 'record.duplicate-dependency'
  | 'record.duplicate-lane'
  | 'record.duplicate-placement'
  | 'record.duplicate-resource'
  | 'record.duplicate-segment'
  | 'record.duplicate-task'
  | 'record.invalid-assignment'
  | 'record.invalid-dependency'
  | 'record.invalid-lane'
  | 'record.invalid-placement'
  | 'record.invalid-resource'
  | 'record.invalid-segment'
  | 'record.invalid-task'
  | 'reference.assignment-resource'
  | 'reference.assignment-task'
  | 'reference.dependency-source'
  | 'reference.dependency-self'
  | 'reference.dependency-target'
  | 'reference.lane-parent'
  | 'reference.lane-resource'
  | 'reference.placement-assignment'
  | 'reference.placement-lane'
  | 'reference.placement-segment'
  | 'reference.placement-task'
  | 'reference.resource-parent'
  | 'reference.task-parent'
  | 'render.invalid-task-interval'
  | 'render.missing-task-schedule'
  | 'render.non-finite-task-time'
  | 'schema.invalid-version'
  | 'schema.migration-missing'
  | 'schema.migration-result'
  | 'schema.missing-version'
  | 'schema.unsupported-version'
  | 'value.invalid-all-day-date'
  | 'value.invalid-enum'
  | 'value.invalid-id'
  | 'value.invalid-instant'
  | 'value.invalid-json'
  | 'value.invalid-number'
  | 'value.invalid-string'
  | 'value.unknown-property';

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly entityIds?: readonly EntityId[];
  readonly path?: string;
  readonly details?: JsonObject;
}

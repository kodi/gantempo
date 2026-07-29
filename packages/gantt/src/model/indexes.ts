import type { Diagnostic, DiagnosticCode } from './diagnostics';
import type { EntityId, LaneRecord, PlacementRecord, TaskRecord } from './types';

interface IdentifiedRecord {
  readonly id: EntityId;
}

export interface RecordIndex<T extends IdentifiedRecord> {
  readonly byId: ReadonlyMap<EntityId, T>;
  readonly ordered: readonly T[];
  readonly diagnostics: readonly Diagnostic[];
}

function indexRecords<T extends IdentifiedRecord>(
  records: readonly T[],
  duplicateCode: DiagnosticCode,
  recordName: string,
): RecordIndex<T> {
  const byId = new Map<EntityId, T>();
  const ordered: T[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const record of records) {
    if (byId.has(record.id)) {
      diagnostics.push({
        code: duplicateCode,
        severity: 'error',
        entityIds: [record.id],
        message: `Duplicate ${recordName} ID "${record.id}" was omitted.`,
      });
      continue;
    }

    byId.set(record.id, record);
    ordered.push(record);
  }

  return { byId, ordered, diagnostics };
}

export function indexTasks(records: readonly TaskRecord[]): RecordIndex<TaskRecord> {
  return indexRecords(records, 'record.duplicate-task', 'task');
}

export function indexLanes(records: readonly LaneRecord[]): RecordIndex<LaneRecord> {
  return indexRecords(records, 'record.duplicate-lane', 'lane');
}

export function indexPlacements(records: readonly PlacementRecord[]): RecordIndex<PlacementRecord> {
  return indexRecords(records, 'record.duplicate-placement', 'placement');
}

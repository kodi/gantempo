import type { RenderDiagnostic, RenderDiagnosticCode } from '../render/diagnostics';
import type { EntityId, LaneRecord, PlacementRecord, TaskRecord } from './types';

interface IdentifiedRecord {
  readonly id: EntityId;
}

export interface RecordIndex<T extends IdentifiedRecord> {
  readonly byId: ReadonlyMap<EntityId, T>;
  readonly ordered: readonly T[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

function indexRecords<T extends IdentifiedRecord>(
  records: readonly T[],
  duplicateCode: RenderDiagnosticCode,
  recordName: string,
): RecordIndex<T> {
  const byId = new Map<EntityId, T>();
  const ordered: T[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  for (const record of records) {
    if (byId.has(record.id)) {
      diagnostics.push({
        code: duplicateCode,
        entityId: record.id,
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
  return indexRecords(records, 'duplicate-task-id', 'task');
}

export function indexLanes(records: readonly LaneRecord[]): RecordIndex<LaneRecord> {
  return indexRecords(records, 'duplicate-lane-id', 'lane');
}

export function indexPlacements(records: readonly PlacementRecord[]): RecordIndex<PlacementRecord> {
  return indexRecords(records, 'duplicate-placement-id', 'placement');
}

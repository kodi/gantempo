import type { DocumentCollection, DomainRecordByCollection, GanttPatch } from '../commands/types';
import type { EntityId, GanttDocument } from '../model/types';
import type { GanttEntityChange } from './types';

type DomainRecord = DomainRecordByCollection[DocumentCollection];

interface CollectionRecords {
  readonly after: ReadonlyMap<EntityId, DomainRecord>;
  readonly before: ReadonlyMap<EntityId, DomainRecord>;
}

function recordsById(
  document: GanttDocument,
  collection: DocumentCollection,
): ReadonlyMap<EntityId, DomainRecord> {
  return new Map(document[collection].map((record) => [record.id, record] as const));
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => structurallyEqual(item, right[index]))
    );
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        structurallyEqual(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function targetKey(collection: DocumentCollection, id: EntityId): string {
  return `${collection}\u0000${id}`;
}

function createEntityChange(
  records: CollectionRecords,
  collection: DocumentCollection,
  id: EntityId,
): GanttEntityChange | undefined {
  const before = records.before.get(id);
  const after = records.after.get(id);
  if (before === undefined && after !== undefined) {
    return Object.freeze({ after, collection, id, kind: 'create' }) as GanttEntityChange;
  }
  if (before !== undefined && after === undefined) {
    return Object.freeze({ before, collection, id, kind: 'delete' }) as GanttEntityChange;
  }
  if (before !== undefined && after !== undefined && !structurallyEqual(before, after)) {
    return Object.freeze({ after, before, collection, id, kind: 'update' }) as GanttEntityChange;
  }
  return undefined;
}

export function createGanttEntityChanges(
  baseDocument: GanttDocument,
  document: GanttDocument,
  patches: readonly GanttPatch[],
): readonly GanttEntityChange[] {
  const seen = new Set<string>();
  const records = new Map<DocumentCollection, CollectionRecords>();
  const changes: GanttEntityChange[] = [];
  for (const patch of patches) {
    const { collection, id } = patch.target;
    const key = targetKey(collection, id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    let collectionRecords = records.get(collection);
    if (collectionRecords === undefined) {
      collectionRecords = {
        after: recordsById(document, collection),
        before: recordsById(baseDocument, collection),
      };
      records.set(collection, collectionRecords);
    }
    const change = createEntityChange(collectionRecords, collection, id);
    if (change !== undefined) {
      changes.push(change);
    }
  }
  return Object.freeze(changes);
}

import type { Diagnostic } from '../model/diagnostics';
import type { EntityId, GanttDocument } from '../model/types';
import {
  DOCUMENT_COLLECTIONS,
  type DocumentCollection,
  type DomainRecordByCollection,
  type EntityReference,
  type GanttPatch,
  type PatchApplicationResult,
} from './types';
import { isCanonicalRecord, validateDocumentIntegrityStrict } from './validate';

type MutableCollections = {
  -readonly [C in DocumentCollection]: DomainRecordByCollection[C][];
};

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const EMPTY_PATCHES = Object.freeze([]) as readonly [];

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndFreeze<T>(input: T, ancestors = new WeakSet<object>()): T {
  if (input === null || typeof input !== 'object') {
    if (typeof input === 'number' && !Number.isFinite(input)) {
      throw new TypeError('Patch values may only contain finite numbers.');
    }
    if (input === undefined || typeof input === 'function' || typeof input === 'symbol') {
      throw new TypeError('Patch values must contain only JSON-compatible data.');
    }
    return input;
  }
  if (ancestors.has(input)) {
    throw new TypeError('Patch values must not contain cycles.');
  }
  ancestors.add(input);
  if (Array.isArray(input)) {
    const output: unknown[] = [];
    for (let index = 0; index < input.length; index += 1) {
      if (!Object.hasOwn(input, index)) {
        throw new TypeError('Patch values must not contain sparse arrays.');
      }
      output.push(cloneAndFreeze(input[index], ancestors));
    }
    ancestors.delete(input);
    return Object.freeze(output) as T;
  }
  if (!isPlainObject(input)) {
    throw new TypeError('Patch values must contain only plain objects.');
  }
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    output[key] = cloneAndFreeze(input[key], ancestors);
  }
  ancestors.delete(input);
  return Object.freeze(output) as T;
}

function freezeTarget(target: EntityReference): EntityReference {
  return Object.freeze({ collection: target.collection, id: target.id });
}

function freezePatch(patch: GanttPatch): GanttPatch {
  if (patch.op === 'remove') {
    return Object.freeze({
      op: patch.op,
      patchVersion: patch.patchVersion,
      target: freezeTarget(patch.target),
    });
  }
  if (patch.op === 'add') {
    return Object.freeze({
      index: patch.index,
      op: patch.op,
      patchVersion: patch.patchVersion,
      target: freezeTarget(patch.target),
      value: cloneAndFreeze(patch.value),
    }) as GanttPatch;
  }
  return Object.freeze({
    op: patch.op,
    patchVersion: patch.patchVersion,
    target: freezeTarget(patch.target),
    value: cloneAndFreeze(patch.value),
  }) as GanttPatch;
}

function diagnostic(
  code: Diagnostic['code'],
  message: string,
  path: string,
  entityIds?: readonly EntityId[],
): Diagnostic {
  return Object.freeze({
    code,
    ...(entityIds === undefined ? {} : { entityIds: Object.freeze([...entityIds]) }),
    message,
    path,
    severity: 'error',
  });
}

function reject(
  document: GanttDocument,
  diagnostics: readonly Diagnostic[],
): PatchApplicationResult {
  return Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    document,
    inversePatches: EMPTY_PATCHES,
    patches: EMPTY_PATCHES,
    status: 'rejected',
  });
}

function isCollection(input: unknown): input is DocumentCollection {
  return typeof input === 'string' && DOCUMENT_COLLECTIONS.includes(input as DocumentCollection);
}

function normalizePatch(
  input: unknown,
  index: number,
): { readonly diagnostic?: Diagnostic; readonly patch?: GanttPatch } {
  const path = `/patches/${index}`;
  if (!isPlainObject(input)) {
    return {
      diagnostic: diagnostic('patch.invalid-shape', 'A patch must be a plain object.', path),
    };
  }
  if (input.patchVersion !== 1) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-version',
        'Only patch version 1 is supported.',
        `${path}/patchVersion`,
      ),
    };
  }
  if (!['add', 'replace', 'remove'].includes(String(input.op))) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-operation',
        'A patch operation must be add, replace, or remove.',
        `${path}/op`,
      ),
    };
  }
  const operation = input.op as 'add' | 'remove' | 'replace';
  if (
    !isPlainObject(input.target) ||
    !isCollection(input.target.collection) ||
    typeof input.target.id !== 'string' ||
    input.target.id.length === 0 ||
    !Object.keys(input.target).every((key) => ['collection', 'id'].includes(key))
  ) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-target',
        'A patch target must contain a valid collection and canonical string ID.',
        `${path}/target`,
      ),
    };
  }

  const target = Object.freeze({
    collection: input.target.collection,
    id: input.target.id,
  }) as EntityReference;
  if (operation === 'remove') {
    if (!Object.keys(input).every((key) => ['patchVersion', 'op', 'target'].includes(key))) {
      return {
        diagnostic: diagnostic(
          'patch.invalid-shape',
          'A remove patch contains unsupported properties.',
          path,
          [target.id],
        ),
      };
    }
    return {
      patch: Object.freeze({ op: 'remove', patchVersion: 1, target }),
    };
  }

  const allowed =
    operation === 'add'
      ? ['patchVersion', 'op', 'target', 'index', 'value']
      : ['patchVersion', 'op', 'target', 'value'];
  if (!Object.keys(input).every((key) => allowed.includes(key))) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-shape',
        `A ${operation} patch contains unsupported properties.`,
        path,
        [target.id],
      ),
    };
  }
  if (operation === 'add' && (!Number.isInteger(input.index) || Number(input.index) < 0)) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-index',
        'An add patch index must be a non-negative integer.',
        `${path}/index`,
        [target.id],
      ),
    };
  }

  let value: unknown;
  try {
    value = cloneAndFreeze(input.value);
  } catch (error) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-value',
        error instanceof Error ? error.message : 'The patch value is invalid.',
        `${path}/value`,
        [target.id],
      ),
    };
  }
  if (!isCanonicalRecord(target.collection, value) || value.id !== target.id) {
    return {
      diagnostic: diagnostic(
        'patch.invalid-value',
        'The patch value must be a complete canonical record whose ID matches its target.',
        `${path}/value`,
        [target.id],
      ),
    };
  }

  if (operation === 'add') {
    return {
      patch: Object.freeze({
        index: Number(input.index),
        op: 'add',
        patchVersion: 1,
        target,
        value,
      }) as GanttPatch,
    };
  }
  return {
    patch: Object.freeze({
      op: 'replace',
      patchVersion: 1,
      target,
      value,
    }) as GanttPatch,
  };
}

function collectionCopy<C extends DocumentCollection>(
  document: GanttDocument,
  mutable: Partial<MutableCollections>,
  collection: C,
): DomainRecordByCollection[C][] {
  const existing = mutable[collection] as DomainRecordByCollection[C][] | undefined;
  if (existing) {
    return existing;
  }
  const copy = [...document[collection]] as DomainRecordByCollection[C][];
  (mutable as Record<DocumentCollection, unknown>)[collection] = copy;
  return copy;
}

function recordIndex<C extends DocumentCollection>(
  records: readonly DomainRecordByCollection[C][],
  id: EntityId,
): number {
  return records.findIndex((record) => record.id === id);
}

function createDocument(base: GanttDocument, mutable: Partial<MutableCollections>): GanttDocument {
  return Object.freeze({
    assignments:
      mutable.assignments === undefined
        ? base.assignments
        : (Object.freeze(
            mutable.assignments,
          ) as readonly DomainRecordByCollection['assignments'][]),
    dependencies:
      mutable.dependencies === undefined
        ? base.dependencies
        : (Object.freeze(
            mutable.dependencies,
          ) as readonly DomainRecordByCollection['dependencies'][]),
    lanes:
      mutable.lanes === undefined
        ? base.lanes
        : (Object.freeze(mutable.lanes) as readonly DomainRecordByCollection['lanes'][]),
    ...(base.metadata === undefined ? {} : { metadata: base.metadata }),
    placements:
      mutable.placements === undefined
        ? base.placements
        : (Object.freeze(mutable.placements) as readonly DomainRecordByCollection['placements'][]),
    resources:
      mutable.resources === undefined
        ? base.resources
        : (Object.freeze(mutable.resources) as readonly DomainRecordByCollection['resources'][]),
    ...(base.revision === undefined ? {} : { revision: base.revision }),
    schemaVersion: base.schemaVersion,
    tasks:
      mutable.tasks === undefined
        ? base.tasks
        : (Object.freeze(mutable.tasks) as readonly DomainRecordByCollection['tasks'][]),
  });
}

export function applyGanttPatches(
  document: GanttDocument,
  inputPatches: readonly GanttPatch[],
): PatchApplicationResult {
  if (!Array.isArray(inputPatches)) {
    return reject(document, [
      diagnostic('patch.invalid-shape', 'Patches must be supplied as an array.', '/patches'),
    ]);
  }
  const baseDiagnostics = validateDocumentIntegrityStrict(document);
  if (baseDiagnostics.length > 0) {
    return reject(document, baseDiagnostics);
  }

  const patches: GanttPatch[] = [];
  for (const [index, input] of inputPatches.entries()) {
    const normalized = normalizePatch(input, index);
    if (normalized.diagnostic || !normalized.patch) {
      return reject(document, [normalized.diagnostic!]);
    }
    patches.push(normalized.patch);
  }
  if (patches.length === 0) {
    return Object.freeze({
      diagnostics: EMPTY_DIAGNOSTICS,
      document,
      inversePatches: EMPTY_PATCHES,
      patches: EMPTY_PATCHES,
      status: 'applied',
    });
  }

  const mutable: Partial<MutableCollections> = {};
  const inversePatches: GanttPatch[] = [];
  for (const [index, patch] of patches.entries()) {
    const records = collectionCopy(document, mutable, patch.target.collection);
    const targetIndex = recordIndex(records, patch.target.id);
    if (patch.op === 'add') {
      if (targetIndex !== -1) {
        return reject(document, [
          diagnostic(
            'patch.duplicate-target',
            `Cannot add duplicate ${patch.target.collection} ID "${patch.target.id}".`,
            `/patches/${index}/target/id`,
            [patch.target.id],
          ),
        ]);
      }
      if (patch.index > records.length) {
        return reject(document, [
          diagnostic(
            'patch.invalid-index',
            `Add index ${patch.index} exceeds collection length ${records.length}.`,
            `/patches/${index}/index`,
            [patch.target.id],
          ),
        ]);
      }
      records.splice(patch.index, 0, patch.value);
      inversePatches.unshift(
        freezePatch({
          op: 'remove',
          patchVersion: 1,
          target: patch.target,
        }),
      );
      continue;
    }
    if (targetIndex === -1) {
      return reject(document, [
        diagnostic(
          'patch.missing-target',
          `Cannot ${patch.op} missing ${patch.target.collection} ID "${patch.target.id}".`,
          `/patches/${index}/target/id`,
          [patch.target.id],
        ),
      ]);
    }
    const previous = records[targetIndex]!;
    if (patch.op === 'replace') {
      records[targetIndex] = patch.value;
      inversePatches.unshift(
        freezePatch({
          op: 'replace',
          patchVersion: 1,
          target: patch.target,
          value: previous,
        } as GanttPatch),
      );
      continue;
    }
    records.splice(targetIndex, 1);
    inversePatches.unshift(
      freezePatch({
        index: targetIndex,
        op: 'add',
        patchVersion: 1,
        target: patch.target,
        value: previous,
      } as GanttPatch),
    );
  }

  const candidate = createDocument(document, mutable);
  const diagnostics = validateDocumentIntegrityStrict(candidate);
  if (diagnostics.length > 0) {
    return reject(document, diagnostics);
  }
  return Object.freeze({
    diagnostics: EMPTY_DIAGNOSTICS,
    document: candidate,
    inversePatches: Object.freeze(inversePatches),
    patches: Object.freeze(patches),
    status: 'applied',
  });
}

import { normalizeGanttRecordInput } from '../model/codec';
import type { Diagnostic } from '../model/diagnostics';
import type { EntityId } from '../model/types';
import type { DocumentCollection, DomainRecordByCollection } from './types';

interface NormalizeCommandRecordResult<C extends DocumentCollection> {
  readonly diagnostics: readonly Diagnostic[];
  readonly value?: DomainRecordByCollection[C];
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
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

function commandDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  return Object.freeze(
    diagnostics.map((item) =>
      Object.freeze({
        ...item,
        severity: 'error' as const,
      }),
    ),
  );
}

export function normalizeCommandRecord<C extends DocumentCollection>(
  collection: C,
  input: unknown,
  path: string,
): NormalizeCommandRecordResult<C> {
  const result = normalizeGanttRecordInput(collection, input, path);
  if (result.record === undefined || result.diagnostics.length > 0) {
    return Object.freeze({
      diagnostics: commandDiagnostics(result.diagnostics),
    });
  }
  return Object.freeze({
    diagnostics: Object.freeze([]),
    value: result.record as DomainRecordByCollection[C],
  });
}

export function normalizeUpdatedRecord<C extends DocumentCollection>(
  collection: C,
  current: DomainRecordByCollection[C],
  changes: unknown,
  allowedKeys: ReadonlySet<string>,
  clearableKeys: ReadonlySet<string>,
  path: string,
): NormalizeCommandRecordResult<C> {
  if (!isPlainObject(changes)) {
    return Object.freeze({
      diagnostics: Object.freeze([
        diagnostic(
          'command.invalid-payload',
          'Command changes must be supplied as a plain object.',
          path,
          [current.id],
        ),
      ]),
    });
  }
  if (Object.hasOwn(changes, 'id')) {
    return Object.freeze({
      diagnostics: Object.freeze([
        diagnostic('command.immutable-id', 'Entity IDs cannot be changed.', `${path}/id`, [
          current.id,
        ]),
      ]),
    });
  }

  const merged: Record<string, unknown> = { ...current };
  for (const key of Object.keys(changes)) {
    if (!allowedKeys.has(key)) {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            'command.invalid-payload',
            `Unknown command change property "${key}".`,
            `${path}/${key}`,
            [current.id],
          ),
        ]),
      });
    }
    const value = changes[key];
    if (value === undefined) {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            'command.invalid-payload',
            'Explicit undefined is not valid command data.',
            `${path}/${key}`,
            [current.id],
          ),
        ]),
      });
    }
    if (value === null) {
      if (!clearableKeys.has(key)) {
        return Object.freeze({
          diagnostics: Object.freeze([
            diagnostic(
              'command.invalid-clear',
              `Property "${key}" cannot be cleared.`,
              `${path}/${key}`,
              [current.id],
            ),
          ]),
        });
      }
      delete merged[key];
      continue;
    }
    merged[key] = value;
  }
  return normalizeCommandRecord(collection, merged, path);
}

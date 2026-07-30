import type { Diagnostic, DiagnosticCode } from '../diagnostics';
import type { JsonObject } from '../json';
import type { EntityId } from '../types';

type ZodIssue = {
  readonly code: string;
  readonly keys?: readonly string[];
  readonly message: string;
  readonly path?: readonly PropertyKey[];
};

const ENUM_FIELDS = new Set(['kind', 'mode', 'type', 'unit']);
const INSTANT_FIELDS = new Set(['end', 'start']);
const LOCAL_DATE_FIELDS = new Set(['endDate', 'startDate']);
const NUMBER_FIELDS = new Set(['allocation', 'capacity', 'height', 'order', 'progress', 'value']);

export function structuralIssueCode(issue: ZodIssue, fallback: DiagnosticCode): DiagnosticCode {
  const field = issue.path?.at(-1);
  if (field === 'id' || (typeof field === 'string' && field.endsWith('Id'))) {
    return 'value.invalid-id';
  }
  if (field === 'description' || field === 'role' || field === 'title' || field === 'variant') {
    return 'value.invalid-string';
  }
  if (typeof field === 'string' && ENUM_FIELDS.has(field)) {
    return 'value.invalid-enum';
  }
  if (typeof field === 'string' && INSTANT_FIELDS.has(field)) {
    return 'value.invalid-instant';
  }
  if (typeof field === 'string' && LOCAL_DATE_FIELDS.has(field)) {
    return 'value.invalid-all-day-date';
  }
  if (
    issue.message.includes('JSON') ||
    issue.path?.includes('fields') ||
    issue.path?.includes('metadata')
  ) {
    return 'value.invalid-json';
  }
  if (
    issue.message === 'bounded-number' ||
    issue.message === 'finite-number' ||
    (typeof field === 'string' && NUMBER_FIELDS.has(field))
  ) {
    return 'value.invalid-number';
  }
  return fallback;
}

export function pointer(parent: string, path: readonly PropertyKey[]): string {
  return path.reduce<string>((value, key) => {
    const escaped = String(key).replaceAll('~', '~0').replaceAll('/', '~1');
    return `${value}/${escaped}`;
  }, parent);
}

export interface IssueDiagnosticOptions {
  readonly code: DiagnosticCode;
  readonly entityIds?: readonly EntityId[];
  readonly path: string;
}

/** Converts private Zod issues into stable, implementation-independent diagnostics. */
export function issuesToDiagnostics(
  issues: readonly ZodIssue[],
  options: IssueDiagnosticOptions,
): readonly Diagnostic[] {
  const diagnostics = issues.flatMap((issue): Diagnostic[] => {
    if (issue.code === 'unrecognized_keys' && issue.keys !== undefined) {
      return [...issue.keys].sort().map((key) => ({
        code: 'value.unknown-property',
        details: { property: key } satisfies JsonObject,
        ...(options.entityIds === undefined ? {} : { entityIds: options.entityIds }),
        message: `Unknown property "${key}" was ignored.`,
        path: pointer(options.path, [key]),
        severity: 'warning',
      }));
    }
    return [
      {
        code: structuralIssueCode(issue, options.code),
        ...(options.entityIds === undefined ? {} : { entityIds: options.entityIds }),
        message: issue.message,
        path: pointer(options.path, issue.path ?? []),
        severity: 'error',
      },
    ];
  });
  return Object.freeze(diagnostics);
}

import type { Diagnostic } from './diagnostics';

export const CURRENT_SCHEMA_VERSION = 1;

type WireDocument = Record<string, unknown>;

interface WireMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: WireDocument) => WireDocument;
}

export interface WireMigrationResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly sourceSchemaVersion?: number;
  readonly value?: WireDocument;
}

const migrations: readonly WireMigration[] = Object.freeze([]);

function isWireDocument(input: unknown): input is WireDocument {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function fatal(code: Diagnostic['code'], message: string, path?: string): WireMigrationResult {
  return {
    diagnostics: [
      {
        code,
        message,
        ...(path === undefined ? {} : { path }),
        severity: 'error',
      },
    ],
  };
}

export function migrateWireDocument(input: unknown): WireMigrationResult {
  if (!isWireDocument(input)) {
    return fatal('document.invalid-root', 'The document root must be a plain object.');
  }

  if (!Object.hasOwn(input, 'schemaVersion')) {
    return fatal(
      'schema.missing-version',
      'The document root must declare a schema version.',
      '/schemaVersion',
    );
  }

  const sourceSchemaVersion = input.schemaVersion;
  if (
    typeof sourceSchemaVersion !== 'number' ||
    !Number.isInteger(sourceSchemaVersion) ||
    sourceSchemaVersion <= 0
  ) {
    return fatal(
      'schema.invalid-version',
      'The document schema version must be a positive integer.',
      '/schemaVersion',
    );
  }

  if (sourceSchemaVersion > CURRENT_SCHEMA_VERSION) {
    return fatal(
      'schema.unsupported-version',
      `Schema version ${sourceSchemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`,
      '/schemaVersion',
    );
  }

  let version = sourceSchemaVersion;
  let value = input;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration || migration.to !== version + 1) {
      return {
        diagnostics: [
          {
            code: 'schema.migration-missing',
            details: { from: version, to: version + 1 },
            message: `No complete migration path exists from schema version ${sourceSchemaVersion}.`,
            path: '/schemaVersion',
            severity: 'error',
          },
        ],
        sourceSchemaVersion,
      };
    }

    value = migration.migrate(value);
    version = migration.to;
  }

  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      diagnostics: [
        {
          code: 'schema.migration-result',
          details: { expected: CURRENT_SCHEMA_VERSION },
          message: 'The migration pipeline did not produce the current schema version.',
          path: '/schemaVersion',
          severity: 'error',
        },
      ],
      sourceSchemaVersion,
    };
  }

  return { diagnostics: [], sourceSchemaVersion, value };
}

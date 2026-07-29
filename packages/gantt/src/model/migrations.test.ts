import { describe, expect, it } from 'vite-plus/test';

import { CURRENT_SCHEMA_VERSION, migrateWireDocument } from './migrations';

describe('wire document migrations', () => {
  it.each([
    { expected: 'document.invalid-root', input: null },
    { expected: 'document.invalid-root', input: [] },
    { expected: 'document.invalid-root', input: new Date(0) },
    { expected: 'schema.missing-version', input: {} },
    { expected: 'schema.invalid-version', input: { schemaVersion: 0 } },
    { expected: 'schema.invalid-version', input: { schemaVersion: 1.5 } },
    { expected: 'schema.invalid-version', input: { schemaVersion: '1' } },
    { expected: 'schema.unsupported-version', input: { schemaVersion: 2 } },
  ])('rejects a fatal boundary with $expected', ({ expected, input }) => {
    const result = migrateWireDocument(input);

    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({
      code: expected,
      severity: 'error',
    });
  });

  it('accepts the current version without mutating the wire object', () => {
    const input = Object.freeze({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: Object.freeze([{ id: 'task-a' }]),
    });

    const result = migrateWireDocument(input);

    expect(result).toMatchObject({
      diagnostics: [],
      sourceSchemaVersion: CURRENT_SCHEMA_VERSION,
      value: input,
    });
    expect(input).toEqual({ schemaVersion: 1, tasks: [{ id: 'task-a' }] });
  });
});

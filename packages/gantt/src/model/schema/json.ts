import * as z from 'zod/mini';

import type { JsonObject, JsonValue } from '../json';

export interface JsonCloneIssue {
  readonly message: string;
  readonly path: readonly (number | string)[];
}

export type JsonCloneResult =
  | { readonly issue: JsonCloneIssue; readonly success: false }
  | { readonly data: JsonValue; readonly success: true };

function isPlainObject(input: object): input is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(
  input: unknown,
  path: readonly (number | string)[],
  ancestors: WeakSet<object>,
): JsonCloneResult {
  if (input === null || typeof input === 'boolean' || typeof input === 'string') {
    return { data: input, success: true };
  }
  if (typeof input === 'number') {
    return Number.isFinite(input)
      ? { data: input, success: true }
      : { issue: { message: 'JSON numbers must be finite.', path }, success: false };
  }
  if (typeof input !== 'object') {
    return {
      issue: { message: 'Expected a JSON-compatible value.', path },
      success: false,
    };
  }
  if (ancestors.has(input)) {
    return {
      issue: { message: 'Cyclic values are not JSON-compatible.', path },
      success: false,
    };
  }

  ancestors.add(input);
  if (Array.isArray(input)) {
    const output: JsonValue[] = [];
    for (let index = 0; index < input.length; index += 1) {
      if (!Object.hasOwn(input, index)) {
        ancestors.delete(input);
        return {
          issue: { message: 'Sparse arrays are not JSON-compatible.', path: [...path, index] },
          success: false,
        };
      }
      const item = cloneJson(input[index], [...path, index], ancestors);
      if (!item.success) {
        ancestors.delete(input);
        return item;
      }
      output.push(item.data);
    }
    ancestors.delete(input);
    return { data: Object.freeze(output), success: true };
  }
  if (!isPlainObject(input)) {
    ancestors.delete(input);
    return {
      issue: { message: 'JSON objects must be plain objects.', path },
      success: false,
    };
  }

  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(input).sort()) {
    const item = cloneJson(input[key], [...path, key], ancestors);
    if (!item.success) {
      ancestors.delete(input);
      return item;
    }
    Object.defineProperty(output, key, {
      configurable: false,
      enumerable: true,
      value: item.data,
      writable: false,
    });
  }
  ancestors.delete(input);
  return { data: Object.freeze(output), success: true };
}

export function cloneJsonValue(input: unknown): JsonCloneResult {
  return cloneJson(input, [], new WeakSet());
}

export function cloneJsonObject(input: unknown): JsonCloneResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      issue: { message: 'Expected a JSON-compatible plain object.', path: [] },
      success: false,
    };
  }
  return cloneJsonValue(input);
}

export const jsonObjectSchema = z.pipe(
  z.custom<unknown>(() => true),
  z.transform((input, context): JsonObject => {
    const result = cloneJsonObject(input);
    if (result.success && !Array.isArray(result.data) && typeof result.data === 'object') {
      return result.data as JsonObject;
    }
    const issue = result.success
      ? { message: 'Expected a JSON-compatible plain object.', path: [] }
      : result.issue;
    context.issues.push({
      code: 'custom',
      input,
      message: issue.message,
      path: [...issue.path],
    });
    return z.NEVER;
  }),
);

import * as z from 'zod/mini';

type SchemaShape = Readonly<Record<string, z.ZodMiniType>>;

export interface ObjectSchemaPair<T extends SchemaShape> {
  readonly canonical: z.ZodMiniObject<T, z.core.$strict>;
  readonly knownKeys: ReadonlySet<string>;
  readonly wire: z.ZodMiniObject<T, z.core.$strip>;
}

/**
 * Keeps structural parsing and unknown-property reporting on the same key definition.
 * Wire parsing strips keys after the codec reports them; canonical parsing rejects them.
 */
export function objectSchemaPair<const T extends SchemaShape>(shape: T): ObjectSchemaPair<T> {
  return Object.freeze({
    canonical: z.strictObject(shape),
    knownKeys: new Set(Object.keys(shape)),
    wire: z.object(shape),
  });
}

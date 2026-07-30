import * as z from 'zod/mini';

import type {
  DependencyType,
  DurationMode,
  DurationUnit,
  EntityId,
  LocalDateString,
  TaskKind,
} from '../types';
import { isCanonicalAppearanceVariant, normalizeAppearanceVariant } from '../appearance';

const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const finiteNumberSchema = z.number('finite-number');

export function boundedNumberSchema(options: {
  readonly maximum?: number;
  readonly minimum?: number;
}) {
  return finiteNumberSchema.check(
    z.refine(
      (value) =>
        (options.minimum === undefined || value >= options.minimum) &&
        (options.maximum === undefined || value <= options.maximum),
      { message: 'bounded-number' },
    ),
  );
}

export const canonicalEntityIdSchema = z
  .string('entity-id')
  .check(z.refine((value) => value.length > 0, { message: 'entity-id' }));

export const wireEntityIdSchema = z.pipe(
  z.union([canonicalEntityIdSchema, finiteNumberSchema], 'entity-id'),
  z.transform((value): EntityId => (typeof value === 'number' ? String(value) : value)),
);

const appearanceVariantStringSchema = z.string('appearance-variant');

export const canonicalAppearanceVariantSchema = appearanceVariantStringSchema.check(
  z.refine(isCanonicalAppearanceVariant, { message: 'appearance-variant' }),
);

export const wireAppearanceVariantSchema = z
  .pipe(appearanceVariantStringSchema, z.transform(normalizeAppearanceVariant))
  .check(z.refine(isCanonicalAppearanceVariant, { message: 'appearance-variant' }));

export const revisionSchema = z.union([z.string(), finiteNumberSchema]);

export const taskKindSchema = z.literal([
  'task',
  'summary',
  'milestone',
]) satisfies z.ZodMiniType<TaskKind>;
export const durationModeSchema = z.literal([
  'elapsed',
  'working',
]) satisfies z.ZodMiniType<DurationMode>;
export const durationUnitSchema = z.literal([
  'millisecond',
  'minute',
  'hour',
  'day',
]) satisfies z.ZodMiniType<DurationUnit>;
export const dependencyTypeSchema = z.literal([
  'finish-to-start',
  'start-to-start',
  'finish-to-finish',
  'start-to-finish',
]) satisfies z.ZodMiniType<DependencyType>;

function isCalendarDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}

export const localDateSchema = z
  .string('local-date')
  .check(
    z.refine(isCalendarDate, { message: 'local-date' }),
  ) satisfies z.ZodMiniType<LocalDateString>;

const explicitOffsetInstantStringSchema = z.string('instant').check(
  z.refine((value) => INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value)), {
    message: 'instant',
  }),
);

export const wireInstantSchema = z.pipe(
  z.union([finiteNumberSchema, explicitOffsetInstantStringSchema], 'instant'),
  z.transform((value): number => (typeof value === 'number' ? value : Date.parse(value))),
);

export const canonicalInstantSchema = finiteNumberSchema;

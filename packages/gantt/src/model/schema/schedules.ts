import * as z from 'zod/mini';

import type {
  AllDayTaskSchedule,
  DurationValue,
  InstantTaskSchedule,
  TaskSchedule,
} from '../types';
import { objectSchemaPair } from './object';
import {
  boundedNumberSchema,
  canonicalInstantSchema,
  durationModeSchema,
  durationUnitSchema,
  finiteNumberSchema,
  localDateSchema,
  wireInstantSchema,
} from './scalars';

function orderedInstant<T extends z.ZodMiniType<{ end: number; start: number }>>(schema: T): T {
  return schema.check(
    z.refine((value) => value.end >= value.start, {
      message: 'instant-order',
      path: ['end'],
    }),
  );
}

function orderedAllDay<T extends z.ZodMiniType<{ endDate: string; startDate: string }>>(
  schema: T,
): T {
  return schema.check(
    z.refine((value) => value.endDate >= value.startDate, {
      message: 'local-date-order',
      path: ['endDate'],
    }),
  );
}

const wireInstantShape = {
  end: wireInstantSchema,
  mode: z.literal('instant'),
  start: wireInstantSchema,
};
const canonicalInstantShape = {
  end: canonicalInstantSchema,
  mode: z.literal('instant'),
  start: canonicalInstantSchema,
};
const wireAllDayShape = {
  endDate: localDateSchema,
  mode: z.literal('all-day'),
  startDate: localDateSchema,
};

export const wireInstantScheduleDefinition = objectSchemaPair(wireInstantShape);
export const canonicalInstantScheduleDefinition = objectSchemaPair(canonicalInstantShape);
export const wireAllDayScheduleDefinition = objectSchemaPair(wireAllDayShape);
export const canonicalAllDayScheduleDefinition = objectSchemaPair(wireAllDayShape);

export const wireInstantScheduleSchema = orderedInstant(
  wireInstantScheduleDefinition.wire,
) satisfies z.ZodMiniType<InstantTaskSchedule>;
export const canonicalInstantScheduleSchema = orderedInstant(
  canonicalInstantScheduleDefinition.canonical,
) satisfies z.ZodMiniType<InstantTaskSchedule>;
export const wireAllDayScheduleSchema = orderedAllDay(
  wireAllDayScheduleDefinition.wire,
) satisfies z.ZodMiniType<AllDayTaskSchedule>;
export const canonicalAllDayScheduleSchema = orderedAllDay(
  canonicalAllDayScheduleDefinition.canonical,
) satisfies z.ZodMiniType<AllDayTaskSchedule>;

export const wireTaskScheduleSchema = z.discriminatedUnion('mode', [
  wireInstantScheduleSchema,
  wireAllDayScheduleSchema,
]) satisfies z.ZodMiniType<TaskSchedule>;
export const canonicalTaskScheduleSchema = z.discriminatedUnion('mode', [
  canonicalInstantScheduleSchema,
  canonicalAllDayScheduleSchema,
]) satisfies z.ZodMiniType<TaskSchedule>;

function durationDefinition(valueSchema: z.ZodMiniType<number>) {
  return objectSchemaPair({
    mode: z.exactOptional(durationModeSchema),
    unit: durationUnitSchema,
    value: valueSchema,
  });
}

export const wireEffortDurationDefinition = durationDefinition(boundedNumberSchema({ minimum: 0 }));
export const wireLagDurationDefinition = durationDefinition(finiteNumberSchema);
export const canonicalEffortDurationDefinition = durationDefinition(
  boundedNumberSchema({ minimum: 0 }),
);
export const canonicalLagDurationDefinition = durationDefinition(finiteNumberSchema);

export const wireEffortDurationSchema =
  wireEffortDurationDefinition.wire satisfies z.ZodMiniType<DurationValue>;
export const wireLagDurationSchema =
  wireLagDurationDefinition.wire satisfies z.ZodMiniType<DurationValue>;
export const canonicalEffortDurationSchema =
  canonicalEffortDurationDefinition.canonical satisfies z.ZodMiniType<DurationValue>;
export const canonicalLagDurationSchema =
  canonicalLagDurationDefinition.canonical satisfies z.ZodMiniType<DurationValue>;

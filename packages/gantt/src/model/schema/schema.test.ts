import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import type {
  AssignmentRecord,
  DependencyRecord,
  DurationValue,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
  TaskSchedule,
} from '../types';
import { issuesToDiagnostics } from './issues';
import { jsonObjectSchema } from './json';
import { objectSchemaPair } from './object';
import {
  canonicalAssignmentSchema,
  canonicalDependencySchema,
  canonicalLaneSchema,
  canonicalPlacementSchema,
  canonicalResourceSchema,
  canonicalTaskSchema,
  wireTaskShellSchema,
} from './records';
import {
  canonicalEntityIdSchema,
  canonicalAppearanceVariantSchema,
  localDateSchema,
  wireAppearanceVariantSchema,
  wireEntityIdSchema,
  wireInstantSchema,
} from './scalars';
import {
  canonicalEffortDurationSchema,
  canonicalTaskScheduleSchema,
  wireTaskScheduleSchema,
} from './schedules';

describe('private runtime schema foundations', () => {
  it('normalizes only supported wire IDs and explicit-offset instants', () => {
    expect(wireEntityIdSchema.safeParse(42)).toMatchObject({ data: '42', success: true });
    expect(canonicalEntityIdSchema.safeParse(42).success).toBe(false);
    expect(wireEntityIdSchema.safeParse('').success).toBe(false);
    expect(wireInstantSchema.safeParse('2026-07-30T10:00:00Z').success).toBe(true);
    expect(wireInstantSchema.safeParse('2026-07-30T10:00:00').success).toBe(false);
  });

  it('normalizes bounded semantic appearance variants without losing unknown IDs', () => {
    expect(wireAppearanceVariantSchema.safeParse('  customer:blocked  ')).toMatchObject({
      data: 'customer:blocked',
      success: true,
    });
    expect(canonicalAppearanceVariantSchema.safeParse('customer:blocked').success).toBe(true);
    expect(canonicalAppearanceVariantSchema.safeParse(' customer:blocked ').success).toBe(false);
    expect(wireAppearanceVariantSchema.safeParse(' \t ').success).toBe(false);
    expect(wireAppearanceVariantSchema.safeParse('bad\u0000variant').success).toBe(false);
    expect(wireAppearanceVariantSchema.safeParse('a'.repeat(65)).success).toBe(false);
    expect(wireAppearanceVariantSchema.safeParse('🎨'.repeat(64)).success).toBe(true);
  });

  it('validates calendar dates and schedule ordering', () => {
    expect(localDateSchema.safeParse('2028-02-29').success).toBe(true);
    expect(localDateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(wireTaskScheduleSchema.safeParse({ mode: 'instant', start: 2, end: 1 }).success).toBe(
      false,
    );
    expect(
      canonicalTaskScheduleSchema.safeParse({
        mode: 'instant',
        start: '2026-07-30T10:00:00Z',
        end: '2026-07-30T11:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('clones JSON extensions with sorted keys and rejects unsafe graphs', () => {
    const input = { z: 1, a: { b: true } };
    const result = jsonObjectSchema.safeParse(input);
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(['a', 'z']);
      expect(result.data).not.toBe(input);
      expect(Object.isFrozen(result.data)).toBe(true);
    }

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(jsonObjectSchema.safeParse(cycle).success).toBe(false);
    expect(jsonObjectSchema.safeParse(new Date()).success).toBe(false);
    expect(jsonObjectSchema.safeParse(Array.from({ length: 2 })).success).toBe(false);
  });

  it('derives known keys and maps issues without exposing Zod issue objects', () => {
    const definition = objectSchemaPair({ title: canonicalEntityIdSchema });
    expect(definition.knownKeys).toEqual(new Set(['title']));
    const result = definition.canonical.safeParse({ title: 'ok', typo: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        issuesToDiagnostics(result.error.issues, { code: 'record.invalid-task', path: '/tasks/0' }),
      ).toMatchObject([
        {
          code: 'value.unknown-property',
          path: '/tasks/0/typo',
          severity: 'warning',
        },
      ]);
    }
  });

  it('keeps canonical public scalar contracts bidirectionally assignable', () => {
    expectTypeOf(
      canonicalTaskScheduleSchema.parse({ mode: 'instant', start: 0, end: 1 }),
    ).toMatchTypeOf<TaskSchedule>();
    expectTypeOf<TaskSchedule>().toMatchTypeOf<
      ReturnType<typeof canonicalTaskScheduleSchema.parse>
    >();
    expectTypeOf(
      canonicalEffortDurationSchema.parse({ value: 1, unit: 'day' }),
    ).toMatchTypeOf<DurationValue>();
    expectTypeOf<DurationValue>().toMatchTypeOf<
      ReturnType<typeof canonicalEffortDurationSchema.parse>
    >();
  });

  it('keeps every canonical record schema bidirectionally assignable to public types', () => {
    expectTypeOf<ReturnType<typeof canonicalTaskSchema.parse>>().toMatchTypeOf<TaskRecord>();
    expectTypeOf<TaskRecord>().toMatchTypeOf<ReturnType<typeof canonicalTaskSchema.parse>>();
    expectTypeOf<
      ReturnType<typeof canonicalResourceSchema.parse>
    >().toMatchTypeOf<ResourceRecord>();
    expectTypeOf<ResourceRecord>().toMatchTypeOf<
      ReturnType<typeof canonicalResourceSchema.parse>
    >();
    expectTypeOf<ReturnType<typeof canonicalLaneSchema.parse>>().toMatchTypeOf<LaneRecord>();
    expectTypeOf<LaneRecord>().toMatchTypeOf<ReturnType<typeof canonicalLaneSchema.parse>>();
    expectTypeOf<
      ReturnType<typeof canonicalAssignmentSchema.parse>
    >().toMatchTypeOf<AssignmentRecord>();
    expectTypeOf<AssignmentRecord>().toMatchTypeOf<
      ReturnType<typeof canonicalAssignmentSchema.parse>
    >();
    expectTypeOf<
      ReturnType<typeof canonicalPlacementSchema.parse>
    >().toMatchTypeOf<PlacementRecord>();
    expectTypeOf<PlacementRecord>().toMatchTypeOf<
      ReturnType<typeof canonicalPlacementSchema.parse>
    >();
    expectTypeOf<
      ReturnType<typeof canonicalDependencySchema.parse>
    >().toMatchTypeOf<DependencyRecord>();
    expectTypeOf<DependencyRecord>().toMatchTypeOf<
      ReturnType<typeof canonicalDependencySchema.parse>
    >();
  });

  it('keeps wire defaults separate from strict canonical command records', () => {
    expect(wireTaskShellSchema.safeParse({ id: 1, title: 'Wire task' })).toMatchObject({
      data: { id: '1', kind: 'task', title: 'Wire task' },
      success: true,
    });
    expect(canonicalTaskSchema.safeParse({ id: 1, title: 'Command task' }).success).toBe(false);
    expect(
      canonicalTaskSchema.safeParse({
        id: 'task-1',
        kind: 'task',
        segments: [],
        title: 'Command task',
        typo: true,
      }).success,
    ).toBe(false);
  });
});

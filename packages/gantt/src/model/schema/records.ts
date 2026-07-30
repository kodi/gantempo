import * as z from 'zod/mini';

import type {
  AssignmentRecord,
  DependencyRecord,
  LaneRecord,
  PlacementRecord,
  ResourceRecord,
  TaskRecord,
  TaskSegment,
} from '../types';
import { jsonObjectSchema } from './json';
import { objectSchemaPair } from './object';
import {
  boundedNumberSchema,
  canonicalEntityIdSchema,
  dependencyTypeSchema,
  finiteNumberSchema,
  taskKindSchema,
  wireEntityIdSchema,
} from './scalars';
import {
  canonicalEffortDurationSchema,
  canonicalLagDurationSchema,
  canonicalTaskScheduleSchema,
  wireEffortDurationSchema,
  wireLagDurationSchema,
  wireTaskScheduleSchema,
} from './schedules';

const wireOptionalId = z.exactOptional(wireEntityIdSchema);
const canonicalOptionalId = z.exactOptional(canonicalEntityIdSchema);
const optionalFields = z.exactOptional(jsonObjectSchema);

export const wireTaskSegmentDefinition = objectSchemaPair({
  fields: optionalFields,
  id: wireEntityIdSchema,
  schedule: wireTaskScheduleSchema,
});
export const canonicalTaskSegmentDefinition = objectSchemaPair({
  fields: optionalFields,
  id: canonicalEntityIdSchema,
  schedule: canonicalTaskScheduleSchema,
});

export const wireTaskSegmentSchema =
  wireTaskSegmentDefinition.wire satisfies z.ZodMiniType<TaskSegment>;
export const canonicalTaskSegmentSchema = z.readonly(
  canonicalTaskSegmentDefinition.canonical,
) satisfies z.ZodMiniType<TaskSegment>;

/**
 * Wire tasks keep the raw segments member opaque so the codec can recover each segment
 * independently. The final canonical task schema validates the reconstructed record.
 */
export const wireTaskShellDefinition = objectSchemaPair({
  fields: optionalFields,
  id: wireEntityIdSchema,
  kind: z._default(taskKindSchema, 'task'),
  parentId: wireOptionalId,
  progress: z.exactOptional(boundedNumberSchema({ maximum: 1, minimum: 0 })),
  schedule: z.exactOptional(wireTaskScheduleSchema),
  segments: z.exactOptional(z.unknown()),
  title: z.string(),
});

export const canonicalTaskDefinition = objectSchemaPair({
  fields: optionalFields,
  id: canonicalEntityIdSchema,
  kind: taskKindSchema,
  parentId: canonicalOptionalId,
  progress: z.exactOptional(boundedNumberSchema({ maximum: 1, minimum: 0 })),
  schedule: z.exactOptional(canonicalTaskScheduleSchema),
  segments: z.readonly(z.array(canonicalTaskSegmentSchema)),
  title: z.string(),
});

export const wireTaskShellSchema = wireTaskShellDefinition.wire;
export const canonicalTaskSchema = z.readonly(
  canonicalTaskDefinition.canonical,
) satisfies z.ZodMiniType<TaskRecord>;

export const wireResourceDefinition = objectSchemaPair({
  capacity: z.exactOptional(boundedNumberSchema({ minimum: 0 })),
  fields: optionalFields,
  id: wireEntityIdSchema,
  parentId: wireOptionalId,
  title: z.string(),
});
export const canonicalResourceDefinition = objectSchemaPair({
  capacity: z.exactOptional(boundedNumberSchema({ minimum: 0 })),
  fields: optionalFields,
  id: canonicalEntityIdSchema,
  parentId: canonicalOptionalId,
  title: z.string(),
});

export const wireResourceSchema =
  wireResourceDefinition.wire satisfies z.ZodMiniType<ResourceRecord>;
export const canonicalResourceSchema = z.readonly(
  canonicalResourceDefinition.canonical,
) satisfies z.ZodMiniType<ResourceRecord>;

export const wireLaneDefinition = objectSchemaPair({
  fields: optionalFields,
  height: z.exactOptional(boundedNumberSchema({ minimum: Number.MIN_VALUE })),
  id: wireEntityIdSchema,
  order: z.exactOptional(finiteNumberSchema),
  parentId: wireOptionalId,
  resourceId: wireOptionalId,
  title: z.string(),
});
export const canonicalLaneDefinition = objectSchemaPair({
  fields: optionalFields,
  height: z.exactOptional(boundedNumberSchema({ minimum: Number.MIN_VALUE })),
  id: canonicalEntityIdSchema,
  order: z.exactOptional(finiteNumberSchema),
  parentId: canonicalOptionalId,
  resourceId: canonicalOptionalId,
  title: z.string(),
});

export const wireLaneSchema = wireLaneDefinition.wire satisfies z.ZodMiniType<LaneRecord>;
export const canonicalLaneSchema = z.readonly(
  canonicalLaneDefinition.canonical,
) satisfies z.ZodMiniType<LaneRecord>;

export const wireAssignmentDefinition = objectSchemaPair({
  allocation: z.exactOptional(boundedNumberSchema({ minimum: 0 })),
  effort: z.exactOptional(wireEffortDurationSchema),
  fields: optionalFields,
  id: wireEntityIdSchema,
  resourceId: wireEntityIdSchema,
  role: z.exactOptional(z.string()),
  taskId: wireEntityIdSchema,
});
export const canonicalAssignmentDefinition = objectSchemaPair({
  allocation: z.exactOptional(boundedNumberSchema({ minimum: 0 })),
  effort: z.exactOptional(canonicalEffortDurationSchema),
  fields: optionalFields,
  id: canonicalEntityIdSchema,
  resourceId: canonicalEntityIdSchema,
  role: z.exactOptional(z.string()),
  taskId: canonicalEntityIdSchema,
});

export const wireAssignmentSchema =
  wireAssignmentDefinition.wire satisfies z.ZodMiniType<AssignmentRecord>;
export const canonicalAssignmentSchema = z.readonly(
  canonicalAssignmentDefinition.canonical,
) satisfies z.ZodMiniType<AssignmentRecord>;

export const wirePlacementDefinition = objectSchemaPair({
  assignmentId: wireOptionalId,
  fields: optionalFields,
  id: wireEntityIdSchema,
  laneId: wireEntityIdSchema,
  order: z.exactOptional(finiteNumberSchema),
  segmentId: wireOptionalId,
  taskId: wireEntityIdSchema,
});
export const canonicalPlacementDefinition = objectSchemaPair({
  assignmentId: canonicalOptionalId,
  fields: optionalFields,
  id: canonicalEntityIdSchema,
  laneId: canonicalEntityIdSchema,
  order: z.exactOptional(finiteNumberSchema),
  segmentId: canonicalOptionalId,
  taskId: canonicalEntityIdSchema,
});

export const wirePlacementSchema =
  wirePlacementDefinition.wire satisfies z.ZodMiniType<PlacementRecord>;
export const canonicalPlacementSchema = z.readonly(
  canonicalPlacementDefinition.canonical,
) satisfies z.ZodMiniType<PlacementRecord>;

export const wireDependencyDefinition = objectSchemaPair({
  fields: optionalFields,
  fromTaskId: wireEntityIdSchema,
  id: wireEntityIdSchema,
  lag: z.exactOptional(wireLagDurationSchema),
  toTaskId: wireEntityIdSchema,
  type: dependencyTypeSchema,
});
export const canonicalDependencyDefinition = objectSchemaPair({
  fields: optionalFields,
  fromTaskId: canonicalEntityIdSchema,
  id: canonicalEntityIdSchema,
  lag: z.exactOptional(canonicalLagDurationSchema),
  toTaskId: canonicalEntityIdSchema,
  type: dependencyTypeSchema,
});

export const wireDependencySchema =
  wireDependencyDefinition.wire satisfies z.ZodMiniType<DependencyRecord>;
export const canonicalDependencySchema = z.readonly(
  canonicalDependencyDefinition.canonical,
) satisfies z.ZodMiniType<DependencyRecord>;

export const wireRecordSchemas = Object.freeze({
  assignments: wireAssignmentSchema,
  dependencies: wireDependencySchema,
  lanes: wireLaneSchema,
  placements: wirePlacementSchema,
  resources: wireResourceSchema,
  tasks: wireTaskShellSchema,
});

export const canonicalRecordSchemas = Object.freeze({
  assignments: canonicalAssignmentSchema,
  dependencies: canonicalDependencySchema,
  lanes: canonicalLaneSchema,
  placements: canonicalPlacementSchema,
  resources: canonicalResourceSchema,
  tasks: canonicalTaskSchema,
});

export const recordKnownKeys = Object.freeze({
  assignments: wireAssignmentDefinition.knownKeys,
  dependencies: wireDependencyDefinition.knownKeys,
  lanes: wireLaneDefinition.knownKeys,
  placements: wirePlacementDefinition.knownKeys,
  resources: wireResourceDefinition.knownKeys,
  tasks: wireTaskShellDefinition.knownKeys,
});

import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import type { EntityId } from '../model/types';
import { cloneInteractionTarget } from '../runtime/session';
import type { GanttLaneTarget, GanttTaskTarget } from '../runtime/types';
import type {
  InteractionCommandMappingResult,
  InteractionCreateTaskMapperIntent,
  InteractionIntent,
  InteractionMoveOccurrenceMapperIntent,
  MapInteractionIntentOptions,
} from './types';

function diagnostic(
  code: Diagnostic['code'],
  message: string,
  entityIds?: readonly EntityId[],
): Diagnostic {
  return Object.freeze({
    code,
    ...(entityIds === undefined ? {} : { entityIds: Object.freeze([...entityIds]) }),
    message,
    path: '/interaction',
    severity: 'error',
  });
}

function rejected(item: Diagnostic): InteractionCommandMappingResult {
  return Object.freeze({ diagnostic: item, status: 'rejected' });
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndFreezeData(input: unknown, ancestors = new Set<object>()): unknown {
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'boolean' ||
    (typeof input === 'number' && Number.isFinite(input))
  ) {
    return input;
  }
  if (typeof input !== 'object' || input === null || ancestors.has(input)) {
    throw new TypeError('Interaction mapper command data must be finite, acyclic plain data.');
  }
  ancestors.add(input);
  const output = Array.isArray(input)
    ? input.map((item) => cloneAndFreezeData(item, ancestors))
    : Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, cloneAndFreezeData(value, ancestors)]),
      );
  ancestors.delete(input);
  return Object.freeze(output);
}

function freezeCommand(command: GanttCommand): GanttCommand {
  const frozen = cloneAndFreezeData(command);
  if (!isPlainObject(frozen) || typeof frozen.type !== 'string') {
    throw new TypeError('An interaction mapper must return a command with a string type.');
  }
  return frozen as unknown as GanttCommand;
}

function freezeDiagnostic(input: Diagnostic): Diagnostic {
  if (
    !isPlainObject(input) ||
    typeof input.code !== 'string' ||
    typeof input.message !== 'string' ||
    !['error', 'info', 'warning'].includes(String(input.severity))
  ) {
    throw new TypeError('An interaction mapper rejection requires a valid diagnostic.');
  }
  return Object.freeze({
    code: input.code,
    ...(input.details === undefined
      ? {}
      : { details: cloneAndFreezeData(input.details) as NonNullable<Diagnostic['details']> }),
    ...(input.entityIds === undefined ? {} : { entityIds: Object.freeze([...input.entityIds]) }),
    message: input.message,
    ...(input.path === undefined ? {} : { path: input.path }),
    severity: input.severity,
  });
}

function mapped(command: GanttCommand): InteractionCommandMappingResult {
  return Object.freeze({ command: freezeCommand(command), status: 'mapped' });
}

function laneTarget(target: GanttLaneTarget): GanttLaneTarget {
  return cloneInteractionTarget(target) as GanttLaneTarget;
}

function taskTarget(target: GanttTaskTarget): GanttTaskTarget {
  return cloneInteractionTarget(target) as GanttTaskTarget;
}

function invokeMapper(
  mapper:
    | ((intent: InteractionCreateTaskMapperIntent) => InteractionCommandMappingResult)
    | ((intent: InteractionMoveOccurrenceMapperIntent) => InteractionCommandMappingResult),
  intent: InteractionCreateTaskMapperIntent | InteractionMoveOccurrenceMapperIntent,
): InteractionCommandMappingResult {
  try {
    const result = (mapper as (value: typeof intent) => InteractionCommandMappingResult)(intent);
    if (result?.status === 'mapped') {
      return mapped(result.command);
    }
    if (result?.status === 'rejected') {
      return Object.freeze({
        diagnostic: freezeDiagnostic(result.diagnostic),
        status: 'rejected',
      });
    }
    return rejected(
      diagnostic(
        'command.invalid-payload',
        'Interaction mapper returned neither a mapped command nor a rejection.',
      ),
    );
  } catch {
    return rejected(
      diagnostic('runtime.callback-threw', 'Interaction command mapper threw an error.'),
    );
  }
}

function taskForIntent(
  intent: Exclude<InteractionIntent, { readonly kind: 'create' }>,
  options: MapInteractionIntentOptions,
): MapInteractionIntentOptions['document']['tasks'][number] | InteractionCommandMappingResult {
  const task = options.document.tasks.find((candidate) => candidate.id === intent.source.taskId);
  if (task === undefined) {
    return rejected(
      diagnostic(
        'command.missing-target',
        `Cannot interact with missing task "${intent.source.taskId}".`,
        [intent.source.taskId],
      ),
    );
  }
  if (task.schedule?.mode !== 'instant') {
    return rejected(
      diagnostic(
        'command.unsupported-schedule',
        `Task "${task.id}" requires an instant schedule for built-in interaction.`,
        [task.id],
      ),
    );
  }
  return task;
}

function ambiguousMove(
  intent: Extract<InteractionIntent, { readonly kind: 'move' }>,
  options: MapInteractionIntentOptions,
): InteractionCommandMappingResult {
  const mapper = options.mappers?.moveOccurrence;
  if (mapper === undefined) {
    return rejected(
      diagnostic(
        'command.unsupported-target',
        'This occurrence move requires an application command mapper.',
        [intent.source.taskId],
      ),
    );
  }
  const mapperIntent = Object.freeze({
    delta: intent.delta,
    destination: laneTarget(intent.destination),
    end: intent.end,
    kind: 'move-occurrence',
    source: taskTarget(intent.source),
    start: intent.start,
  }) satisfies InteractionMoveOccurrenceMapperIntent;
  return invokeMapper(mapper, mapperIntent);
}

export function mapInteractionIntent(
  intent: InteractionIntent,
  options: MapInteractionIntentOptions,
): InteractionCommandMappingResult {
  if (intent.kind === 'create') {
    const mapper = options.mappers?.createTask;
    if (mapper === undefined) {
      return rejected(
        diagnostic(
          'command.unsupported-target',
          'Task creation requires an application command mapper.',
        ),
      );
    }
    const mapperIntent = Object.freeze({
      destination: laneTarget(intent.destination),
      end: intent.end,
      kind: 'create',
      start: intent.start,
    }) satisfies InteractionCreateTaskMapperIntent;
    return invokeMapper(mapper, mapperIntent);
  }

  const task = taskForIntent(intent, options);
  if ('status' in task) {
    return task;
  }
  if (intent.kind === 'resize') {
    if (intent.source.segmentId !== undefined) {
      return rejected(
        diagnostic('command.unsupported-target', 'Built-in resize does not modify task segments.', [
          intent.source.taskId,
          intent.source.segmentId,
        ]),
      );
    }
    if (intent.end <= intent.start) {
      return rejected(
        diagnostic(
          'command.invalid-interval',
          'Resize intent must preserve a positive task interval.',
          [task.id],
        ),
      );
    }
    return mapped({
      edge: intent.edge,
      id: task.id,
      time: intent.time,
      type: 'task.resize',
    });
  }

  const crossesLane = intent.source.laneViewKey !== intent.destination.viewKey;
  if (intent.source.segmentId !== undefined) {
    return ambiguousMove(intent, options);
  }
  if (!crossesLane) {
    return mapped({ delta: intent.delta, id: task.id, type: 'task.move' });
  }
  if (intent.source.placementId === undefined || intent.destination.laneId === undefined) {
    return ambiguousMove(intent, options);
  }
  const placementMove: GanttCommand = {
    id: intent.source.placementId,
    laneId: intent.destination.laneId,
    type: 'placement.move',
  };
  if (intent.delta === 0) {
    return mapped(placementMove);
  }
  return mapped({
    commands: [{ delta: intent.delta, id: task.id, type: 'task.move' }, placementMove],
    type: 'transaction',
  });
}

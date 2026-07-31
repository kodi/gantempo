import { buildTaskHierarchyIndexes } from '../hierarchy/task-hierarchy';
import type { Diagnostic, DiagnosticCode } from '../model/diagnostics';
import type {
  EntityId,
  EpochMilliseconds,
  GanttDocument,
  TaskKind,
  TaskRecord,
  TaskSchedule,
} from '../model/types';
import { zonedStartOfDay } from '../time/zoned-start-of-day';

export interface ResolvedTaskPresentationInterval {
  readonly end: EpochMilliseconds;
  readonly source: 'canonical' | 'descendants';
  readonly start: EpochMilliseconds;
}

export interface ResolvedSummaryPresentation {
  readonly descendantCount: number;
  readonly resolvedDescendantCount: number;
  readonly unresolvedDescendantCount: number;
}

export interface ResolvedTaskPresentation {
  readonly interval?: ResolvedTaskPresentationInterval;
  readonly kind: TaskKind;
  readonly summary?: ResolvedSummaryPresentation;
  readonly taskId: EntityId;
}

export interface ResolveTaskPresentationsResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly presentations: readonly ResolvedTaskPresentation[];
}

interface ScheduleResolution {
  readonly diagnostics: readonly Diagnostic[];
  readonly interval?: ResolvedTaskPresentationInterval;
}

function diagnostic(
  code: DiagnosticCode,
  severity: Diagnostic['severity'],
  message: string,
  path: string,
  taskId: EntityId,
): Diagnostic {
  return Object.freeze({
    code,
    entityIds: Object.freeze([taskId]),
    message,
    path,
    severity,
  });
}

function resolveScheduleWithCache(
  task: TaskRecord,
  schedule: TaskSchedule | undefined,
  path: string,
  timeZone: string,
  milestone: boolean,
  allDayCache: Map<string, number | undefined>,
): ScheduleResolution {
  if (schedule === undefined) {
    return Object.freeze({
      diagnostics: Object.freeze([
        diagnostic(
          'layout.missing-schedule',
          'warning',
          `Task "${task.id}" has no usable presentation schedule.`,
          path,
          task.id,
        ),
      ]),
    });
  }

  let start: number;
  let end: number;
  if (schedule.mode === 'instant') {
    start = schedule.start;
    end = schedule.end;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            'layout.non-finite-interval',
            'error',
            `Task "${task.id}" has a non-finite presentation boundary.`,
            path,
            task.id,
          ),
        ]),
      });
    }
  } else {
    const resolveDate = (date: string) => {
      const cacheKey = `${timeZone}\u0000${date}`;
      if (!allDayCache.has(cacheKey)) {
        allDayCache.set(cacheKey, zonedStartOfDay(date, timeZone));
      }
      return allDayCache.get(cacheKey);
    };
    const resolvedStart = resolveDate(schedule.startDate);
    const resolvedEnd = resolveDate(schedule.endDate);
    if (resolvedStart === undefined || resolvedEnd === undefined) {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            'presentation.all-day-date-unavailable',
            'error',
            `Task "${task.id}" has an all-day boundary unavailable in time zone "${timeZone}".`,
            path,
            task.id,
          ),
        ]),
      });
    }
    start = resolvedStart;
    end = resolvedEnd;
  }

  if (milestone) {
    const diagnostics =
      start === end
        ? []
        : [
            diagnostic(
              'presentation.milestone-interval',
              'warning',
              `Milestone "${task.id}" has unequal boundaries and is presented at its start.`,
              path,
              task.id,
            ),
          ];
    return Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      interval: Object.freeze({ end: start, source: 'canonical', start }),
    });
  }

  if (end <= start) {
    return Object.freeze({
      diagnostics: Object.freeze([
        diagnostic(
          'layout.invalid-interval',
          'error',
          `Task "${task.id}" must have an increasing presentation interval.`,
          path,
          task.id,
        ),
      ]),
    });
  }
  return Object.freeze({
    diagnostics: Object.freeze([]),
    interval: Object.freeze({ end, source: 'canonical', start }),
  });
}

export function resolveCanonicalTaskSchedule(
  task: TaskRecord,
  schedule: TaskSchedule | undefined,
  path: string,
  timeZone: string,
  milestone = false,
): ScheduleResolution {
  return resolveScheduleWithCache(task, schedule, path, timeZone, milestone, new Map());
}

/** Resolves canonical task kinds into immutable presentation intervals without scheduling. */
export function resolveTaskPresentations(
  document: GanttDocument,
  timeZone: string,
): ResolveTaskPresentationsResult {
  const hierarchy = buildTaskHierarchyIndexes(document.tasks);
  const presentationByTaskId = new Map<EntityId, ResolvedTaskPresentation>();
  const diagnosticsByTaskId = new Map<EntityId, readonly Diagnostic[]>();
  const allDayCache = new Map<string, number | undefined>();

  for (let index = hierarchy.orderedTasks.length - 1; index >= 0; index -= 1) {
    const task = hierarchy.orderedTasks[index]!;
    const path = `/tasks/${hierarchy.sourceIndexByTaskId.get(task.id)!}/schedule`;
    if (task.kind !== 'summary') {
      const schedule = resolveScheduleWithCache(
        task,
        task.schedule,
        path,
        timeZone,
        task.kind === 'milestone',
        allDayCache,
      );
      diagnosticsByTaskId.set(task.id, schedule.diagnostics);
      presentationByTaskId.set(
        task.id,
        Object.freeze({
          ...(schedule.interval === undefined ? {} : { interval: schedule.interval }),
          kind: task.kind,
          taskId: task.id,
        }),
      );
      continue;
    }

    const children = hierarchy.childrenByParentId.get(task.id) ?? [];
    let descendantCount = 0;
    let resolvedDescendantCount = 0;
    let start = Infinity;
    let end = -Infinity;
    for (const child of children) {
      const presentation = presentationByTaskId.get(child.id)!;
      descendantCount += 1 + (presentation.summary?.descendantCount ?? 0);
      resolvedDescendantCount +=
        (presentation.interval === undefined ? 0 : 1) +
        (presentation.summary?.resolvedDescendantCount ?? 0);
      if (presentation.interval !== undefined) {
        start = Math.min(start, presentation.interval.start);
        end = Math.max(end, presentation.interval.end);
      }
    }
    const fallback =
      start === Infinity
        ? resolveScheduleWithCache(task, task.schedule, path, timeZone, false, allDayCache)
        : Object.freeze({
            diagnostics: Object.freeze([]),
            interval: Object.freeze({ end, source: 'descendants' as const, start }),
          });
    diagnosticsByTaskId.set(task.id, fallback.diagnostics);
    presentationByTaskId.set(
      task.id,
      Object.freeze({
        ...(fallback.interval === undefined ? {} : { interval: fallback.interval }),
        kind: task.kind,
        summary: Object.freeze({
          descendantCount,
          resolvedDescendantCount,
          unresolvedDescendantCount: descendantCount - resolvedDescendantCount,
        }),
        taskId: task.id,
      }),
    );
  }

  return Object.freeze({
    diagnostics: Object.freeze(
      document.tasks.flatMap((task) => diagnosticsByTaskId.get(task.id) ?? []),
    ),
    presentations: Object.freeze(document.tasks.map((task) => presentationByTaskId.get(task.id)!)),
  });
}

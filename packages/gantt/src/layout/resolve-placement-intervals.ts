import type { Diagnostic, DiagnosticCode } from '../model/diagnostics';
import { buildDocumentIndexes } from '../model/indexes';
import type { EntityId, EpochMilliseconds, GanttDocument, TaskSchedule } from '../model/types';
import type { ResolvedViewPlacement } from '../view/types';

export interface ResolvedIntervalPlacement extends ResolvedViewPlacement {
  readonly start: EpochMilliseconds;
  readonly end: EpochMilliseconds;
}

export interface ResolvePlacementIntervalsResult {
  readonly placements: readonly ResolvedIntervalPlacement[];
  readonly diagnostics: readonly Diagnostic[];
}

function intervalDiagnostic(
  code: DiagnosticCode,
  message: string,
  path: string,
  entityIds: readonly EntityId[],
): Diagnostic {
  return Object.freeze({
    code,
    severity: code === 'layout.missing-schedule' ? 'warning' : 'error',
    message,
    path,
    entityIds: Object.freeze([...entityIds]),
  });
}

function scheduleDiagnostic(
  schedule: TaskSchedule | undefined,
  placement: ResolvedViewPlacement,
  path: string,
): Diagnostic | undefined {
  const sourceId = placement.segmentId ?? placement.taskId;
  const entityIds = [placement.taskId, sourceId];
  if (schedule === undefined) {
    return intervalDiagnostic(
      'layout.missing-schedule',
      `Placement source "${sourceId}" has no schedule.`,
      path,
      entityIds,
    );
  }
  if (schedule.mode === 'all-day') {
    return intervalDiagnostic(
      'layout.unsupported-all-day-schedule',
      `Placement source "${sourceId}" uses an all-day schedule that M3 cannot render.`,
      path,
      entityIds,
    );
  }
  if (!Number.isFinite(schedule.start) || !Number.isFinite(schedule.end)) {
    return intervalDiagnostic(
      'layout.non-finite-interval',
      `Placement source "${sourceId}" has a non-finite interval boundary.`,
      path,
      entityIds,
    );
  }
  if (schedule.end <= schedule.start) {
    return intervalDiagnostic(
      'layout.invalid-interval',
      `Placement source "${sourceId}" must end after it starts.`,
      path,
      entityIds,
    );
  }
  return undefined;
}

/**
 * Dereferences task or explicit segment schedules once so stacking and viewport
 * algorithms operate only on validated half-open instant intervals.
 */
export function resolvePlacementIntervals(
  document: GanttDocument,
  placements: readonly ResolvedViewPlacement[],
): ResolvePlacementIntervalsResult {
  const indexes = buildDocumentIndexes(document);
  const resolved: ResolvedIntervalPlacement[] = [];
  const diagnostics: Diagnostic[] = [];

  placements.forEach((placement, index) => {
    const task = indexes.tasksById.get(placement.taskId);
    if (!task) {
      diagnostics.push(
        intervalDiagnostic(
          'layout.missing-task',
          `Placement references missing task "${placement.taskId}".`,
          `placements[${index}].taskId`,
          [placement.taskId],
        ),
      );
      return;
    }

    let schedule = task.schedule;
    if (placement.segmentId !== undefined) {
      const segment = indexes.segmentsByTaskId.get(task.id)?.get(placement.segmentId);
      if (!segment) {
        diagnostics.push(
          intervalDiagnostic(
            'layout.missing-segment',
            `Placement references missing segment "${placement.segmentId}" on task "${task.id}".`,
            `placements[${index}].segmentId`,
            [task.id, placement.segmentId],
          ),
        );
        return;
      }
      schedule = segment.schedule;
    }

    const invalidSchedule = scheduleDiagnostic(schedule, placement, `placements[${index}]`);
    if (invalidSchedule) {
      diagnostics.push(invalidSchedule);
      return;
    }

    // The diagnostic helper proves this is the canonical instant interval branch.
    if (schedule?.mode !== 'instant') {
      return;
    }
    resolved.push(
      Object.freeze({
        ...placement,
        source: Object.freeze({ ...placement.source }),
        start: schedule.start,
        end: schedule.end,
      }),
    );
  });

  return Object.freeze({
    placements: Object.freeze(resolved),
    diagnostics: Object.freeze(diagnostics),
  });
}

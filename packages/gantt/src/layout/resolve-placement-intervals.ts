import type { Diagnostic, DiagnosticCode } from '../model/diagnostics';
import { buildDocumentIndexes } from '../model/indexes';
import type { EntityId, EpochMilliseconds, GanttDocument, TaskKind } from '../model/types';
import {
  resolveCanonicalTaskSchedule,
  resolveTaskPresentations,
  type ResolvedSummaryPresentation,
} from '../presentation/resolve-task-presentations';
import { buildTaskHierarchyIndexes, getTaskDescendants } from '../hierarchy/task-hierarchy';
import type { ResolvedViewPlacement } from '../view/types';

export interface ResolvedIntervalPlacement extends ResolvedViewPlacement {
  readonly end: EpochMilliseconds;
  readonly intervalSource: 'canonical' | 'descendants';
  readonly kind: TaskKind;
  readonly start: EpochMilliseconds;
  readonly summary?: ResolvedSummaryPresentation;
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

/**
 * Dereferences task or explicit segment schedules once so stacking and viewport
 * algorithms operate only on resolved intervals or milestone points.
 */
export function resolvePlacementIntervals(
  document: GanttDocument,
  placements: readonly ResolvedViewPlacement[],
  options: { readonly timeZone?: string } = {},
): ResolvePlacementIntervalsResult {
  const indexes = buildDocumentIndexes(document);
  const hierarchy = buildTaskHierarchyIndexes(document.tasks);
  const presentations = resolveTaskPresentations(document, options.timeZone ?? 'UTC');
  const presentationByTaskId = new Map(
    presentations.presentations.map((presentation) => [presentation.taskId, presentation]),
  );
  const resolved: ResolvedIntervalPlacement[] = [];
  const diagnostics: Diagnostic[] = [];
  const diagnosticTaskIds = new Set<EntityId>();

  for (const placement of placements) {
    if (placement.segmentId !== undefined) {
      continue;
    }
    diagnosticTaskIds.add(placement.taskId);
    if (presentationByTaskId.get(placement.taskId)?.kind === 'summary') {
      for (const descendant of getTaskDescendants(hierarchy, placement.taskId)) {
        diagnosticTaskIds.add(descendant.id);
      }
    }
  }
  diagnostics.push(
    ...presentations.diagnostics.filter((item) =>
      item.entityIds?.some((id) => diagnosticTaskIds.has(id)),
    ),
  );

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
      const segmentResolution = resolveCanonicalTaskSchedule(
        task,
        segment.schedule,
        `placements[${index}].segmentId`,
        options.timeZone ?? 'UTC',
      );
      diagnostics.push(...segmentResolution.diagnostics);
      if (segmentResolution.interval === undefined) {
        return;
      }
      resolved.push(
        Object.freeze({
          ...placement,
          end: segmentResolution.interval.end,
          intervalSource: 'canonical',
          kind: task.kind,
          source: Object.freeze({ ...placement.source }),
          start: segmentResolution.interval.start,
        }),
      );
      return;
    }

    const presentation = presentationByTaskId.get(task.id)!;
    if (presentation.interval === undefined) {
      return;
    }
    resolved.push(
      Object.freeze({
        ...placement,
        end: presentation.interval.end,
        intervalSource: presentation.interval.source,
        kind: presentation.kind,
        source: Object.freeze({ ...placement.source }),
        start: presentation.interval.start,
        ...(presentation.summary === undefined ? {} : { summary: presentation.summary }),
      }),
    );
  });

  return Object.freeze({
    placements: Object.freeze(resolved),
    diagnostics: Object.freeze(diagnostics),
  });
}

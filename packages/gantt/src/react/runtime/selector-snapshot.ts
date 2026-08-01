import type { EntityId, GanttDocument } from '../../model/types';
import type { ChartScene, TaskBarPrimitive } from '../../render/primitives';
import type { ChartSceneOccurrence } from '../../render/scene-pipeline';
import type {
  GanttDependencyTarget,
  GanttInteractionTarget,
  GanttRuntimeOccurrence,
  GanttRuntimeSnapshot,
  GanttSessionState,
  GanttTaskTarget,
} from '../../runtime/types';
import type { GanttTimeScaleLevel } from '../../time/adaptive-scale';
import type {
  GanttInteractionState,
  GanttSelectorSnapshot,
  GanttViewportChange,
  GanttVisibleOccurrence,
} from '../types';
import type { DisplayInputs } from './display-inputs';

export function projectSessionPart(session: GanttSessionState) {
  return session.project === undefined ? {} : { project: session.project };
}

export function projectCollapsedTaskIds(
  document: GanttDocument,
  session: GanttSessionState,
  taskId: EntityId,
  expanded?: boolean,
): readonly EntityId[] | undefined {
  const parentIds = new Set(
    document.tasks.flatMap((task) => (task.parentId === undefined ? [] : [task.parentId])),
  );
  if (!parentIds.has(taskId)) return undefined;

  const collapsed = new Set(session.project?.collapsedTaskIds ?? []);
  const currentlyExpanded = !collapsed.has(taskId);
  const nextExpanded = expanded ?? !currentlyExpanded;
  if (nextExpanded === currentlyExpanded) return undefined;

  if (nextExpanded) collapsed.delete(taskId);
  else collapsed.add(taskId);

  return Object.freeze(
    document.tasks
      .filter((task) => collapsed.has(task.id) && parentIds.has(task.id))
      .map((task) => task.id),
  );
}

export function taskTarget(task: TaskBarPrimitive | ChartSceneOccurrence): GanttTaskTarget {
  return Object.freeze({
    ...(task.assignmentId === undefined ? {} : { assignmentId: task.assignmentId }),
    kind: 'task',
    ...(task.laneId === undefined ? {} : { laneId: task.laneId }),
    laneViewKey: task.laneViewKey,
    ...(task.placementId === undefined ? {} : { placementId: task.placementId }),
    ...(task.resourceId === undefined ? {} : { resourceId: task.resourceId }),
    ...(task.segmentId === undefined ? {} : { segmentId: task.segmentId }),
    taskId: task.taskId,
    viewKey: task.viewKey,
  });
}

export function laneTarget(
  lane: ChartScene['lanes'][number],
): Extract<GanttInteractionTarget, { readonly kind: 'lane' }> {
  return Object.freeze({
    kind: 'lane',
    ...(lane.laneId === undefined ? {} : { laneId: lane.laneId }),
    ...(lane.resourceId === undefined ? {} : { resourceId: lane.resourceId }),
    viewKey: lane.viewKey,
  });
}

export function dependencyTarget(dependencyId: EntityId): GanttDependencyTarget {
  return Object.freeze({ dependencyId, kind: 'dependency' });
}

export function occurrences(
  scene: ChartScene,
  catalog: readonly ChartSceneOccurrence[],
  previousDependencies?: GanttSelectorSnapshot['dependencies'],
): {
  readonly dependencies: GanttSelectorSnapshot['dependencies'];
  readonly runtime: readonly GanttRuntimeOccurrence[];
  readonly visible: readonly GanttVisibleOccurrence[];
} {
  const visible = scene.taskBars.map((task) =>
    Object.freeze({
      ...(task.presentation.project?.depth === undefined
        ? {}
        : { depth: task.presentation.project.depth }),
      ...(task.presentation.summary === undefined
        ? {}
        : { descendantCount: task.presentation.summary.descendantCount }),
      end: task.end,
      ...(task.presentation.project?.expanded === undefined
        ? {}
        : { expanded: task.presentation.project.expanded }),
      ...(task.presentation.project?.filterMatch === undefined
        ? {}
        : { filterMatch: task.presentation.project.filterMatch }),
      ...(task.presentation.project?.hasChildren === undefined
        ? {}
        : { hasChildren: task.presentation.project.hasChildren }),
      intervalSource: task.presentation.intervalSource,
      kind: task.presentation.kind,
      ...(task.progress === undefined ? {} : { progress: task.progress.value }),
      ...(task.presentation.summary === undefined
        ? {}
        : { resolvedDescendantCount: task.presentation.summary.resolvedDescendantCount }),
      start: task.start,
      target: taskTarget(task),
      ...(task.presentation.summary === undefined
        ? {}
        : { unresolvedDescendantCount: task.presentation.summary.unresolvedDescendantCount }),
    }),
  );
  const previousDependencyById = new Map(
    previousDependencies?.map((summary) => [summary.dependency.id, summary]),
  );
  const dependencies = scene.dependencySummaries.map((summary) => {
    const previous = previousDependencyById.get(summary.dependency.id);
    const previousLag = previous?.dependency.lag;
    const nextLag = summary.dependency.lag;
    if (
      previous !== undefined &&
      previous.dependency.fromTaskId === summary.dependency.fromTaskId &&
      previous.dependency.toTaskId === summary.dependency.toTaskId &&
      previous.dependency.type === summary.dependency.type &&
      previousLag?.mode === nextLag?.mode &&
      previousLag?.unit === nextLag?.unit &&
      previousLag?.value === nextLag?.value &&
      (previous.dependency.fields === summary.dependency.fields ||
        JSON.stringify(previous.dependency.fields) === JSON.stringify(summary.dependency.fields)) &&
      previous.fromTitle === summary.fromTitle &&
      previous.hiddenEndpoint === summary.hiddenEndpoint &&
      previous.status === summary.status &&
      previous.toTitle === summary.toTitle
    ) {
      return previous;
    }
    return Object.freeze({
      dependency: Object.freeze({ ...summary.dependency }),
      fromTitle: summary.fromTitle,
      hiddenEndpoint: summary.hiddenEndpoint,
      status: summary.status,
      target: dependencyTarget(summary.dependency.id),
      toTitle: summary.toTitle,
    });
  });
  const stableDependencies =
    previousDependencies !== undefined &&
    dependencies.length === previousDependencies.length &&
    dependencies.every((dependency, index) => dependency === previousDependencies[index])
      ? previousDependencies
      : Object.freeze(dependencies);
  return Object.freeze({
    dependencies: stableDependencies,
    runtime: Object.freeze([
      ...scene.lanes.map((lane, laneIndex) =>
        Object.freeze({ horizontalCenter: 0, laneIndex, target: laneTarget(lane) }),
      ),
      ...catalog.map((task) =>
        Object.freeze({
          horizontalCenter: task.start + (task.end - task.start) / 2,
          laneIndex: task.laneIndex,
          target: taskTarget(task),
        }),
      ),
      ...scene.dependencySummaries.map((dependency) =>
        Object.freeze({
          horizontalCenter: 0,
          laneIndex: 0,
          target: dependencyTarget(dependency.dependency.id),
        }),
      ),
    ]),
    visible: Object.freeze(visible),
  });
}

export function targetIdentity(target: GanttInteractionTarget | undefined): string | undefined {
  return target === undefined
    ? undefined
    : target.kind === 'dependency'
      ? `${target.kind}\u0000${target.dependencyId}`
      : `${target.kind}\u0000${target.viewKey}`;
}

export function selectionEqual(
  previous: readonly GanttInteractionTarget[],
  next: readonly GanttInteractionTarget[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((target, index) => targetIdentity(target) === targetIdentity(next[index]))
  );
}

export function viewportEvent(snapshot: GanttSelectorSnapshot): GanttViewportChange {
  return Object.freeze({
    range: snapshot.range,
    session: snapshot.session.viewport,
    measured: snapshot.viewport,
  });
}

export function createSelectorSnapshot(
  store: GanttRuntimeSnapshot,
  display: DisplayInputs,
  dependencies: GanttSelectorSnapshot['dependencies'],
  visible: readonly GanttVisibleOccurrence[],
  interaction: GanttInteractionState,
  scaleLevel: GanttTimeScaleLevel,
): GanttSelectorSnapshot {
  return Object.freeze({
    canRedo: store.history.canRedo,
    canUndo: store.history.canUndo,
    document: store.document,
    dependencies,
    interaction,
    occurrences: visible,
    range: display.range,
    scaleLevel,
    session: store.session,
    viewport: store.viewport,
  });
}

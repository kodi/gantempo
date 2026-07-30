import type { GanttRuntimeOccurrence, GanttTaskTarget } from '../runtime/types';
import type {
  InteractionHitTestIndex,
  InteractionNavigationDirection,
  InteractionTaskNode,
} from './types';

function centerX(task: InteractionTaskNode): number {
  return task.rect.x + task.rect.width / 2;
}

function targetIdentity(target: GanttTaskTarget): string {
  return `task\u0000${target.viewKey}`;
}

type RuntimeTaskOccurrence = GanttRuntimeOccurrence & {
  readonly target: GanttTaskTarget;
};

function runtimeTask(occurrence: GanttRuntimeOccurrence): occurrence is RuntimeTaskOccurrence {
  return occurrence.target.kind === 'task';
}

function sortRuntimeHorizontal(
  occurrences: readonly RuntimeTaskOccurrence[],
  direction: 'ascending' | 'descending',
): readonly RuntimeTaskOccurrence[] {
  const multiplier = direction === 'ascending' ? 1 : -1;
  return [...occurrences].sort(
    (left, right) =>
      multiplier * (left.horizontalCenter - right.horizontalCenter) ||
      left.laneIndex - right.laneIndex ||
      left.target.viewKey.localeCompare(right.target.viewKey),
  );
}

function closestRuntimeHorizontal(
  occurrences: readonly RuntimeTaskOccurrence[],
  horizontalCenter: number,
): RuntimeTaskOccurrence | undefined {
  return [...occurrences].sort(
    (left, right) =>
      Math.abs(left.horizontalCenter - horizontalCenter) -
        Math.abs(right.horizontalCenter - horizontalCenter) ||
      left.laneIndex - right.laneIndex ||
      left.target.viewKey.localeCompare(right.target.viewKey),
  )[0];
}

function sortHorizontal(
  tasks: readonly InteractionTaskNode[],
  direction: 'ascending' | 'descending',
): readonly InteractionTaskNode[] {
  const multiplier = direction === 'ascending' ? 1 : -1;
  return [...tasks].sort(
    (left, right) =>
      multiplier * (centerX(left) - centerX(right)) ||
      left.paintOrder - right.paintOrder ||
      left.target.viewKey.localeCompare(right.target.viewKey),
  );
}

function closestHorizontal(
  tasks: readonly InteractionTaskNode[],
  horizontalCenter: number,
): InteractionTaskNode | undefined {
  return [...tasks].sort(
    (left, right) =>
      Math.abs(centerX(left) - horizontalCenter) - Math.abs(centerX(right) - horizontalCenter) ||
      left.paintOrder - right.paintOrder ||
      left.target.viewKey.localeCompare(right.target.viewKey),
  )[0];
}

export function navigateInteractionOccurrence(
  index: InteractionHitTestIndex,
  from: GanttTaskTarget,
  direction: InteractionNavigationDirection,
): GanttTaskTarget | undefined {
  const current = index.tasks.find((task) => targetIdentity(task.target) === targetIdentity(from));
  if (current === undefined) {
    return undefined;
  }
  const laneTasks = index.tasks.filter(
    (task) => task.lane.primitive.viewKey === current.lane.primitive.viewKey,
  );
  if (direction === 'home' || direction === 'end') {
    return sortHorizontal(laneTasks, direction === 'home' ? 'ascending' : 'descending')[0]?.target;
  }
  if (direction === 'left' || direction === 'right') {
    const currentCenter = centerX(current);
    const candidates = laneTasks.filter((task) =>
      direction === 'left' ? centerX(task) < currentCenter : centerX(task) > currentCenter,
    );
    return closestHorizontal(candidates, currentCenter)?.target;
  }

  const laneDirection = direction === 'up' ? -1 : 1;
  for (
    let laneIndex = current.lane.index + laneDirection;
    laneIndex >= 0 && laneIndex < index.lanes.length;
    laneIndex += laneDirection
  ) {
    const candidates = index.tasks.filter((task) => task.lane.index === laneIndex);
    if (candidates.length > 0) {
      return closestHorizontal(candidates, centerX(current))?.target;
    }
  }
  return undefined;
}

export function navigateRuntimeOccurrence(
  occurrences: readonly GanttRuntimeOccurrence[],
  from: GanttTaskTarget,
  direction: InteractionNavigationDirection,
): GanttTaskTarget | undefined {
  const tasks = occurrences.filter(runtimeTask);
  const current = tasks.find(
    (occurrence) => targetIdentity(occurrence.target) === targetIdentity(from),
  );
  if (current === undefined) {
    return undefined;
  }
  const laneTasks = tasks.filter((occurrence) => occurrence.laneIndex === current.laneIndex);
  if (direction === 'home' || direction === 'end') {
    return sortRuntimeHorizontal(laneTasks, direction === 'home' ? 'ascending' : 'descending')[0]
      ?.target;
  }
  if (direction === 'left' || direction === 'right') {
    const candidates = laneTasks.filter((occurrence) =>
      direction === 'left'
        ? occurrence.horizontalCenter < current.horizontalCenter
        : occurrence.horizontalCenter > current.horizontalCenter,
    );
    return closestRuntimeHorizontal(candidates, current.horizontalCenter)?.target;
  }

  const laneDirection = direction === 'up' ? -1 : 1;
  const occupiedLaneIndexes = [...new Set(tasks.map((occurrence) => occurrence.laneIndex))].sort(
    (left, right) => laneDirection * (left - right),
  );
  const destinationLaneIndex = occupiedLaneIndexes.find((laneIndex) =>
    laneDirection < 0 ? laneIndex < current.laneIndex : laneIndex > current.laneIndex,
  );
  if (destinationLaneIndex === undefined) {
    return undefined;
  }
  return closestRuntimeHorizontal(
    tasks.filter((occurrence) => occurrence.laneIndex === destinationLaneIndex),
    current.horizontalCenter,
  )?.target;
}

export function interactionOccurrences(
  index: InteractionHitTestIndex,
): readonly GanttRuntimeOccurrence[] {
  return Object.freeze(
    index.tasks.map((task) =>
      Object.freeze({
        horizontalCenter: centerX(task),
        laneIndex: task.lane.index,
        target: task.target,
      }),
    ),
  );
}

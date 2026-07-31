import type { EpochMilliseconds, TimeRange } from '../model/types';
import type { ChartScene, LaneRowPrimitive, TaskBarPrimitive } from '../render/primitives';
import type { GanttLaneTarget, GanttTaskTarget } from '../runtime/types';
import type {
  InteractionHit,
  InteractionHitTestOptions,
  InteractionHitTestIndex,
  InteractionLaneNode,
  InteractionPoint,
  InteractionPointerType,
  InteractionRectangle,
  InteractionSnapPolicy,
  InteractionTaskNode,
  InteractionTimelineBounds,
} from './types';

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
  return value;
}

function positive(value: number, name: string): number {
  finite(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be positive.`);
  }
  return value;
}

function freezePoint(point: InteractionPoint): InteractionPoint {
  return Object.freeze({
    x: finite(point.x, 'Interaction point x'),
    y: finite(point.y, 'Interaction point y'),
  });
}

function freezeRect(rect: InteractionRectangle): InteractionRectangle {
  return Object.freeze({
    height: positive(rect.height, 'Interaction rectangle height'),
    width: positive(rect.width, 'Interaction rectangle width'),
    x: finite(rect.x, 'Interaction rectangle x'),
    y: finite(rect.y, 'Interaction rectangle y'),
  });
}

function laneTarget(primitive: LaneRowPrimitive): GanttLaneTarget {
  return Object.freeze({
    kind: 'lane',
    ...(primitive.laneId === undefined ? {} : { laneId: primitive.laneId }),
    ...(primitive.resourceId === undefined ? {} : { resourceId: primitive.resourceId }),
    viewKey: primitive.viewKey,
  });
}

function taskTarget(primitive: TaskBarPrimitive): GanttTaskTarget {
  return Object.freeze({
    ...(primitive.assignmentId === undefined ? {} : { assignmentId: primitive.assignmentId }),
    kind: 'task',
    ...(primitive.laneId === undefined ? {} : { laneId: primitive.laneId }),
    laneViewKey: primitive.laneViewKey,
    ...(primitive.placementId === undefined ? {} : { placementId: primitive.placementId }),
    ...(primitive.resourceId === undefined ? {} : { resourceId: primitive.resourceId }),
    ...(primitive.segmentId === undefined ? {} : { segmentId: primitive.segmentId }),
    taskId: primitive.taskId,
    viewKey: primitive.viewKey,
  });
}

function contains(rect: InteractionRectangle, point: InteractionPoint): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function expandedVerticalRect(
  rect: InteractionRectangle,
  minimumHeight: number,
): InteractionRectangle {
  const height = Math.max(rect.height, minimumHeight);
  return {
    x: rect.x,
    y: rect.y - (height - rect.height) / 2,
    width: rect.width,
    height,
  };
}

function pointerEdgeRadius(pointerType: InteractionPointerType): number {
  return pointerType === 'touch' ? 22 : pointerType === 'pen' ? 8 : 6;
}

function pointerProgressRadius(pointerType: InteractionPointerType): number {
  return pointerType === 'touch' ? 22 : pointerType === 'pen' ? 10 : 7;
}

function pointerMinimumHeight(pointerType: InteractionPointerType): number {
  return pointerType === 'touch' ? 44 : pointerType === 'pen' ? 28 : 0;
}

export function coordinateToTime(
  timeline: Pick<InteractionTimelineBounds, 'width' | 'x'>,
  range: TimeRange,
  coordinate: number,
  clamp = true,
): EpochMilliseconds {
  positive(timeline.width, 'Timeline width');
  finite(timeline.x, 'Timeline x');
  finite(coordinate, 'Timeline coordinate');
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
    throw new RangeError('Interaction range must have finite increasing boundaries.');
  }
  const ratio = (coordinate - timeline.x) / timeline.width;
  const normalized = clamp ? Math.min(1, Math.max(0, ratio)) : ratio;
  const time = range.start + normalized * (range.end - range.start);
  if (!Number.isFinite(time)) {
    throw new RangeError('Coordinate conversion must produce a finite time.');
  }
  return time;
}

export function timeToCoordinate(
  timeline: Pick<InteractionTimelineBounds, 'width' | 'x'>,
  range: TimeRange,
  time: EpochMilliseconds,
): number {
  positive(timeline.width, 'Timeline width');
  finite(time, 'Interaction time');
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
    throw new RangeError('Interaction range must have finite increasing boundaries.');
  }
  return timeline.x + ((time - range.start) / (range.end - range.start)) * timeline.width;
}

export function snapInteractionTime(
  time: EpochMilliseconds,
  policy: InteractionSnapPolicy,
): EpochMilliseconds {
  finite(time, 'Interaction time');
  finite(policy.anchor, 'Interaction snap anchor');
  positive(policy.step, 'Interaction snap step');
  const units = (time - policy.anchor) / policy.step;
  const snapped = policy.anchor + Math.floor(units + 0.5) * policy.step;
  if (!Number.isFinite(snapped)) {
    throw new RangeError('Snapped interaction time must remain finite.');
  }
  return snapped;
}

export function createInteractionHitTestIndex(
  scene: ChartScene,
  timeline: InteractionTimelineBounds,
  options: InteractionHitTestOptions = {},
): InteractionHitTestIndex {
  const frozenTimeline = Object.freeze({
    ...freezeRect(timeline),
    verticalStart: finite(timeline.verticalStart, 'Timeline verticalStart'),
  });
  if (frozenTimeline.verticalStart < 0) {
    throw new RangeError('Timeline verticalStart must be non-negative.');
  }
  const lanes: InteractionLaneNode[] = scene.lanes.map((primitive, index) =>
    Object.freeze({
      index,
      primitive,
      rect: freezeRect({
        x: frozenTimeline.x,
        y: frozenTimeline.y + primitive.y - frozenTimeline.verticalStart,
        width: frozenTimeline.width,
        height: primitive.height,
      }),
      target: laneTarget(primitive),
    }),
  );
  const lanesByKey = new Map(lanes.map((lane) => [lane.primitive.viewKey, lane]));
  const progressTaskIds = new Set(options.progressTaskIds ?? []);
  const tasks: InteractionTaskNode[] = [];
  scene.taskBars.forEach((primitive, paintOrder) => {
    const lane = lanesByKey.get(primitive.laneViewKey);
    if (lane === undefined || primitive.width <= 0 || primitive.height <= 0) {
      return;
    }
    tasks.push(
      Object.freeze({
        lane,
        paintOrder,
        primitive,
        progressEditable:
          progressTaskIds.has(primitive.taskId) && primitive.segmentId === undefined,
        rect: freezeRect({
          x: frozenTimeline.x + primitive.x * frozenTimeline.width,
          y: frozenTimeline.y + primitive.y - frozenTimeline.verticalStart,
          width: primitive.width * frozenTimeline.width,
          height: primitive.height,
        }),
        target: taskTarget(primitive),
      }),
    );
  });
  const tasksByLane = lanes.map((lane) =>
    Object.freeze(tasks.filter((task) => task.lane === lane)),
  );
  return Object.freeze({
    lanes: Object.freeze(lanes),
    range: Object.freeze({ ...scene.range }),
    tasks: Object.freeze(tasks),
    tasksByLane: Object.freeze(tasksByLane),
    timeline: frozenTimeline,
  });
}

function hitLane(
  index: InteractionHitTestIndex,
  point: InteractionPoint,
): InteractionLaneNode | undefined {
  return index.lanes.find((lane) => contains(lane.rect, point));
}

export function hitTestInteraction(
  index: InteractionHitTestIndex,
  inputPoint: InteractionPoint,
  pointerType: InteractionPointerType,
  candidateViewKey?: string,
  progressCandidateViewKey?: string,
): InteractionHit | undefined {
  const point = freezePoint(inputPoint);
  if (!contains(index.timeline, point)) {
    return undefined;
  }
  const time = coordinateToTime(index.timeline, index.range, point.x);
  const edgeRadius = pointerEdgeRadius(pointerType);
  const progressRadius = pointerProgressRadius(pointerType);
  const minimumHeight = pointerMinimumHeight(pointerType);
  const lane = hitLane(index, point);
  const candidateTasks =
    lane === undefined
      ? []
      : index.lanes
          .filter(
            (candidate) =>
              point.y >= candidate.rect.y - minimumHeight / 2 &&
              point.y < candidate.rect.y + candidate.rect.height + minimumHeight / 2,
          )
          .flatMap((candidate) => index.tasksByLane[candidate.index] ?? []);
  const progressHits = candidateTasks
    .filter((task) => task.progressEditable)
    .flatMap((task) => {
      const verticalRect = expandedVerticalRect(task.rect, minimumHeight);
      const value = task.primitive.progress?.value ?? 0;
      const distance = Math.abs(point.x - (task.rect.x + task.rect.width * value));
      return distance <= progressRadius &&
        point.y >= verticalRect.y &&
        point.y < verticalRect.y + verticalRect.height
        ? [
            {
              candidate: progressCandidateViewKey === task.target.viewKey,
              distance,
              task,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        Number(right.candidate) - Number(left.candidate) ||
        left.distance - right.distance ||
        right.task.paintOrder - left.task.paintOrder,
    );
  const explicitProgress = progressHits.find((hit) => hit.candidate);
  if (explicitProgress !== undefined) {
    return Object.freeze({
      kind: 'task-progress',
      lane: explicitProgress.task.lane,
      point,
      task: explicitProgress.task,
      time,
    });
  }
  const edges = candidateTasks.flatMap((task) => {
    const verticalRect = expandedVerticalRect(task.rect, minimumHeight);
    const values: {
      readonly candidate: boolean;
      readonly distance: number;
      readonly edge: 'end' | 'start';
      readonly task: InteractionTaskNode;
    }[] = [];
    if (!task.primitive.clippedStart) {
      const distance = Math.abs(point.x - task.rect.x);
      if (
        distance <= edgeRadius &&
        point.y >= verticalRect.y &&
        point.y < verticalRect.y + verticalRect.height
      ) {
        values.push({
          candidate: candidateViewKey === task.target.viewKey,
          distance,
          edge: 'start',
          task,
        });
      }
    }
    if (!task.primitive.clippedEnd) {
      const distance = Math.abs(point.x - (task.rect.x + task.rect.width));
      if (
        distance <= edgeRadius &&
        point.y >= verticalRect.y &&
        point.y < verticalRect.y + verticalRect.height
      ) {
        values.push({
          candidate: candidateViewKey === task.target.viewKey,
          distance,
          edge: 'end',
          task,
        });
      }
    }
    return values;
  });
  edges.sort(
    (left, right) =>
      Number(right.candidate) - Number(left.candidate) ||
      left.distance - right.distance ||
      right.task.paintOrder - left.task.paintOrder ||
      (left.edge === right.edge ? 0 : left.edge === 'start' ? -1 : 1),
  );
  const edge = edges[0];
  if (edge !== undefined) {
    return Object.freeze({
      edge: edge.edge,
      kind: 'task-edge',
      lane: edge.task.lane,
      point,
      task: edge.task,
      time,
    });
  }

  const progress = progressHits[0];
  if (progress !== undefined) {
    return Object.freeze({
      kind: 'task-progress',
      lane: progress.task.lane,
      point,
      task: progress.task,
      time,
    });
  }

  const bodies = candidateTasks
    .filter((task) => contains(task.rect, point))
    .sort(
      (left, right) =>
        Number(candidateViewKey === right.target.viewKey) -
          Number(candidateViewKey === left.target.viewKey) || right.paintOrder - left.paintOrder,
    );
  const body = bodies[0];
  if (body !== undefined) {
    return Object.freeze({
      kind: 'task-body',
      lane: body.lane,
      point,
      task: body,
      time,
    });
  }

  return lane === undefined
    ? undefined
    : Object.freeze({
        kind: 'timeline-position',
        lane,
        point,
        time,
      });
}

import type { DependencyType, EntityId } from '../model/types';

export interface DependencyRouteEndpoint {
  readonly endX: number;
  readonly hidden: boolean;
  readonly startX: number;
  readonly taskId: EntityId;
  readonly viewKey: string;
  readonly y: number;
}

export interface DependencyRouteInput {
  readonly dependencyId: EntityId;
  readonly direction?: 'ltr' | 'rtl';
  readonly from: DependencyRouteEndpoint;
  readonly rank: number;
  readonly to: DependencyRouteEndpoint;
  readonly type: DependencyType;
}

export interface DependencyRoutePoint {
  readonly x: number;
  readonly y: number;
}

export interface RoutedDependency {
  readonly clippedEnd: boolean;
  readonly clippedStart: boolean;
  readonly dependencyId: EntityId;
  readonly fromTaskId: EntityId;
  readonly fromViewKey: string;
  readonly hiddenEndpoint: boolean;
  readonly points: readonly DependencyRoutePoint[];
  readonly toTaskId: EntityId;
  readonly toViewKey: string;
  readonly type: DependencyType;
}

export interface DependencyRouteViewport {
  readonly bottom: number;
  readonly left?: number;
  readonly right?: number;
  readonly top: number;
}

function point(x: number, y: number): DependencyRoutePoint {
  return Object.freeze({ x, y });
}

function samePoint(left: DependencyRoutePoint, right: DependencyRoutePoint): boolean {
  return Math.abs(left.x - right.x) < 1e-9 && Math.abs(left.y - right.y) < 1e-9;
}

function clipSegment(
  from: DependencyRoutePoint,
  to: DependencyRoutePoint,
  viewport: Required<DependencyRouteViewport>,
): readonly [DependencyRoutePoint, DependencyRoutePoint] | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let start = 0;
  let end = 1;
  const boundaries = [
    [-dx, from.x - viewport.left],
    [dx, viewport.right - from.x],
    [-dy, from.y - viewport.top],
    [dy, viewport.bottom - from.y],
  ] as const;

  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) return undefined;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) start = Math.max(start, ratio);
    else end = Math.min(end, ratio);
    if (start > end) return undefined;
  }
  const clippedPoint = (ratio: number) =>
    point(
      Math.min(viewport.right, Math.max(viewport.left, from.x + ratio * dx)),
      Math.min(viewport.bottom, Math.max(viewport.top, from.y + ratio * dy)),
    );
  return Object.freeze([clippedPoint(start), clippedPoint(end)]);
}

function clipRoute(
  route: readonly DependencyRoutePoint[],
  viewport: Required<DependencyRouteViewport>,
): readonly DependencyRoutePoint[] | undefined {
  const clipped: DependencyRoutePoint[] = [];
  for (let index = 1; index < route.length; index += 1) {
    const segment = clipSegment(route[index - 1]!, route[index]!, viewport);
    if (segment === undefined) continue;
    if (clipped.length > 0 && !samePoint(clipped[clipped.length - 1]!, segment[0])) {
      // Orthogonal routes can only cross this rectangular viewport as one contiguous run.
      break;
    }
    if (clipped.length === 0) clipped.push(segment[0]);
    if (!samePoint(clipped[clipped.length - 1]!, segment[1])) clipped.push(segment[1]);
  }
  return clipped.length < 2 ? undefined : Object.freeze(clipped);
}

function sourceUsesStart(type: DependencyType): boolean {
  return type === 'start-to-finish' || type === 'start-to-start';
}

function targetUsesStart(type: DependencyType): boolean {
  return type === 'finish-to-start' || type === 'start-to-start';
}

/**
 * Builds stable orthogonal relationship geometry in normalized timeline-x and
 * content-space-y coordinates. Clipping happens after the full route is known so
 * virtual scrolling cannot change the relationship's channel or identity.
 */
export function routeDependency(
  input: DependencyRouteInput,
  viewport: DependencyRouteViewport,
): RoutedDependency | undefined {
  const fromStart = sourceUsesStart(input.type);
  const toStart = targetUsesStart(input.type);
  const fromX = fromStart ? input.from.startX : input.from.endX;
  const toX = toStart ? input.to.startX : input.to.endX;
  const timeDirection = input.direction === 'rtl' ? -1 : 1;
  const fromDirection = fromStart ? -timeDirection : timeDirection;
  const toDirection = toStart ? -timeDirection : timeDirection;
  const channel = 0.012 + (input.rank % 5) * 0.004;
  const fromStubX = fromX + fromDirection * channel;
  const toStubX = toX + toDirection * channel;
  const middleX =
    fromDirection === toDirection
      ? fromDirection > 0
        ? Math.max(fromStubX, toStubX)
        : Math.min(fromStubX, toStubX)
      : (fromStubX + toStubX) / 2;
  const fullRoute = Object.freeze(
    [
      point(fromX, input.from.y),
      point(fromStubX, input.from.y),
      point(middleX, input.from.y),
      point(middleX, input.to.y),
      point(toStubX, input.to.y),
      point(toX, input.to.y),
    ].filter((current, index, points) => index === 0 || !samePoint(current, points[index - 1]!)),
  );
  const resolvedViewport: Required<DependencyRouteViewport> = {
    bottom: viewport.bottom,
    left: viewport.left ?? 0,
    right: viewport.right ?? 1,
    top: viewport.top,
  };
  const clipped = clipRoute(fullRoute, resolvedViewport);
  if (clipped === undefined) return undefined;
  return Object.freeze({
    clippedEnd: !samePoint(clipped[clipped.length - 1]!, fullRoute[fullRoute.length - 1]!),
    clippedStart: !samePoint(clipped[0]!, fullRoute[0]!),
    dependencyId: input.dependencyId,
    fromTaskId: input.from.taskId,
    fromViewKey: input.from.viewKey,
    hiddenEndpoint: input.from.hidden || input.to.hidden,
    points: clipped,
    toTaskId: input.to.taskId,
    toViewKey: input.to.viewKey,
    type: input.type,
  });
}

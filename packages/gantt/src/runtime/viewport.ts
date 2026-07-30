import type {
  GanttMeasuredViewportState,
  GanttRuntimeViewportOptions,
  GanttViewportMeasurement,
} from './types';

export interface ResolvedGanttRuntimeViewportOptions {
  readonly overscanAfter: number;
  readonly overscanBefore: number;
  readonly schedule: NonNullable<GanttRuntimeViewportOptions['schedule']>;
}

function nonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
}

export function resolveRuntimeViewportOptions(
  options: GanttRuntimeViewportOptions | undefined,
): ResolvedGanttRuntimeViewportOptions {
  const overscanBefore = nonNegativeFinite(
    options?.overscanBefore ?? 120,
    'Viewport overscanBefore',
  );
  const overscanAfter = nonNegativeFinite(options?.overscanAfter ?? 240, 'Viewport overscanAfter');
  if (options?.schedule !== undefined && typeof options.schedule !== 'function') {
    throw new TypeError('Viewport schedule must be a function.');
  }
  return Object.freeze({
    overscanAfter,
    overscanBefore,
    schedule:
      options?.schedule ??
      ((update) => {
        update();
      }),
  });
}

export function createUnmeasuredViewport(
  verticalStart: number,
  options: ResolvedGanttRuntimeViewportOptions,
): GanttMeasuredViewportState {
  return Object.freeze({
    clientHeight: 0,
    clientWidth: 0,
    overscanAfter: options.overscanAfter,
    overscanBefore: options.overscanBefore,
    queryVerticalExtent: 0,
    queryVerticalStart: verticalStart,
    status: 'unmeasured',
    verticalStart,
  });
}

export function measureViewport(
  measurement: GanttViewportMeasurement,
  options: ResolvedGanttRuntimeViewportOptions,
): GanttMeasuredViewportState {
  const clientHeight = nonNegativeFinite(measurement.clientHeight, 'Viewport clientHeight');
  const clientWidth = nonNegativeFinite(measurement.clientWidth, 'Viewport clientWidth');
  const verticalStart = nonNegativeFinite(measurement.verticalStart, 'Viewport verticalStart');
  const retained = measurement.retainedRange;
  if (
    retained !== undefined &&
    (!Number.isFinite(retained.start) ||
      !Number.isFinite(retained.end) ||
      retained.start < 0 ||
      retained.end <= retained.start)
  ) {
    throw new RangeError(
      'Viewport retainedRange must have finite, non-negative, increasing boundaries.',
    );
  }
  const visibleEnd = verticalStart + clientHeight;
  if (!Number.isFinite(visibleEnd)) {
    throw new RangeError('Measured viewport vertical range must remain finite.');
  }
  const queryVerticalStart = Math.min(
    Math.max(0, verticalStart - options.overscanBefore),
    retained?.start ?? Infinity,
  );
  const queryVerticalEnd = Math.max(visibleEnd + options.overscanAfter, retained?.end ?? -Infinity);
  if (!Number.isFinite(queryVerticalEnd)) {
    throw new RangeError('Measured viewport query range must remain finite.');
  }
  return Object.freeze({
    clientHeight,
    clientWidth,
    overscanAfter: options.overscanAfter,
    overscanBefore: options.overscanBefore,
    queryVerticalExtent: queryVerticalEnd - queryVerticalStart,
    queryVerticalStart,
    status: 'measured',
    verticalStart,
  });
}

export function viewportForIntent(
  viewport: GanttMeasuredViewportState,
  verticalStart: number,
  options: ResolvedGanttRuntimeViewportOptions,
): GanttMeasuredViewportState {
  if (viewport.verticalStart === verticalStart) {
    return viewport;
  }
  return viewport.status === 'unmeasured'
    ? createUnmeasuredViewport(verticalStart, options)
    : measureViewport(
        {
          clientHeight: viewport.clientHeight,
          clientWidth: viewport.clientWidth,
          verticalStart,
        },
        options,
      );
}

export function viewportEqual(
  previous: GanttMeasuredViewportState,
  next: GanttMeasuredViewportState,
): boolean {
  return (
    previous.status === next.status &&
    previous.clientHeight === next.clientHeight &&
    previous.clientWidth === next.clientWidth &&
    previous.verticalStart === next.verticalStart &&
    previous.queryVerticalStart === next.queryVerticalStart &&
    previous.queryVerticalExtent === next.queryVerticalExtent &&
    previous.overscanBefore === next.overscanBefore &&
    previous.overscanAfter === next.overscanAfter
  );
}

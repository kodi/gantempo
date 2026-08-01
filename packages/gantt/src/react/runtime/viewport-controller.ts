import { shiftVerticalViewport } from '../../interaction/viewport-navigation';
import type { GanttDirection } from '../../localization/types';
import type { GanttDocument, TimeRange } from '../../model/types';
import { resolveTaskPresentations } from '../../presentation/resolve-task-presentations';
import type { GanttMeasuredViewportState, GanttSessionState } from '../../runtime/types';
import {
  clampTimeScaleLevel,
  fitTimeRange,
  zoomRangeToLevel,
  type GanttTimeScaleDefinition,
  type GanttTimeScaleLevel,
} from '../../time/adaptive-scale';
import type { GanttHandle, GanttSemanticEvent } from '../types';
import type { GanttViewportNavigationInput, GanttViewportNavigationResult } from '../runtime';
import { projectSessionPart } from './selector-snapshot';

type ViewportSource = Extract<GanttSemanticEvent['source'], 'imperative' | 'runtime'>;

interface RuntimeViewportControllerOptions {
  readonly announceEmpty: () => void;
  readonly getDirection: () => GanttDirection;
  readonly getDocument: () => GanttDocument;
  readonly getRange: () => TimeRange;
  readonly getSession: () => GanttSessionState;
  readonly getTimeScale: () => GanttTimeScaleDefinition;
  readonly getTimelineHeight: () => number;
  readonly getTimeZone: () => string;
  readonly getViewport: () => GanttMeasuredViewportState;
  readonly requestRange: (
    range: TimeRange,
    reason: 'fit' | 'zoom',
    source: ViewportSource,
    anchorTime?: number,
  ) => boolean;
  readonly shiftRangeByPixels: (
    delta: number,
    viewportWidth: number,
    source: ViewportSource,
    reason: 'pan' | 'scroll',
  ) => boolean;
  readonly updateSession: (session: GanttSessionState, source: ViewportSource) => boolean;
}

export interface RuntimeViewportController {
  fitProject(options: Parameters<GanttHandle['fitToProject']>[0], source: ViewportSource): boolean;
  navigate(input: GanttViewportNavigationInput): GanttViewportNavigationResult;
  zoomLevel(
    level: GanttTimeScaleLevel,
    options: Parameters<GanttHandle['zoomTo']>[1],
    source: ViewportSource,
  ): boolean;
}

export function createRuntimeViewportController(
  options: RuntimeViewportControllerOptions,
): RuntimeViewportController {
  const controller: RuntimeViewportController = {
    fitProject(fitOptions, source) {
      const presentations = resolveTaskPresentations(
        options.getDocument(),
        options.getTimeZone(),
      ).presentations;
      const intervals = presentations.flatMap((presentation) =>
        presentation.interval === undefined ? [] : [presentation.interval],
      );
      if (intervals.length === 0) {
        options.announceEmpty();
        return false;
      }
      const bounds = Object.freeze({
        end: Math.max(...intervals.map((interval) => interval.end)),
        start: Math.min(...intervals.map((interval) => interval.start)),
      });
      const viewport = options.getViewport();
      const width = viewport.status === 'measured' ? viewport.clientWidth : 960;
      const range = fitTimeRange(bounds, width, fitOptions);
      return range === undefined ? false : options.requestRange(range, 'fit', source);
    },
    navigate(input) {
      const source = input.source ?? 'runtime';
      const horizontalDelta =
        input.horizontalDelta === undefined
          ? undefined
          : input.horizontalDelta * (options.getDirection() === 'rtl' ? -1 : 1);
      const horizontal =
        horizontalDelta === undefined
          ? false
          : options.shiftRangeByPixels(
              horizontalDelta,
              input.viewportWidth,
              source,
              input.reason ?? 'scroll',
            );
      let vertical = false;
      if (input.verticalDelta !== undefined) {
        const session = options.getSession();
        const verticalStart = shiftVerticalViewport(
          session.viewport.verticalStart,
          input.verticalDelta,
          options.getTimelineHeight(),
          input.viewportHeight,
        );
        if (verticalStart !== undefined && verticalStart !== session.viewport.verticalStart) {
          vertical = options.updateSession(
            Object.freeze({
              ...(session.focused === undefined ? {} : { focused: session.focused }),
              ...projectSessionPart(session),
              selection: session.selection,
              viewport: Object.freeze({ verticalStart }),
            }),
            source,
          );
        }
      }
      return Object.freeze({ horizontal, vertical });
    },
    zoomLevel(level, zoomOptions, source) {
      const timeScale = options.getTimeScale();
      const acceptedLevel =
        timeScale.kind === 'adaptive' ? clampTimeScaleLevel(level, timeScale) : level;
      const currentRange = options.getRange();
      const range = zoomRangeToLevel(currentRange, acceptedLevel, zoomOptions);
      const anchorRatio = zoomOptions?.anchorRatio ?? 0.5;
      const anchorTime =
        zoomOptions?.anchorTime ??
        currentRange.start + (currentRange.end - currentRange.start) * anchorRatio;
      return range === undefined ? false : options.requestRange(range, 'zoom', source, anchorTime);
    },
  };
  return Object.freeze(controller);
}

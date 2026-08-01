import { useEffect, type RefObject } from 'react';

import {
  normalizeNavigationDelta,
  type NavigationDeltaUnit,
} from '../../../interaction/viewport-navigation';
import { adjacentTimeScaleLevel } from '../../../time/adaptive-scale';
import type { GanttReactRuntime } from '../../runtime';

const WHEEL_LINE_SIZE = 16;
const MEANINGFUL_WHEEL_DELTA = 0.5;

function wheelDeltaUnit(deltaMode: number): NavigationDeltaUnit {
  return deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 'line'
    : deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? 'page'
      : 'pixel';
}

function excludesChartWheel(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, button, a[href], [contenteditable="true"], [data-gt-part="overlay-host"]',
    ) !== null
  );
}

export function useWheelNavigation({
  bodyRef,
  chartRef,
  direction,
  empty,
  runtime,
  timelineRef,
}: {
  readonly bodyRef: RefObject<HTMLDivElement | null>;
  readonly chartRef: RefObject<HTMLDivElement | null>;
  readonly direction: 'ltr' | 'rtl';
  readonly empty: boolean;
  readonly runtime: GanttReactRuntime;
  readonly timelineRef: RefObject<HTMLDivElement | null>;
}): void {
  useEffect(() => {
    const body = bodyRef.current;
    const chart = chartRef.current;
    const timeline = timelineRef.current;
    if (body === null || chart === null || timeline === null) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || excludesChartWheel(event.target)) return;
      if (event.altKey) {
        const current = runtime.getSnapshot().selector;
        const zoomDirection = event.deltaY < 0 ? 'in' : event.deltaY > 0 ? 'out' : undefined;
        const level =
          zoomDirection === undefined
            ? current.scaleLevel
            : adjacentTimeScaleLevel(current.scaleLevel, zoomDirection);
        if (zoomDirection === undefined || level === current.scaleLevel) return;
        const bounds = timeline.getBoundingClientRect();
        if (bounds.width <= 0) return;
        const physicalRatio = Math.max(
          0,
          Math.min(1, (event.clientX - bounds.left) / bounds.width),
        );
        const anchorRatio = direction === 'rtl' ? 1 - physicalRatio : physicalRatio;
        const anchorTime =
          current.range.start + (current.range.end - current.range.start) * anchorRatio;
        if (!runtime.zoomTo(level, { anchorRatio, anchorTime })) return;
        event.preventDefault();
        return;
      }
      const unit = wheelDeltaUnit(event.deltaMode);
      const horizontalDelta = normalizeNavigationDelta(event.deltaX, unit, {
        lineSize: WHEEL_LINE_SIZE,
        pageSize: timeline.clientWidth,
      });
      const verticalDelta = normalizeNavigationDelta(event.deltaY, unit, {
        lineSize: WHEEL_LINE_SIZE,
        pageSize: body.clientHeight,
      });
      const hasHorizontal = Math.abs(horizontalDelta) >= MEANINGFUL_WHEEL_DELTA;
      const shiftedVertical = event.shiftKey && !hasHorizontal ? verticalDelta : 0;
      const acceptedHorizontal = hasHorizontal ? horizontalDelta : shiftedVertical;
      if (acceptedHorizontal === 0) return;
      const horizontal = runtime.navigateViewport({
        horizontalDelta: acceptedHorizontal,
        viewportHeight: body.clientHeight,
        viewportWidth: timeline.clientWidth,
      });
      if (!horizontal.horizontal) return;
      const acceptedVertical = shiftedVertical === 0 ? verticalDelta : 0;
      if (acceptedVertical !== 0) {
        const vertical = runtime.navigateViewport({
          verticalDelta: acceptedVertical,
          viewportHeight: body.clientHeight,
          viewportWidth: timeline.clientWidth,
        });
        if (!vertical.vertical) {
          const maxScrollTop = Math.max(0, body.scrollHeight - body.clientHeight);
          body.scrollTop = Math.max(0, Math.min(maxScrollTop, body.scrollTop + acceptedVertical));
        }
      }
      event.preventDefault();
    };
    chart.addEventListener('wheel', onWheel, { passive: false });
    return () => chart.removeEventListener('wheel', onWheel);
  }, [bodyRef, chartRef, direction, empty, runtime, timelineRef]);
}

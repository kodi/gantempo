import { useEffect, type RefObject } from 'react';

import type { GanttReactRuntime } from '../../runtime';

export function useMeasuredViewport({
  bodyRef,
  empty,
  runtime,
  timelineRef,
}: {
  readonly bodyRef: RefObject<HTMLDivElement | null>;
  readonly empty: boolean;
  readonly runtime: GanttReactRuntime;
  readonly timelineRef: RefObject<HTMLDivElement | null>;
}): void {
  useEffect(() => {
    const body = bodyRef.current;
    const timeline = timelineRef.current;
    if (body === null || timeline === null) return;
    const measure = () => {
      const current = runtime.getSnapshot();
      const focused = current.selector.session.focused;
      const focusedTask =
        focused?.kind === 'task'
          ? current.scene.taskBars.find((task) => task.viewKey === focused.viewKey)
          : undefined;
      const candidate =
        'preview' in current.selector.interaction
          ? current.selector.interaction.preview
          : undefined;
      const preview = candidate?.kind === 'dependency' ? undefined : candidate;
      const retainedStart =
        focusedTask === undefined && preview === undefined
          ? undefined
          : Math.max(
              0,
              Math.min(focusedTask?.y ?? Infinity, preview?.y ?? Infinity) -
                (preview === undefined ? 0 : current.scene.bounds.defaultLaneHeight * 2),
            );
      const retainedEnd =
        focusedTask === undefined && preview === undefined
          ? undefined
          : Math.max(
              focusedTask === undefined ? -Infinity : focusedTask.y + focusedTask.height,
              preview === undefined ? -Infinity : preview.y + preview.height,
            ) + (preview === undefined ? 0 : current.scene.bounds.defaultLaneHeight * 2);
      runtime.measure({
        clientHeight: body.clientHeight,
        clientWidth: timeline.clientWidth,
        verticalStart: body.scrollTop,
        ...(retainedStart === undefined || retainedEnd === undefined
          ? {}
          : { retainedRange: { end: retainedEnd, start: retainedStart } }),
      });
    };
    body.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    observer?.observe(body);
    observer?.observe(timeline);
    measure();
    return () => {
      body.removeEventListener('scroll', measure);
      observer?.disconnect();
      runtime.clearMeasurement();
    };
  }, [bodyRef, empty, runtime, timelineRef]);
}

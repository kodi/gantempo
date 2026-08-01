import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface PointerGeometry {
  readonly height: number;
  readonly verticalStart: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface PointerInput {
  readonly candidateViewKey?: string;
  readonly geometry: PointerGeometry;
  readonly point: { readonly x: number; readonly y: number };
  readonly pointerId: number;
  readonly progressCandidateViewKey?: string;
}

function taskViewKey(target: EventTarget | null): string | undefined {
  return target instanceof Element
    ? target.closest<SVGGElement>('[data-gt-part="task"]')?.dataset.viewKey
    : undefined;
}

function progressTaskViewKey(target: EventTarget | null): string | undefined {
  return target instanceof Element &&
    target.closest('[data-gt-part="progress-handle"], [data-gt-part="progress-hit-target"]') !==
      null
    ? taskViewKey(target)
    : undefined;
}

export function usePointerInputAdapter({
  bodyRef,
  timelineRef,
}: {
  readonly bodyRef: RefObject<HTMLDivElement | null>;
  readonly timelineRef: RefObject<HTMLDivElement | null>;
}): {
  readonly dependencyCandidateViewKey: (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => string | undefined;
  readonly geometry: () => PointerGeometry | undefined;
  readonly pointerInput: (event: ReactPointerEvent<HTMLDivElement>) => PointerInput | undefined;
  readonly pointerType: (event: ReactPointerEvent<HTMLDivElement>) => 'mouse' | 'pen' | 'touch';
} {
  const geometry = useCallback((): PointerGeometry | undefined => {
    const body = bodyRef.current;
    const timeline = timelineRef.current;
    if (body === null || timeline === null) return undefined;
    const bodyRect = body.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const height = body.clientHeight || bodyRect.height;
    if (timelineRect.width <= 0 || height <= 0) return undefined;
    return {
      height,
      verticalStart: body.scrollTop,
      width: timelineRect.width,
      x: timelineRect.left,
      y: bodyRect.top,
    };
  }, [bodyRef, timelineRef]);
  const dependencyCandidateViewKey = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): string | undefined => {
      const pointed = event.currentTarget.ownerDocument.elementFromPoint?.(
        event.clientX,
        event.clientY,
      );
      return taskViewKey(pointed ?? event.target);
    },
    [],
  );
  const pointerInput = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): PointerInput | undefined => {
      const bounds = geometry();
      if (bounds === undefined) return undefined;
      const candidateViewKey = taskViewKey(event.target);
      const progressCandidateViewKey = progressTaskViewKey(event.target);
      return {
        ...(candidateViewKey === undefined ? {} : { candidateViewKey }),
        geometry: bounds,
        point: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        ...(progressCandidateViewKey === undefined ? {} : { progressCandidateViewKey }),
      };
    },
    [geometry],
  );
  const pointerType = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    return event.pointerType === 'touch' || event.pointerType === 'pen'
      ? event.pointerType
      : 'mouse';
  }, []);
  return { dependencyCandidateViewKey, geometry, pointerInput, pointerType };
}

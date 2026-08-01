import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

import type { TaskBarPrimitive } from '../../../render/primitives';
import type { GanttReactRuntime } from '../../runtime';
import { usePointerInputAdapter } from './usePointerInputAdapter';

export function usePointerInteractions({
  bodyRef,
  createTaskEnabled,
  disabled,
  dismissOverlays,
  editorOpen,
  panCapable,
  runtime,
  timelineRef,
}: {
  readonly bodyRef: RefObject<HTMLDivElement | null>;
  readonly createTaskEnabled: boolean;
  readonly disabled: boolean;
  readonly dismissOverlays: () => void;
  readonly editorOpen: boolean;
  readonly panCapable: boolean;
  readonly runtime: GanttReactRuntime;
  readonly timelineRef: RefObject<HTMLDivElement | null>;
}) {
  const activationPointer = useRef<
    { moved: boolean; readonly viewKey: string; readonly x: number; readonly y: number } | undefined
  >(undefined);
  const dependencyPointer = useRef<number | undefined>(undefined);
  const [panState, setPanState] = useState<'idle' | 'panning' | 'pressing'>('idle');
  const { dependencyCandidateViewKey, geometry, pointerInput, pointerType } =
    usePointerInputAdapter({ bodyRef, timelineRef });

  const consumeTaskDrag = useCallback((viewKey: string): boolean => {
    const pointer = activationPointer.current;
    activationPointer.current = undefined;
    return pointer?.viewKey === viewKey && pointer.moved;
  }, []);
  const onLinkPointerDown = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>, task: TaskBarPrimitive) => {
      if (disabled || event.button !== 0 || event.isPrimary === false) return;
      const resolvedPointerType =
        event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
      if (!runtime.beginDependencyLink(task.viewKey, resolvedPointerType)) return;
      dependencyPointer.current = event.pointerId;
      dismissOverlays();
      event.preventDefault();
      event.stopPropagation();
      try {
        timelineRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic adapters can lack a browser-managed active pointer.
      }
    },
    [disabled, dismissOverlays, runtime, timelineRef],
  );
  const beginPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, axis: 'both' | 'horizontal'): boolean => {
      if (editorOpen || event.pointerType !== 'mouse' || event.isPrimary === false) return false;
      const input = pointerInput(event);
      if (
        input === undefined ||
        !runtime.panPointerDown({
          axis,
          geometry: input.geometry,
          point: input.point,
          pointerId: input.pointerId,
        })
      ) {
        return false;
      }
      dismissOverlays();
      setPanState('pressing');
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic adapters can lack a browser-managed active pointer.
      }
      return true;
    },
    [dismissOverlays, editorOpen, pointerInput, runtime],
  );
  const movePan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): boolean => {
      const input = pointerInput(event);
      if (input === undefined) return false;
      const result = runtime.panPointerMove(input);
      if (!result.handled) return false;
      if (result.active) setPanState('panning');
      event.preventDefault();
      return true;
    },
    [pointerInput, runtime],
  );
  const finishPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, cancel: boolean): boolean => {
      const result = cancel
        ? { active: false, handled: runtime.panPointerCancel(event.pointerId) }
        : runtime.panPointerUp(event.pointerId);
      if (!result.handled) return false;
      setPanState('idle');
      event.preventDefault();
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Capture can already be released before cancellation or pointerup.
      }
      return true;
    },
    [runtime],
  );
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const input = pointerInput(event);
      const mousePan =
        event.pointerType === 'mouse' &&
        event.isPrimary !== false &&
        (event.button === 1 ||
          (event.button === 0 && input?.candidateViewKey === undefined && !createTaskEnabled));
      if (mousePan) {
        if (beginPan(event, 'both')) return;
        if (event.button === 1 || panCapable || editorOpen) return;
      }
      if (event.button !== 0 || event.isPrimary === false || input === undefined) return;
      activationPointer.current =
        input.candidateViewKey === undefined
          ? undefined
          : {
              moved: false,
              viewKey: input.candidateViewKey,
              x: event.clientX,
              y: event.clientY,
            };
      if (input.candidateViewKey === undefined) {
        runtime.clearTaskFocusAndSelection();
        const activeElement = event.currentTarget.ownerDocument.activeElement;
        if (
          (activeElement instanceof HTMLElement || activeElement instanceof SVGElement) &&
          event.currentTarget.contains(activeElement) &&
          activeElement.closest('[data-gt-part="task"]') !== null
        ) {
          activeElement.blur();
        }
        if (mousePan) return;
      }
      if (disabled || !runtime.pointerDown({ ...input, pointerType: pointerType(event) })) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic adapters can lack a browser-managed active pointer.
      }
    },
    [
      beginPan,
      createTaskEnabled,
      disabled,
      editorOpen,
      panCapable,
      pointerInput,
      pointerType,
      runtime,
    ],
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dependencyPointer.current === event.pointerId) {
        runtime.updateDependencyLink(dependencyCandidateViewKey(event));
        event.preventDefault();
        return;
      }
      if (movePan(event)) return;
      const input = pointerInput(event);
      const activation = activationPointer.current;
      if (
        activation !== undefined &&
        !activation.moved &&
        Math.hypot(event.clientX - activation.x, event.clientY - activation.y) >= 4
      ) {
        activationPointer.current = { ...activation, moved: true };
      }
      if (input !== undefined && runtime.pointerMove(input)) event.preventDefault();
    },
    [dependencyCandidateViewKey, movePan, pointerInput, runtime],
  );
  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dependencyPointer.current === event.pointerId) {
        runtime.updateDependencyLink(dependencyCandidateViewKey(event));
        dependencyPointer.current = undefined;
        event.preventDefault();
        try {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Capture can already be released by the browser before pointerup dispatch.
        }
        void runtime.commitDependencyLink();
        return;
      }
      if (finishPan(event, false) || disabled) return;
      event.preventDefault();
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Capture can already be released by the browser before pointerup dispatch.
      }
      void runtime.pointerUp(event.pointerId);
    },
    [dependencyCandidateViewKey, disabled, finishPan, runtime],
  );
  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dependencyPointer.current === event.pointerId) {
        dependencyPointer.current = undefined;
        runtime.cancelDependencyLink();
        event.preventDefault();
        return;
      }
      activationPointer.current = undefined;
      if (finishPan(event, true)) return;
      if (runtime.pointerCancel(event.pointerId)) event.preventDefault();
    },
    [finishPan, runtime],
  );
  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button === 0) beginPan(event, 'horizontal');
    },
    [beginPan],
  );
  const onHeaderPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      movePan(event);
    },
    [movePan],
  );
  const onHeaderPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishPan(event, false);
    },
    [finishPan],
  );
  const onHeaderPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishPan(event, true);
    },
    [finishPan],
  );

  return {
    consumeTaskDrag,
    geometry,
    onHeaderPointerCancel,
    onHeaderPointerDown,
    onHeaderPointerMove,
    onHeaderPointerUp,
    onLinkPointerDown,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    panState,
  };
}

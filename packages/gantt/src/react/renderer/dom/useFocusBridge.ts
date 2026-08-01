import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useFocusBridge({
  bodyRef,
  focusedDependencyId,
  focusedViewKey,
  logicalTaskFocused,
  rootRef,
  verticalStart,
}: {
  readonly bodyRef: RefObject<HTMLDivElement | null>;
  readonly focusedDependencyId: string | undefined;
  readonly focusedViewKey: string | undefined;
  readonly logicalTaskFocused: boolean;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly verticalStart: number;
}): void {
  const hadLogicalTaskFocus = useRef(false);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body !== null && body.scrollTop !== verticalStart) body.scrollTop = verticalStart;
  }, [bodyRef, verticalStart]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    if (focusedViewKey !== undefined) {
      hadLogicalTaskFocus.current = true;
      const task = Array.from(root.querySelectorAll<SVGGElement>('[data-gt-part="task"]')).find(
        (element) => element.dataset.viewKey === focusedViewKey,
      );
      if (task !== undefined && root.ownerDocument.activeElement !== task) task.focus();
      return;
    }
    if (focusedDependencyId !== undefined) {
      const dependency = Array.from(
        root.querySelectorAll<SVGGElement>('[data-gt-part="dependency"]'),
      ).find((element) => element.dataset.dependencyId === focusedDependencyId);
      if (dependency !== undefined && root.ownerDocument.activeElement !== dependency) {
        dependency.focus();
      }
      return;
    }
    if (logicalTaskFocused) {
      if (hadLogicalTaskFocus.current) root.focus();
      hadLogicalTaskFocus.current = true;
      return;
    }
    if (hadLogicalTaskFocus.current) {
      hadLogicalTaskFocus.current = false;
      root.focus();
    }
  }, [focusedDependencyId, focusedViewKey, logicalTaskFocused, rootRef]);
}

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
  type ReactElement,
} from 'react';

import type { GanttReactRuntime } from './runtime';
import type { GanttSelector, GanttSelectorEquality, GanttSelectorSnapshot } from './types';

const GanttRuntimeContext = createContext<GanttReactRuntime | undefined>(undefined);

export function GanttRuntimeProvider({
  children,
  runtime,
}: PropsWithChildren<{ readonly runtime: GanttReactRuntime }>): ReactElement {
  return <GanttRuntimeContext.Provider value={runtime}>{children}</GanttRuntimeContext.Provider>;
}

export function useGanttSelector<T>(
  selector: GanttSelector<T>,
  isEqual: GanttSelectorEquality<T> = Object.is,
): T {
  const runtime = useContext(GanttRuntimeContext);
  if (runtime === undefined) {
    throw new Error(
      'runtime.selector-outside-provider: useGanttSelector must be used inside its owning Gantt.',
    );
  }
  const cache = useRef<
    | {
        equality: GanttSelectorEquality<T>;
        selector: GanttSelector<T>;
        snapshot: GanttSelectorSnapshot;
        value: T;
      }
    | undefined
  >(undefined);
  if (cache.current?.selector !== selector || cache.current.equality !== isEqual) {
    cache.current = undefined;
  }
  const getSelectedSnapshot = useCallback(() => {
    const nextSnapshot = runtime.getSnapshot().selector;
    const current = cache.current;
    if (current !== undefined && current.snapshot === nextSnapshot) {
      return current.value;
    }
    const next = selector(nextSnapshot);
    if (current !== undefined && isEqual(current.value, next)) {
      cache.current = { ...current, snapshot: nextSnapshot };
      return current.value;
    }
    cache.current = {
      equality: isEqual,
      selector,
      snapshot: nextSnapshot,
      value: next,
    };
    return next;
  }, [isEqual, runtime, selector]);

  const subscribe = useCallback(
    (subscriber: () => void) => runtime.subscribe(subscriber),
    [runtime],
  );
  return useSyncExternalStore(subscribe, getSelectedSnapshot, getSelectedSnapshot);
}

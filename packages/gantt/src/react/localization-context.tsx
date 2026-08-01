import { createContext, createElement, useContext, type ReactNode } from 'react';

import { createGanttLocalization, type GanttLocalization } from '../localization/format';

const DEFAULT_LOCALIZATION = createGanttLocalization({ timeZone: 'UTC' });
const GanttLocalizationContext = createContext<GanttLocalization>(DEFAULT_LOCALIZATION);

export function GanttLocalizationProvider({
  children,
  value,
}: {
  readonly children: ReactNode;
  readonly value: GanttLocalization;
}) {
  return createElement(GanttLocalizationContext.Provider, { value }, children);
}

export function useGanttLocalization(): GanttLocalization {
  return useContext(GanttLocalizationContext);
}

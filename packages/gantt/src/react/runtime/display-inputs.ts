import { createGanttLocalization, type GanttLocalization } from '../../localization/format';
import type { GanttDirection } from '../../localization/types';
import type { Diagnostic } from '../../model/diagnostics';
import type { GanttDocument, TimeRange } from '../../model/types';
import { timeScaleLevelSpan, type GanttTimeScaleDefinition } from '../../time/adaptive-scale';
import { sameViewDefinition } from '../../view/definition-equality';
import type { GanttProps } from '../types';

export interface DisplayInputs {
  readonly appearanceVariants: GanttProps['appearanceVariants'];
  readonly direction: GanttDirection;
  readonly formatters: GanttProps['formatters'];
  readonly locale: string;
  readonly localization: GanttLocalization;
  readonly messages: GanttProps['messages'];
  readonly range: TimeRange;
  readonly taskVariants: GanttProps['taskVariants'];
  readonly timeScale: GanttTimeScaleDefinition;
  readonly tickAnchor: number;
  readonly tickInterval: number;
  readonly timeZone: string;
  readonly view: GanttProps['view'];
}

export function controlledDocument(props: GanttProps): GanttDocument | undefined {
  return props.document;
}

export function initialDocument(props: GanttProps): GanttDocument {
  return props.document ?? props.defaultDocument;
}

export function initialSession(props: GanttProps) {
  if (props.session !== undefined) return { kind: 'controlled' as const, value: props.session };
  return props.defaultSession === undefined
    ? { kind: 'uncontrolled' as const }
    : { kind: 'uncontrolled' as const, value: props.defaultSession };
}

export function displayInputs(props: GanttProps, rangeOverride?: TimeRange): DisplayInputs {
  const localization = createGanttLocalization({
    ...(props.direction === undefined ? {} : { direction: props.direction }),
    ...(props.formatters === undefined ? {} : { formatters: props.formatters }),
    ...(props.locale === undefined ? {} : { locale: props.locale }),
    ...(props.messages === undefined ? {} : { messages: props.messages }),
    timeZone: props.timeZone,
  });
  const timeScale: GanttTimeScaleDefinition = props.timeScale ?? {
    kind: 'fixed',
    tickAnchor: props.tickAnchor!,
    tickInterval: props.tickInterval!,
  };
  return Object.freeze({
    appearanceVariants: props.appearanceVariants,
    direction: localization.direction,
    formatters: props.formatters,
    locale: localization.locale,
    localization,
    messages: props.messages,
    range: Object.freeze({ ...(rangeOverride ?? props.range ?? props.defaultRange) }),
    taskVariants: props.taskVariants,
    tickAnchor: timeScale.kind === 'fixed' ? timeScale.tickAnchor : 0,
    tickInterval: timeScale.kind === 'fixed' ? timeScale.tickInterval : timeScaleLevelSpan('day'),
    timeScale: Object.freeze({ ...timeScale }),
    timeZone: localization.timeZone,
    view: props.view,
  });
}

export function displayEqual(previous: DisplayInputs, next: DisplayInputs): boolean {
  return (
    JSON.stringify(previous.appearanceVariants) === JSON.stringify(next.appearanceVariants) &&
    previous.direction === next.direction &&
    previous.formatters === next.formatters &&
    previous.locale === next.locale &&
    JSON.stringify(previous.messages) === JSON.stringify(next.messages) &&
    previous.range.start === next.range.start &&
    previous.range.end === next.range.end &&
    previous.tickAnchor === next.tickAnchor &&
    previous.tickInterval === next.tickInterval &&
    JSON.stringify(previous.timeScale) === JSON.stringify(next.timeScale) &&
    previous.timeZone === next.timeZone &&
    JSON.stringify(previous.taskVariants) === JSON.stringify(next.taskVariants) &&
    sameViewDefinition(previous.view, next.view)
  );
}

export function timeScaleDiagnostics(timeScale: GanttTimeScaleDefinition): readonly Diagnostic[] {
  if (
    timeScale.kind !== 'adaptive' ||
    timeScale.minLevel === undefined ||
    timeScale.maxLevel === undefined ||
    timeScaleLevelSpan(timeScale.minLevel) <= timeScaleLevelSpan(timeScale.maxLevel)
  ) {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      code: 'time-scale.invalid-bounds' as const,
      message: 'Adaptive minimum level exceeds its maximum; the minimum bound is used.',
      path: '/timeScale',
      severity: 'warning' as const,
    }),
  ]);
}

export function uniqueDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  const seen = new Set<string>();
  return Object.freeze(
    diagnostics.filter((diagnostic) => {
      const key = `${diagnostic.code}\u0000${diagnostic.path ?? ''}\u0000${diagnostic.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

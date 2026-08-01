import type { Diagnostic } from '../model/diagnostics';
import type { EpochMilliseconds, LocalDateString } from '../model/types';
import type {
  GanttDirection,
  GanttFormatContext,
  GanttFormatUse,
  GanttFormatters,
  GanttMessageKey,
  GanttMessages,
  GanttMessageValues,
} from './types';

const DEFAULT_MESSAGES: Readonly<Record<GanttMessageKey, string>> = Object.freeze({
  'chart.empty': 'No scheduled project items to fit.',
  'chart.label': 'Gantt chart',
  'chart.read-only': 'Read only',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete {kind}',
  'common.save': 'Save {kind}',
  'dependency.create': 'Create dependency',
  'dependency.delete': 'Delete dependency',
  'dependency.edit': 'Edit dependency',
  'dependency.hidden-endpoint': 'One or more endpoints are hidden',
  'dependency.incoming': 'Incoming dependencies',
  'dependency.invalid': 'Invalid relationship',
  'dependency.lag': 'Lag',
  'dependency.outgoing': 'Outgoing dependencies',
  'dependency.relationships': 'Dependencies',
  'dependency.type.finish-to-finish': 'Finish to finish',
  'dependency.type.finish-to-start': 'Finish to start',
  'dependency.type.start-to-finish': 'Start to finish',
  'dependency.type.start-to-start': 'Start to start',
  'field.appearance': 'Appearance',
  'field.description': 'Description',
  'field.end': 'End',
  'field.kind': 'Kind',
  'field.lag': 'Lag',
  'field.lane': 'Lane',
  'field.order': 'Order',
  'field.parent': 'Parent',
  'field.progress': 'Progress',
  'field.start': 'Start',
  'field.title': 'Title',
  'interaction.cancelled': 'Keyboard interaction cancelled.',
  'interaction.committed': '{action} committed.',
  'interaction.create': 'Create',
  'interaction.link': 'Link',
  'interaction.move': 'Move',
  'interaction.progress': 'Progress',
  'interaction.rejected': 'Interaction rejected.',
  'interaction.resize': 'Resize',
  'interaction.selection': '{title} {state}.',
  'properties.edit': 'Edit',
  'properties.view': 'View',
  'task.kind.milestone': 'Milestone',
  'task.kind.summary': 'Summary',
  'task.kind.task': 'Task',
  'task.progress': '{progress} complete',
  'task.unscheduled': 'Unscheduled',
  'tree.collapse': 'Collapse {title}',
  'tree.expand': 'Expand {title}',
  'tree.filtered-ancestor': 'Retained ancestor',
  'tree.hidden-focus': 'Focus moved because the task is hidden.',
  'validation.summary': '{count} validation issues',
  'zoom.fit': 'Fit project',
  'zoom.in': 'Zoom in',
  'zoom.out': 'Zoom out',
});

export interface GanttLocalization {
  readonly customDate: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly direction: GanttDirection;
  readonly locale: string;
  readonly timeZone: string;
  date(value: LocalDateString, use: GanttFormatUse): string;
  dateTime(value: EpochMilliseconds, use: GanttFormatUse): string;
  message(key: GanttMessageKey, values?: GanttMessageValues, fallback?: string): string;
  number(value: number, use: GanttFormatUse): string;
}

export interface GanttLocalizationOptions {
  readonly direction?: GanttDirection;
  readonly formatters?: GanttFormatters;
  readonly locale?: string;
  readonly messages?: GanttMessages;
  readonly timeZone: string;
}

function interpolate(template: string, values: GanttMessageValues): string {
  return template.replaceAll(/\{([^{}]+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );
}

function normalizedLocale(value: string | undefined): {
  readonly diagnostic?: Diagnostic;
  readonly value: string;
} {
  try {
    return { value: Intl.getCanonicalLocales(value ?? 'en-US')[0] ?? 'en-US' };
  } catch {
    return {
      diagnostic: Object.freeze({
        code: 'format.invalid-locale',
        message: `Locale ${String(value)} is invalid; en-US is used.`,
        path: '/locale',
        severity: 'warning',
      }),
      value: 'en-US',
    };
  }
}

function normalizedTimeZone(value: string): {
  readonly diagnostic?: Diagnostic;
  readonly value: string;
} {
  try {
    return {
      value: new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone,
    };
  } catch {
    return {
      diagnostic: Object.freeze({
        code: 'format.invalid-time-zone',
        message: `Time zone ${value} is invalid; UTC is used.`,
        path: '/timeZone',
        severity: 'warning',
      }),
      value: 'UTC',
    };
  }
}

export function createGanttLocalization(options: GanttLocalizationOptions): GanttLocalization {
  const locale = normalizedLocale(options.locale);
  const timeZone = normalizedTimeZone(options.timeZone);
  const direction = options.direction ?? 'ltr';
  const diagnostics: Diagnostic[] = [
    [locale.diagnostic, timeZone.diagnostic].filter(
      (diagnostic): diagnostic is Diagnostic => diagnostic !== undefined,
    ),
  ].flat();
  const context = (use: GanttFormatUse): GanttFormatContext =>
    Object.freeze({ direction, locale: locale.value, timeZone: timeZone.value, use });
  const fallbackDateTime = new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone.value,
  });
  const fallbackDate = new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    // A LocalDateString has no instant to shift through the requested zone.
    timeZone: 'UTC',
  });
  const fallbackNumber = new Intl.NumberFormat(locale.value);
  const safe = (
    custom: (() => string) | undefined,
    fallback: () => string,
    code: 'format.date' | 'format.date-time' | 'format.message' | 'format.number',
    path: string,
  ): string => {
    if (custom !== undefined) {
      try {
        const result = custom();
        if (result.trim().length > 0) return result;
      } catch {
        // Consumer formatter failures must not break rendering or interaction.
      }
      if (!diagnostics.some((diagnostic) => diagnostic.code === code)) {
        diagnostics.push(
          Object.freeze({
            code,
            message: `The ${path} formatter returned no usable output; the built-in formatter is used.`,
            path: `/formatters/${path}`,
            severity: 'warning',
          }),
        );
      }
    }
    return fallback();
  };
  return Object.freeze({
    customDate: options.formatters?.date !== undefined,
    get diagnostics() {
      return Object.freeze([...diagnostics]);
    },
    direction,
    locale: locale.value,
    timeZone: timeZone.value,
    date(value: LocalDateString, use: GanttFormatUse) {
      return safe(
        options.formatters?.date === undefined
          ? undefined
          : () => options.formatters!.date!(value, context(use)),
        () => fallbackDate.format(new Date(`${value}T00:00:00Z`)),
        'format.date',
        'date',
      );
    },
    dateTime(value: EpochMilliseconds, use: GanttFormatUse) {
      return safe(
        options.formatters?.dateTime === undefined
          ? undefined
          : () => options.formatters!.dateTime!(value, context(use)),
        () => fallbackDateTime.format(value),
        'format.date-time',
        'dateTime',
      );
    },
    message(
      key: GanttMessageKey,
      values: GanttMessageValues = Object.freeze({}),
      fallback?: string,
    ) {
      const template = options.messages?.[key] ?? fallback ?? DEFAULT_MESSAGES[key];
      const formatted = safe(
        options.formatters?.message === undefined
          ? undefined
          : () => options.formatters!.message!({ defaultMessage: template, key, values }),
        () => template,
        'format.message',
        'message',
      );
      return interpolate(formatted, values);
    },
    number(value: number, use: GanttFormatUse) {
      return safe(
        options.formatters?.number === undefined
          ? undefined
          : () => options.formatters!.number!(value, context(use)),
        () => fallbackNumber.format(value),
        'format.number',
        'number',
      );
    },
  });
}

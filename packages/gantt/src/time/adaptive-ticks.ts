import type { TimeRange } from '../model/types';
import type { GanttTimeScaleLevel } from './adaptive-scale';

export interface AdaptiveTimeTick {
  readonly kind: 'major' | 'minor';
  readonly label: string;
  readonly time: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DEFAULT_TIMELINE_WIDTH = 960;

function labelWidth(level: GanttTimeScaleLevel): number {
  return level === 'year' ? 64 : level === 'minute' || level === 'hour' ? 72 : 88;
}

function fixedStep(level: GanttTimeScaleLevel): number | undefined {
  return level === 'minute'
    ? 15 * MINUTE
    : level === 'hour'
      ? 6 * HOUR
      : level === 'day'
        ? DAY
        : level === 'week'
          ? 7 * DAY
          : undefined;
}

function formatter(level: GanttTimeScaleLevel, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    ...(level === 'minute' || level === 'hour'
      ? { hour: '2-digit', minute: '2-digit' }
      : level === 'year'
        ? { year: 'numeric' }
        : {
            month: level === 'week' || level === 'day' ? 'short' : 'short',
            year: level === 'day' ? undefined : 'numeric',
            day: level === 'day' || level === 'week' ? 'numeric' : undefined,
          }),
    timeZone,
  });
}

export function generateAdaptiveTimeTicks(
  range: TimeRange,
  level: GanttTimeScaleLevel,
  locale: string,
  timeZone: string,
  width = DEFAULT_TIMELINE_WIDTH,
): readonly AdaptiveTimeTick[] {
  if (!Number.isFinite(width) || width <= 0) return Object.freeze([]);
  const format = formatter(level, locale, timeZone);
  const step = fixedStep(level);
  const maxMajorCount = Math.max(2, Math.floor(width / labelWidth(level)));
  const major: number[] = [];
  if (step !== undefined) {
    const anchor = level === 'week' ? Date.UTC(1970, 0, 5) : 0;
    const first = anchor + Math.ceil((range.start - anchor) / step) * step;
    const estimatedCount = Math.max(0, Math.ceil((range.end - first) / step));
    const stride = Math.max(1, Math.ceil(estimatedCount / maxMajorCount));
    for (let time = first; time < range.end; time += step * stride) {
      major.push(time);
    }
  } else {
    const start = new Date(range.start);
    const monthStep = level === 'month' ? 1 : level === 'quarter' ? 3 : 12;
    let year = start.getUTCFullYear();
    let month = level === 'year' ? 0 : Math.floor(start.getUTCMonth() / monthStep) * monthStep;
    let time = Date.UTC(year, month, 1);
    while (time < range.start) {
      month += monthStep;
      year += Math.floor(month / 12);
      month %= 12;
      time = Date.UTC(year, month, 1);
    }
    const end = new Date(range.end);
    const estimatedMonths = (end.getUTCFullYear() - year) * 12 + end.getUTCMonth() - month + 1;
    const stride = Math.max(1, Math.ceil(Math.max(0, estimatedMonths / monthStep) / maxMajorCount));
    while (time < range.end) {
      major.push(time);
      month += monthStep * stride;
      year += Math.floor(month / 12);
      month %= 12;
      time = Date.UTC(year, month, 1);
    }
  }
  const ticks: AdaptiveTimeTick[] = [];
  for (let index = 0; index < major.length; index += 1) {
    const time = major[index]!;
    ticks.push(Object.freeze({ kind: 'major', label: format.format(time), time }));
    const next = major[index + 1];
    if (next !== undefined) {
      ticks.push(Object.freeze({ kind: 'minor', label: '', time: time + (next - time) / 2 }));
    }
  }
  return Object.freeze(ticks);
}

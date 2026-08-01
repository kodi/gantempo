import { CalendarClock } from 'lucide-react';
import type { ReactElement } from 'react';

import { useGanttLocalization } from '../localization-context';
import type { GanttTooltipProps } from '../types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function localDateString(epoch: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(epoch);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatTooltipDateRange(
  start: number,
  end: number,
  localization: ReturnType<typeof useGanttLocalization>,
): string {
  if (localization.customDate) {
    const first = localization.date(localDateString(start, localization.timeZone), 'task-start');
    const last = localization.date(localDateString(end, localization.timeZone), 'task-end');
    return first === last ? first : `${first} – ${last}`;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  const monthDay = new Intl.DateTimeFormat(localization.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: localization.timeZone,
  });
  const fullDate = new Intl.DateTimeFormat(localization.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: localization.timeZone,
    year: 'numeric',
  });
  const startKey = localDateString(start, localization.timeZone);
  const endKey = localDateString(end, localization.timeZone);
  if (startKey === endKey) return fullDate.format(startDate);
  if (startKey.slice(0, 4) === endKey.slice(0, 4)) {
    return `${monthDay.format(startDate)} – ${monthDay.format(endDate)}, ${endKey.slice(0, 4)}`;
  }
  return `${fullDate.format(startDate)} – ${fullDate.format(endDate)}`;
}

function formatTooltipDuration(
  start: number,
  end: number,
  localization: ReturnType<typeof useGanttLocalization>,
): string {
  const duration = Math.max(0, end - start);
  if (duration === 0) {
    return 'Instant';
  }
  if (duration < MINUTE) {
    return '< 1 min';
  }
  const [value, unit] =
    duration >= DAY
      ? ([duration / DAY, 'day'] as const)
      : duration >= HOUR
        ? ([duration / HOUR, 'hr'] as const)
        : ([duration / MINUTE, 'min'] as const);
  const formatted = localization.number(Math.round(value * 10) / 10, 'dependency-lag');
  return `${formatted} ${unit}${unit === 'day' && formatted !== '1' ? 's' : ''}`;
}

export function DefaultTooltip({ bindings, task }: GanttTooltipProps): ReactElement {
  const localization = useGanttLocalization();
  return (
    <div {...bindings}>
      <strong>{task.title}</strong>
      <span data-gt-part="tooltip-kind">
        {task.kind === 'summary'
          ? `${localization.message('task.kind.summary')}${
              task.descendantCount === undefined ? '' : ` · ${task.descendantCount} descendants`
            }`
          : localization.message(`task.kind.${task.kind}`)}
      </span>
      <div className="gt-gantt__tooltip-schedule" data-gt-part="tooltip-schedule">
        <CalendarClock aria-hidden="true" />
        <span data-gt-part="tooltip-range">
          {formatTooltipDateRange(task.start, task.end, localization)}
        </span>
        <span className="gt-gantt__tooltip-duration" data-gt-part="tooltip-duration">
          {formatTooltipDuration(task.start, task.end, localization)}
        </span>
      </div>
    </div>
  );
}

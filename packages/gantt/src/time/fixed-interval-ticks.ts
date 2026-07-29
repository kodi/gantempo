import type { EpochMilliseconds, TimeRange } from '../model/types';

export interface FixedIntervalTick {
  readonly time: EpochMilliseconds;
  readonly label: string;
}

export interface FixedIntervalTickOptions {
  readonly range: TimeRange;
  readonly anchor: EpochMilliseconds;
  readonly interval: number;
  readonly timeZone: string;
  readonly locale?: string;
}

export function generateFixedIntervalTicks({
  range,
  anchor,
  interval,
  timeZone,
  locale = 'en-US',
}: FixedIntervalTickOptions): readonly FixedIntervalTick[] {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
    throw new RangeError('Tick range must contain finite values with end after start.');
  }
  if (!Number.isFinite(anchor)) {
    throw new RangeError('Tick anchor must be finite.');
  }
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new RangeError('Tick interval must be a positive finite duration.');
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    timeZone,
  });
  const firstTick = anchor + Math.ceil((range.start - anchor) / interval) * interval;
  const ticks: FixedIntervalTick[] = [];

  for (let time = firstTick; time < range.end; time += interval) {
    ticks.push({ time, label: formatter.format(time) });
  }

  return ticks;
}

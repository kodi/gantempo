const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEARCH_MARGIN = 3 * 24 * 60 * 60 * 1_000;

function canonicalDateParts(value: string): readonly [number, number, number] | undefined {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const date = new Date(epoch);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? [year, month, day]
    : undefined;
}

function localDateKey(formatter: Intl.DateTimeFormat, instant: number): string {
  const values = new Map(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
      .map((part) => [part.type, part.value]),
  );
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

/** Returns the first instant belonging to a canonical local date in an explicit zone. */
export function zonedStartOfDay(localDate: string, timeZone: string): number | undefined {
  const parts = canonicalDateParts(localDate);
  if (!parts) {
    return undefined;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  });
  const approximate = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  let lower = approximate - SEARCH_MARGIN;
  let upper = approximate + SEARCH_MARGIN;

  while (lower + 1 < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (localDateKey(formatter, middle) < localDate) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return localDateKey(formatter, upper) === localDate ? upper : undefined;
}

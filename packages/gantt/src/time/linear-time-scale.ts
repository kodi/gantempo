import type { EpochMilliseconds, TimeRange } from '../model/types';

export interface NumericRange {
  readonly start: number;
  readonly end: number;
}

export interface LinearTimeScale {
  readonly domain: TimeRange;
  readonly range: NumericRange;
  timeToX(time: EpochMilliseconds): number;
  xToTime(x: number): EpochMilliseconds;
}

function validateFiniteRange(name: string, start: number, end: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new RangeError(`${name} values must be finite.`);
  }

  if (end <= start) {
    throw new RangeError(`${name} end must be greater than its start.`);
  }
}

export function createLinearTimeScale(domain: TimeRange, range: NumericRange): LinearTimeScale {
  validateFiniteRange('Time domain', domain.start, domain.end);
  validateFiniteRange('Output range', range.start, range.end);

  const frozenDomain = Object.freeze({ ...domain });
  const frozenRange = Object.freeze({ ...range });
  const domainSpan = frozenDomain.end - frozenDomain.start;
  const rangeSpan = frozenRange.end - frozenRange.start;

  return Object.freeze({
    domain: frozenDomain,
    range: frozenRange,
    timeToX(time: EpochMilliseconds): number {
      if (!Number.isFinite(time)) {
        throw new RangeError('Time must be finite.');
      }
      return frozenRange.start + ((time - frozenDomain.start) / domainSpan) * rangeSpan;
    },
    xToTime(x: number): EpochMilliseconds {
      if (!Number.isFinite(x)) {
        throw new RangeError('Coordinate must be finite.');
      }
      return frozenDomain.start + ((x - frozenRange.start) / rangeSpan) * domainSpan;
    },
  });
}

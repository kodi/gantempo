import {
  normalizeTimeRange,
  shiftTimeRange,
  shiftTimeRangeByPixels,
} from '../interaction/viewport-navigation';
import type { TimeRange } from '../model/types';

export type RangeProposalSource = 'imperative' | 'runtime';

export interface RangeProposalControllerOptions {
  readonly canPublish: () => boolean;
  readonly initialRange: TimeRange;
  readonly publish: (range: TimeRange, source: RangeProposalSource) => void;
  readonly schedule: (publish: () => void) => (() => void) | undefined | void;
}

export interface RangeProposalController {
  adopt(range: TimeRange): void;
  dispose(): void;
  getPending(): TimeRange | undefined;
  requestRange(range: TimeRange, source: RangeProposalSource): boolean;
  shiftByPixels(pixelDelta: number, viewportWidth: number, source: RangeProposalSource): boolean;
  shiftByTime(delta: number, source: RangeProposalSource): boolean;
}

function sameRange(left: TimeRange, right: TimeRange): boolean {
  return left.start === right.start && left.end === right.end;
}

export function createRangeProposalController(
  options: RangeProposalControllerOptions,
): RangeProposalController {
  const initialRange = normalizeTimeRange(options.initialRange);
  if (initialRange === undefined) {
    throw new RangeError('The initial proposal range must be finite and increasing.');
  }
  let adopted = initialRange;
  let pending: TimeRange | undefined;
  let pendingSource: RangeProposalSource = 'runtime';
  let publicationScheduled = false;
  let cancelPublication: (() => void) | undefined;
  let disposed = false;

  function cancelScheduledPublication(): void {
    cancelPublication?.();
    cancelPublication = undefined;
    publicationScheduled = false;
  }

  function publishPending(): void {
    publicationScheduled = false;
    cancelPublication = undefined;
    if (disposed || pending === undefined || !options.canPublish()) {
      return;
    }
    options.publish(pending, pendingSource);
  }

  function schedulePublication(): void {
    if (publicationScheduled) {
      return;
    }
    publicationScheduled = true;
    const cancellation = options.schedule(publishPending);
    if (publicationScheduled && typeof cancellation === 'function') {
      cancelPublication = cancellation;
    }
  }

  function accept(next: TimeRange | undefined, source: RangeProposalSource): boolean {
    if (disposed || next === undefined || !options.canPublish()) {
      return false;
    }
    pending = next;
    pendingSource = source;
    schedulePublication();
    return true;
  }

  const controller: RangeProposalController = {
    adopt(range) {
      if (disposed) {
        return;
      }
      const next = normalizeTimeRange(range);
      if (next === undefined) {
        throw new RangeError('An adopted proposal range must be finite and increasing.');
      }
      if (pending !== undefined) {
        if (sameRange(next, pending)) {
          adopted = next;
          pending = undefined;
          cancelScheduledPublication();
          return;
        }
        if (!sameRange(next, adopted)) {
          adopted = next;
          pending = undefined;
          cancelScheduledPublication();
        }
        return;
      }
      adopted = next;
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      pending = undefined;
      cancelScheduledPublication();
    },

    getPending() {
      return pending;
    },

    requestRange(range, source) {
      if (disposed || !options.canPublish()) {
        return false;
      }
      const next = normalizeTimeRange(range);
      if (next === undefined) {
        return false;
      }
      cancelScheduledPublication();
      pending = next;
      pendingSource = source;
      options.publish(next, source);
      return true;
    },

    shiftByPixels(pixelDelta, viewportWidth, source) {
      return accept(shiftTimeRangeByPixels(pending ?? adopted, pixelDelta, viewportWidth), source);
    },

    shiftByTime(delta, source) {
      return accept(shiftTimeRange(pending ?? adopted, delta), source);
    },
  };
  return Object.freeze(controller);
}

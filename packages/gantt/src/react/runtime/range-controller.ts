import { createRangeProposalController } from '../../runtime/range-proposals';
import type { TimeRange } from '../../model/types';
import type { GanttRangeChangeEvent } from '../types';

type RangeSource = Extract<GanttRangeChangeEvent['source'], 'imperative' | 'runtime'>;

export interface RuntimeRangeController {
  adopt(range: TimeRange): void;
  canChange(): boolean;
  dispose(): void;
  request(
    range: TimeRange,
    reason: GanttRangeChangeEvent['reason'],
    source: RangeSource,
    anchorTime?: number,
  ): boolean;
  shiftByPixels(
    delta: number,
    viewportWidth: number,
    source: RangeSource,
    reason?: GanttRangeChangeEvent['reason'],
  ): boolean;
  shiftByTime(delta: number, source: RangeSource): boolean;
}

interface RuntimeRangeControllerOptions {
  readonly adoptUncontrolledRange: (range: TimeRange) => void;
  readonly canPublish: () => boolean;
  readonly initialRange: TimeRange;
  readonly isControlled: boolean;
  readonly publish: (
    range: TimeRange,
    event: Readonly<{
      anchorTime?: number;
      reason: GanttRangeChangeEvent['reason'];
      source: RangeSource;
    }>,
  ) => void;
  readonly schedule: (update: () => void) => (() => void) | undefined;
}

export function createRuntimeRangeController(
  options: RuntimeRangeControllerOptions,
): RuntimeRangeController {
  let context: {
    readonly anchorTime?: number;
    readonly reason: GanttRangeChangeEvent['reason'];
  } = { reason: 'pan' };
  const proposals = createRangeProposalController({
    canPublish: options.canPublish,
    initialRange: options.initialRange,
    publish(range, source) {
      if (!options.isControlled) {
        options.adoptUncontrolledRange(range);
        proposals.adopt(range);
      }
      options.publish(
        range,
        Object.freeze({
          ...(context.anchorTime === undefined ? {} : { anchorTime: context.anchorTime }),
          reason: context.reason,
          source,
        }),
      );
    },
    schedule: options.schedule,
  });

  const controller: RuntimeRangeController = {
    adopt: (range) => proposals.adopt(range),
    canChange: options.canPublish,
    dispose: () => proposals.dispose(),
    request(range, reason, source, anchorTime) {
      context = Object.freeze({
        ...(anchorTime === undefined ? {} : { anchorTime }),
        reason,
      });
      return proposals.requestRange(range, source);
    },
    shiftByPixels(delta, viewportWidth, source, reason = 'scroll') {
      context = Object.freeze({ reason });
      return proposals.shiftByPixels(delta, viewportWidth, source);
    },
    shiftByTime(delta, source) {
      context = Object.freeze({ reason: 'scroll' });
      return proposals.shiftByTime(delta, source);
    },
  };
  return Object.freeze(controller);
}

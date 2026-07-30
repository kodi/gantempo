import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

const PROPERTY_SEED = 20_260_730;
const PROPERTY_RUNS = 250;

function scheduledDocument(start: number, duration: number): GanttDocument {
  const base = createPatchTestDocument();
  const first = base.tasks[0]!;
  return Object.freeze({
    ...base,
    tasks: Object.freeze([
      Object.freeze({
        ...first,
        schedule: Object.freeze({
          end: start + duration,
          mode: 'instant' as const,
          start,
        }),
      }),
      ...base.tasks.slice(1),
    ]),
  });
}

describe('semantic task schedule command properties', () => {
  it('deterministically replays and inverts fixed-seed move/resize sequences', () => {
    fc.assert(
      fc.property(
        fc.record({
          delta: fc.integer({ max: 1_000_000, min: -1_000_000 }),
          duration: fc.integer({ max: 1_000_000, min: 1 }),
          extension: fc.integer({ max: 1_000_000, min: 1 }),
          start: fc.integer({ max: 1_000_000_000, min: -1_000_000_000 }),
          targetStart: fc.integer({ max: 1_000_000_000, min: -1_000_000_000 }),
        }),
        ({ delta, duration, extension, start, targetStart }) => {
          const base = scheduledDocument(start, duration);
          const command = Object.freeze({
            commands: Object.freeze([
              Object.freeze({ delta, id: 'task-1', type: 'task.move' as const }),
              Object.freeze({
                id: 'task-1',
                start: targetStart,
                type: 'task.move' as const,
              }),
              Object.freeze({
                edge: 'end' as const,
                id: 'task-1',
                time: targetStart + duration + extension,
                type: 'task.resize' as const,
              }),
            ]),
            type: 'transaction' as const,
          });

          const first = applyGanttCommand(base, command);
          const second = applyGanttCommand(base, command);
          expect(first).toEqual(second);
          expect(first.status).toBe('committed');
          if (first.status !== 'committed') {
            return;
          }
          expect(first.document.tasks[0]?.schedule).toEqual({
            end: targetStart + duration + extension,
            mode: 'instant',
            start: targetStart,
          });

          const replay = applyGanttPatches(base, first.patches);
          expect(replay.status).toBe('applied');
          expect(serializeGanttDocument(replay.document)).toBe(
            serializeGanttDocument(first.document),
          );
          const inverse = applyGanttPatches(first.document, first.inversePatches);
          expect(inverse.status).toBe('applied');
          expect(serializeGanttDocument(inverse.document)).toBe(serializeGanttDocument(base));
        },
      ),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttCommand } from './types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

const PROPERTY_SEED = 20_260_732;
const PROPERTY_RUNS = 150;

describe('transaction properties', () => {
  it('deterministically applies and inverts generated ordered command sequences', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), {
          maxLength: 12,
          minLength: 1,
        }),
        (ids) => {
          const base = createPatchTestDocument();
          const commands: GanttCommand[] = ids.flatMap((id, index) => [
            {
              index: Math.min(index, base.tasks.length + index),
              type: 'task.add' as const,
              value: { id: `generated-${id}`, title: id },
            },
            {
              changes: { progress: index / Math.max(ids.length, 1) },
              id: `generated-${id}`,
              type: 'task.update' as const,
            },
          ]);
          const first = applyGanttCommand(base, { commands, type: 'transaction' });
          const second = applyGanttCommand(base, { commands, type: 'transaction' });
          expect(first).toEqual(second);
          expect(first.status).toBe('committed');
          if (first.status !== 'committed') {
            return;
          }
          const replay = applyGanttPatches(base, first.patches);
          expect(replay.status).toBe('applied');
          expect(serializeGanttDocument(replay.document)).toBe(
            serializeGanttDocument(first.document),
          );
          const restored = applyGanttPatches(first.document, first.inversePatches);
          expect(restored.status).toBe('applied');
          expect(serializeGanttDocument(restored.document)).toBe(serializeGanttDocument(base));
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

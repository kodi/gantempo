import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import {
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
} from './history';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

const PROPERTY_SEED = 20_260_731;
const PROPERTY_RUNS = 200;

const variantArbitrary = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
    fc.constantFrom('blocked', 'external', 'release', 'team-blue'),
  )
  .map(([namespace, name]) => `${namespace}:${name}`);

describe('item property command properties', () => {
  it.each([0, 1])(
    'preserves the strict progress boundary %d through patches and history',
    (progress) => {
      const base = createPatchTestDocument();
      const outcome = applyGanttCommand(base, {
        changes: { progress },
        id: 'task-1',
        type: 'task.update',
      });

      expect(outcome.status).toBe('committed');
      expect(outcome.document.tasks[0]?.progress).toBe(progress);
      if (outcome.status !== 'committed') {
        return;
      }
      const replay = applyGanttPatches(base, outcome.patches);
      expect(replay.status).toBe('applied');
      expect(replay.document.tasks[0]?.progress).toBe(progress);
    },
  );

  it('normalizes, replays, inverts, undoes, and redoes independent task/lane variants', () => {
    fc.assert(
      fc.property(
        fc.record({
          description: fc.string({ maxLength: 80 }),
          laneVariant: variantArbitrary,
          progressPercent: fc.integer({ max: 100, min: 0 }),
          taskVariant: variantArbitrary,
        }),
        ({ description, laneVariant, progressPercent, taskVariant }) => {
          const base = createPatchTestDocument();
          const command = Object.freeze({
            commands: Object.freeze([
              Object.freeze({
                changes: Object.freeze({
                  appearance: Object.freeze({ variant: `  ${taskVariant}  ` }),
                  description,
                  progress: progressPercent / 100,
                }),
                id: 'task-1',
                type: 'task.update' as const,
              }),
              Object.freeze({
                changes: Object.freeze({
                  appearance: Object.freeze({ variant: `  ${laneVariant}  ` }),
                }),
                id: 'shared',
                type: 'lane.update' as const,
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

          expect(first.document.tasks[0]).toMatchObject({
            appearance: { variant: taskVariant },
            description,
            progress: progressPercent / 100,
          });
          expect(first.document.lanes[0]).toMatchObject({
            appearance: { variant: laneVariant },
          });
          expect(first.document.resources).toBe(base.resources);
          expect(first.document.assignments).toBe(base.assignments);
          expect(first.document.placements).toBe(base.placements);
          expect(first.document.dependencies).toBe(base.dependencies);

          const replay = applyGanttPatches(base, first.patches);
          expect(replay.status).toBe('applied');
          expect(serializeGanttDocument(replay.document)).toBe(
            serializeGanttDocument(first.document),
          );
          const inverse = applyGanttPatches(first.document, first.inversePatches);
          expect(inverse.status).toBe('applied');
          expect(serializeGanttDocument(inverse.document)).toBe(serializeGanttDocument(base));

          const committed = commitGanttHistory(createGanttHistory(base, 10), first);
          expect(committed.status).toBe('applied');
          const undone = undoGanttHistory(committed.history);
          expect(undone.status).toBe('applied');
          expect(serializeGanttDocument(undone.history.document)).toBe(
            serializeGanttDocument(base),
          );
          const redone = redoGanttHistory(undone.history);
          expect(redone.status).toBe('applied');
          expect(serializeGanttDocument(redone.history.document)).toBe(
            serializeGanttDocument(first.document),
          );
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

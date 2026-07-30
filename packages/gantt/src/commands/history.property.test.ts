import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttCommand } from './types';
import {
  commitGanttHistory,
  createGanttHistory,
  redoGanttHistory,
  undoGanttHistory,
} from './history';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

const PROPERTY_SEED = 20_260_733;
const PROPERTY_RUNS = 100;

describe('history properties', () => {
  it('undoes all generated commits to the initial bytes and redoes all to the final bytes', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), {
          maxLength: 10,
          minLength: 1,
        }),
        (ids) => {
          const base = createPatchTestDocument();
          let history = createGanttHistory(base, ids.length + 1);
          for (const [index, id] of ids.entries()) {
            const commands: readonly GanttCommand[] = [
              {
                type: 'task.add',
                value: {
                  fields: { generated: index },
                  id: `history-${id}`,
                  title: id,
                },
              },
              {
                changes: { progress: index / ids.length },
                id: `history-${id}`,
                type: 'task.update',
              },
            ];
            const outcome = applyGanttCommand(history.document, {
              commands,
              type: 'transaction',
            });
            const committed = commitGanttHistory(history, outcome);
            expect(committed.status).toBe('applied');
            history = committed.history;
          }
          const finalJson = serializeGanttDocument(history.document);

          while (history.past.length > 0) {
            const result = undoGanttHistory(history);
            expect(result.status).toBe('applied');
            history = result.history;
          }
          expect(serializeGanttDocument(history.document)).toBe(serializeGanttDocument(base));

          while (history.future.length > 0) {
            const result = redoGanttHistory(history);
            expect(result.status).toBe('applied');
            history = result.history;
          }
          expect(serializeGanttDocument(history.document)).toBe(finalJson);
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

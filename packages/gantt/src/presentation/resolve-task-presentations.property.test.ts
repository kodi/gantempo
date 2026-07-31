import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { resolveTaskPresentations } from './resolve-task-presentations';

const PROPERTY_SEED = 20_260_736;
const PROPERTY_RUNS = 150;

describe('task presentation properties', () => {
  it('derives summary bounds from every usable descendant without mutating input', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            duration: fc.integer({ max: 100, min: 1 }),
            scheduled: fc.boolean(),
            start: fc.integer({ max: 10_000, min: -10_000 }),
          }),
          { maxLength: 100 },
        ),
        (specifications) => {
          const tasks: GanttDocument['tasks'] = [
            {
              id: 'summary',
              kind: 'summary',
              schedule: { end: 2, mode: 'instant', start: 1 },
              segments: [],
              title: 'Summary',
            },
            ...specifications.map((item, index) => ({
              id: `task-${index}`,
              kind: 'task' as const,
              parentId: 'summary',
              ...(item.scheduled
                ? {
                    schedule: {
                      end: item.start + item.duration,
                      mode: 'instant' as const,
                      start: item.start,
                    },
                  }
                : {}),
              segments: [],
              title: `Task ${index}`,
            })),
          ];
          const document: GanttDocument = {
            assignments: [],
            dependencies: [],
            lanes: [],
            placements: [],
            resources: [],
            schemaVersion: 1,
            tasks,
          };
          const snapshot = structuredClone(document);
          const first = resolveTaskPresentations(document, 'UTC');
          const second = resolveTaskPresentations(document, 'UTC');
          const summary = first.presentations[0]!;
          const scheduled = specifications.filter((item) => item.scheduled);

          expect(first).toEqual(second);
          expect(document).toEqual(snapshot);
          expect(summary.summary).toEqual({
            descendantCount: specifications.length,
            resolvedDescendantCount: scheduled.length,
            unresolvedDescendantCount: specifications.length - scheduled.length,
          });
          expect(summary.interval).toEqual(
            scheduled.length === 0
              ? { end: 2, source: 'canonical', start: 1 }
              : {
                  end: Math.max(...scheduled.map((item) => item.start + item.duration)),
                  source: 'descendants',
                  start: Math.min(...scheduled.map((item) => item.start)),
                },
          );
        },
      ),
      { endOnFailure: true, numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });
});

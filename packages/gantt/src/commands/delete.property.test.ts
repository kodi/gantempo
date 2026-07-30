import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument, TaskRecord } from '../model/types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';
import { applyGanttCommand } from './reduce';

const PROPERTY_SEED = 20_260_731;
const PROPERTY_RUNS = 150;

function generatedTree(width: number, depth: number): GanttDocument {
  const base = createPatchTestDocument();
  const tasks: TaskRecord[] = [
    Object.freeze({
      id: 'root',
      kind: 'task',
      segments: Object.freeze([]),
      title: 'Root',
    }),
  ];
  let parents = ['root'];
  for (let level = 0; level < depth; level += 1) {
    const next: string[] = [];
    for (const parentId of parents) {
      for (let child = 0; child < width; child += 1) {
        const id = `${parentId}-${child}`;
        tasks.push(
          Object.freeze({
            id,
            kind: 'task',
            parentId,
            segments: Object.freeze([]),
            title: id,
          }),
        );
        next.push(id);
      }
    }
    parents = next;
  }
  return Object.freeze({
    ...base,
    assignments: Object.freeze([]),
    dependencies: Object.freeze([]),
    placements: Object.freeze([]),
    tasks: Object.freeze(tasks),
  });
}

describe('task cascade properties', () => {
  it('removes generated wide/deep trees deterministically and exactly inverts them', () => {
    fc.assert(
      fc.property(
        fc.record({
          depth: fc.integer({ max: 4, min: 0 }),
          width: fc.integer({ max: 4, min: 1 }),
        }),
        ({ depth, width }) => {
          const base = generatedTree(width, depth);
          const first = applyGanttCommand(base, {
            cascade: true,
            id: 'root',
            type: 'task.delete',
          });
          const second = applyGanttCommand(base, {
            cascade: true,
            id: 'root',
            type: 'task.delete',
          });
          expect(first).toEqual(second);
          expect(first.status).toBe('committed');
          if (first.status !== 'committed') {
            return;
          }
          expect(first.document.tasks).toEqual([]);
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

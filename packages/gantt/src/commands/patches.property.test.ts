import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { serializeGanttDocument } from '../model/serialize';
import type { DocumentCollection, GanttPatch } from './types';
import { applyGanttPatches } from './patches';
import { createPatchTestDocument } from './patches.test-fixtures';

const PROPERTY_SEED = 20_260_730;
const PROPERTY_RUNS = 200;

function replacementPatch(collection: DocumentCollection): GanttPatch {
  const base = createPatchTestDocument();
  switch (collection) {
    case 'tasks':
      return {
        op: 'replace',
        patchVersion: 1,
        target: { collection, id: 'task-2' },
        value: { ...base.tasks[1]!, title: 'Changed task' },
      };
    case 'resources':
      return {
        op: 'replace',
        patchVersion: 1,
        target: { collection, id: 'resource-1' },
        value: { ...base.resources[0]!, title: 'Changed resource' },
      };
    case 'lanes':
      return {
        op: 'replace',
        patchVersion: 1,
        target: { collection, id: 'shared' },
        value: { ...base.lanes[0]!, title: 'Changed lane' },
      };
    case 'assignments':
      return {
        op: 'replace',
        patchVersion: 1,
        target: { collection, id: 'shared' },
        value: { ...base.assignments[0]!, allocation: 0.5 },
      };
    case 'placements':
      return {
        op: 'replace',
        patchVersion: 1,
        target: { collection, id: 'shared' },
        value: { ...base.placements[0]!, order: 7 },
      };
    case 'dependencies':
      return {
        op: 'replace',
        patchVersion: 1,
        target: { collection, id: 'shared' },
        value: { ...base.dependencies[0]!, type: 'start-to-start' },
      };
  }
}

function removeAndRestorePatches(collection: DocumentCollection): readonly GanttPatch[] {
  const base = createPatchTestDocument();
  const records = base[collection];
  const index = collection === 'tasks' ? 1 : 0;
  const record = records[index]!;
  return [
    {
      op: 'remove',
      patchVersion: 1,
      target: { collection, id: record.id },
    },
    {
      index,
      op: 'add',
      patchVersion: 1,
      target: { collection, id: record.id },
      value: record,
    },
  ] as readonly GanttPatch[];
}

describe('patch inversion properties', () => {
  it('replays generated add/remove/replace sequences and restores byte-identical JSON', () => {
    const collectionArbitrary = fc.constantFrom<DocumentCollection>(
      'tasks',
      'resources',
      'lanes',
      'assignments',
      'placements',
      'dependencies',
    );
    const scenarioArbitrary = fc.record({
      collection: collectionArbitrary,
      mode: fc.constantFrom<'replace' | 'remove-add'>('replace', 'remove-add'),
    });

    fc.assert(
      fc.property(scenarioArbitrary, ({ collection, mode }) => {
        const base = createPatchTestDocument();
        const patches =
          mode === 'replace' ? [replacementPatch(collection)] : removeAndRestorePatches(collection);
        const applied = applyGanttPatches(base, patches);
        expect(applied.status).toBe('applied');
        if (applied.status !== 'applied') {
          return;
        }
        expect(applied.document.schemaVersion).toBe(base.schemaVersion);
        expect(applied.document.revision).toBe(base.revision);
        expect(applied.document.metadata).toBe(base.metadata);

        const replayed = applyGanttPatches(base, applied.patches);
        expect(replayed.status).toBe('applied');
        expect(serializeGanttDocument(replayed.document)).toBe(
          serializeGanttDocument(applied.document),
        );

        const inverted = applyGanttPatches(applied.document, applied.inversePatches);
        expect(inverted.status).toBe('applied');
        expect(serializeGanttDocument(inverted.document)).toBe(serializeGanttDocument(base));
      }),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});

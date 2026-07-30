import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import { createPatchTestDocument } from '../commands/patches.test-fixtures';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { createGanttCommandBus } from './command-bus';
import { createGanttRuntimeStore } from './store';
import type { GanttDispatchResult } from './types';

const PROPERTY_SEED = 20_260_730;
const PROPERTY_RUNS = 100;

type MixedOperation =
  | { readonly kind: 'dispatch'; readonly title: string }
  | { readonly kind: 'external'; readonly title: string }
  | { readonly kind: 'redo' }
  | { readonly kind: 'revision'; readonly revision: number }
  | { readonly kind: 'undo' };

function changedTaskDocument(document: GanttDocument, title: string): GanttDocument {
  const outcome = applyGanttCommand(document, {
    changes: { title },
    id: 'task-1',
    type: 'task.update',
  });
  if (outcome.status !== 'committed') {
    throw new Error('Generated task changes must commit.');
  }
  return outcome.document;
}

async function applySequence(operations: readonly MixedOperation[]) {
  const store = createGanttRuntimeStore({
    document: { kind: 'controlled', value: createPatchTestDocument() },
    historyCapacity: 8,
  });
  const bus = createGanttCommandBus({
    onDocumentChange() {},
    store,
  });
  const statuses: GanttDispatchResult['status'][] = [];
  for (const operation of operations) {
    if (operation.kind === 'dispatch') {
      const result = await bus.dispatch({
        changes: { title: operation.title },
        id: 'task-1',
        type: 'task.update',
      });
      statuses.push(result.status);
      if (result.status === 'proposed') {
        bus.updateControlledDocument(result.change.document);
      }
    } else if (operation.kind === 'undo' || operation.kind === 'redo') {
      const result = operation.kind === 'undo' ? await bus.undo() : await bus.redo();
      statuses.push(result.status);
      if (result.status === 'proposed') {
        bus.updateControlledDocument(result.change.document);
      }
    } else if (operation.kind === 'revision') {
      bus.updateControlledDocument(
        Object.freeze({
          ...store.getSnapshot().document,
          revision: operation.revision,
        }),
      );
    } else {
      bus.updateControlledDocument(
        changedTaskDocument(store.getSnapshot().document, operation.title),
      );
    }
    expect(store.getSnapshot().ownership.pendingDocument).toBeUndefined();
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
  }
  return {
    canRedo: store.getSnapshot().history.canRedo,
    canUndo: store.getSnapshot().history.canUndo,
    document: serializeGanttDocument(store.getSnapshot().document),
    statuses,
  };
}

describe('Gantt command bus properties', () => {
  it('replays fixed-seed mixed dispatch/undo/redo/external sequences deterministically', async () => {
    const operation: fc.Arbitrary<MixedOperation> = fc.oneof(
      fc.record({
        kind: fc.constant('dispatch' as const),
        title: fc.string({ maxLength: 16 }),
      }),
      fc.record({
        kind: fc.constant('external' as const),
        title: fc.string({ maxLength: 16 }),
      }),
      fc.record({
        kind: fc.constant('revision' as const),
        revision: fc.integer({ max: 10_000, min: 0 }),
      }),
      fc.constant({ kind: 'undo' as const }),
      fc.constant({ kind: 'redo' as const }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(operation, { maxLength: 30, minLength: 1 }), async (operations) => {
        const first = await applySequence(operations);
        const second = await applySequence(operations);
        expect(first).toEqual(second);
      }),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });
});

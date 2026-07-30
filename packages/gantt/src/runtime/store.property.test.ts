import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import { createPatchTestDocument } from '../commands/patches.test-fixtures';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { createGanttRuntimeStore } from './store';

const PROPERTY_SEED = 20_260_730;
const PROPERTY_RUNS = 150;

type OwnershipOperation =
  | { readonly kind: 'acknowledge'; readonly title: string }
  | { readonly kind: 'external'; readonly title: string }
  | { readonly kind: 'revision'; readonly revision: number };

function changeTitle(document: GanttDocument, title: string): GanttDocument {
  const outcome = applyGanttCommand(document, {
    changes: { title },
    id: 'task-1',
    type: 'task.update',
  });
  if (outcome.status !== 'committed') {
    throw new Error('Generated title changes must commit.');
  }
  return outcome.document;
}

function applyOwnershipSequence(operations: readonly OwnershipOperation[]) {
  const store = createGanttRuntimeStore({
    document: { kind: 'controlled', value: createPatchTestDocument() },
  });
  operations.forEach((operation, index) => {
    if (operation.kind === 'revision') {
      const current = store.getSnapshot().document;
      const replacement = Object.freeze({ ...current, revision: operation.revision });
      expect(store.updateControlledDocument(replacement)).toEqual(
        serializeGanttDocument(replacement) === serializeGanttDocument(current)
          ? { status: 'unchanged' }
          : { status: 'revision-only' },
      );
    } else if (operation.kind === 'external') {
      const current = store.getSnapshot().document;
      const replacement = changeTitle(current, operation.title);
      expect(store.updateControlledDocument(replacement)).toEqual(
        replacement === current ? { status: 'unchanged' } : { status: 'external-content' },
      );
    } else {
      const capture = store.captureDocument();
      const candidate = changeTitle(capture.document, operation.title);
      const proposalId = `proposal-${index}`;
      expect(
        store.stageControlledDocumentProposal({
          baseSerialization: capture.serialization,
          candidate,
          proposalId,
        }),
      ).toEqual(candidate === capture.document ? { status: 'no-op' } : { status: 'staged' });
      if (candidate !== capture.document) {
        expect(store.updateControlledDocument(candidate)).toEqual({
          proposalId,
          status: 'acknowledged',
        });
      }
    }
    const snapshot = store.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.document)).toBe(true);
    expect(Object.isFrozen(snapshot.ownership)).toBe(true);
    expect(store.captureDocument().serialization).toBe(serializeGanttDocument(snapshot.document));
  });
  return store.getSnapshot();
}

describe('Gantt runtime store properties', () => {
  it('deterministically reconciles fixed-seed controlled ownership sequences', () => {
    const operationArbitrary: fc.Arbitrary<OwnershipOperation> = fc.oneof(
      fc.record({
        kind: fc.constant('acknowledge' as const),
        title: fc.string({ maxLength: 20 }),
      }),
      fc.record({
        kind: fc.constant('external' as const),
        title: fc.string({ maxLength: 20 }),
      }),
      fc.record({
        kind: fc.constant('revision' as const),
        revision: fc.integer({ max: 10_000, min: 0 }),
      }),
    );
    fc.assert(
      fc.property(fc.array(operationArbitrary, { maxLength: 30, minLength: 1 }), (operations) => {
        const first = applyOwnershipSequence(operations);
        const second = applyOwnershipSequence(operations);
        expect(serializeGanttDocument(first.document)).toBe(
          serializeGanttDocument(second.document),
        );
        expect(first.history).toEqual(second.history);
        expect(first.ownership).toEqual(second.ownership);
        expect(first.version).toBe(second.version);
      }),
      {
        endOnFailure: true,
        numRuns: PROPERTY_RUNS,
        seed: PROPERTY_SEED,
      },
    );
  });

  it('clones and freezes fixed-seed uncontrolled session operation sequences', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 100_000 }), { maxLength: 50, minLength: 1 }),
        (verticalStarts) => {
          const store = createGanttRuntimeStore({
            document: { kind: 'uncontrolled', value: createPatchTestDocument() },
          });
          for (const [index, verticalStart] of verticalStarts.entries()) {
            const mutableTarget = {
              kind: 'task' as const,
              laneViewKey: `lane-${index}`,
              taskId: `task-${index}`,
              viewKey: `view-${index}`,
            };
            store.updateUncontrolledSession({
              focused: mutableTarget,
              selection: [mutableTarget, mutableTarget],
              viewport: { verticalStart },
            });
            mutableTarget.taskId = 'mutated-after-update';

            const session = store.getSnapshot().session;
            expect(session.focused?.kind).toBe('task');
            if (session.focused?.kind === 'task') {
              expect(session.focused.taskId).toBe(`task-${index}`);
            }
            expect(session.selection).toHaveLength(1);
            expect(session.viewport.verticalStart).toBe(verticalStart);
            expect(Object.isFrozen(session)).toBe(true);
            expect(Object.isFrozen(session.selection)).toBe(true);
            expect(Object.isFrozen(session.focused)).toBe(true);
          }
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

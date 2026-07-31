import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import { createPatchTestDocument } from '../commands/patches.test-fixtures';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { createGanttRuntimeStore, subscribeGanttRuntimeSelector } from './store';
import type { GanttRuntimeOccurrence, GanttSessionState, GanttTaskTarget } from './types';

function taskTarget(viewKey: string, laneViewKey: string, taskId = viewKey): GanttTaskTarget {
  return {
    kind: 'task',
    laneViewKey,
    taskId,
    viewKey,
  };
}

function occurrence(
  target: GanttTaskTarget,
  laneIndex: number,
  horizontalCenter: number,
): GanttRuntimeOccurrence {
  return { horizontalCenter, laneIndex, target };
}

function changedTaskDocument(
  document: GanttDocument,
  title: string,
  taskId = 'task-1',
): GanttDocument {
  const outcome = applyGanttCommand(document, {
    changes: { title },
    id: taskId,
    type: 'task.update',
  });
  expect(outcome.status).toBe('committed');
  return outcome.document;
}

function withRevision(document: GanttDocument, revision: number | string): GanttDocument {
  return Object.freeze({ ...document, revision });
}

describe('Gantt runtime store', () => {
  it('normalizes committed project expansion against canonical branch order', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [
        { id: 'root-b', kind: 'summary', segments: [], title: 'B' },
        { id: 'leaf', kind: 'task', parentId: 'root-b', segments: [], title: 'Leaf' },
        { id: 'root-a', kind: 'summary', segments: [], title: 'A' },
        { id: 'child', kind: 'task', parentId: 'root-a', segments: [], title: 'Child' },
      ],
    };
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: document },
      session: {
        kind: 'uncontrolled',
        value: {
          project: { collapsedTaskIds: ['missing', 'root-a', 'leaf', 'root-b', 'root-a'] },
          selection: [],
          viewport: { verticalStart: 0 },
        },
      },
    });
    store.setOccurrences([]);

    expect(store.getSnapshot().session.project?.collapsedTaskIds).toEqual(['root-b', 'root-a']);
    expect(Object.isFrozen(store.getSnapshot().session.project)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().session.project?.collapsedTaskIds)).toBe(true);
  });

  it('clones consumer inputs and keeps two uncontrolled instances independent', () => {
    const mutable = JSON.parse(serializeGanttDocument(createPatchTestDocument())) as GanttDocument;
    const first = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: mutable },
    });
    const second = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: mutable },
    });

    (mutable.tasks[0] as { title: string }).title = 'Mutated by caller';
    expect(first.getSnapshot().document.tasks[0]?.title).toBe('First');
    expect(second.getSnapshot().document.tasks[0]?.title).toBe('First');
    expect(first.getSnapshot().document).not.toBe(mutable);
    expect(first.getSnapshot().document).not.toBe(second.getSnapshot().document);

    const changed = changedTaskDocument(first.getSnapshot().document, 'First instance');
    expect(first.adoptUncontrolledDocument(changed)).toBe(true);
    expect(first.getSnapshot().document.tasks[0]?.title).toBe('First instance');
    expect(second.getSnapshot().document.tasks[0]?.title).toBe('First');
    expect(first.adoptUncontrolledDocument(changed)).toBe(false);
  });

  it('publishes immutable snapshots once per batch and preserves unrelated slices', () => {
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
    });
    const initial = store.getSnapshot();
    let publications = 0;
    store.subscribe(() => {
      publications += 1;
    });

    store.batch(() => {
      store.setHistoryCapabilities(true, false);
      store.updateUncontrolledSession({
        selection: [],
        viewport: { verticalStart: 24 },
      });
    });

    const next = store.getSnapshot();
    expect(publications).toBe(1);
    expect(next.version).toBe(2);
    expect(next.document).toBe(initial.document);
    expect(next.interaction).toBe(initial.interaction);
    expect(next.history.canUndo).toBe(true);
    expect(next.session.viewport.verticalStart).toBe(24);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.document)).toBe(true);
    expect(Object.isFrozen(next.session)).toBe(true);
    expect(Object.isFrozen(next.session.viewport)).toBe(true);
    expect(Object.isFrozen(next.history)).toBe(true);
  });

  it('supports selector equality without notifying unrelated slices', () => {
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
    });
    const observed: number[] = [];
    const unsubscribe = subscribeGanttRuntimeSelector(
      store,
      (snapshot) => snapshot.session.viewport.verticalStart,
      (next) => observed.push(next),
    );

    store.setHistoryCapabilities(true, false);
    store.updateUncontrolledSession({
      selection: [],
      viewport: { verticalStart: 10 },
    });
    store.updateUncontrolledSession({
      selection: [],
      viewport: { verticalStart: 10 },
    });
    unsubscribe();
    store.updateUncontrolledSession({
      selection: [],
      viewport: { verticalStart: 20 },
    });

    expect(observed).toEqual([10]);
  });

  it('coalesces measured scroll and resize input while publishing the final numeric state', () => {
    const scheduled: { cancelled: boolean; run: () => void }[] = [];
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
      viewport: {
        overscanBefore: 10,
        overscanAfter: 20,
        schedule(update) {
          const item = { cancelled: false, run: update };
          scheduled.push(item);
          return () => {
            item.cancelled = true;
          };
        },
      },
    });
    let publications = 0;
    store.subscribe(() => {
      publications += 1;
    });
    const mutable = {
      clientHeight: 100,
      clientWidth: 600,
      verticalStart: 20,
    };

    store.scheduleViewportMeasurement(mutable);
    store.scheduleViewportMeasurement({
      clientHeight: 180,
      clientWidth: 900,
      verticalStart: 40,
    });
    mutable.verticalStart = 9_999;

    expect(scheduled).toHaveLength(1);
    expect(store.getSnapshot().viewport.status).toBe('unmeasured');
    scheduled[0]?.run();
    expect(publications).toBe(1);
    expect(store.getSnapshot().viewport).toEqual({
      clientHeight: 180,
      clientWidth: 900,
      overscanAfter: 20,
      overscanBefore: 10,
      queryVerticalExtent: 210,
      queryVerticalStart: 30,
      status: 'measured',
      verticalStart: 40,
    });
  });

  it('flushes or clears scheduled measurement deterministically and follows session intent', () => {
    let scheduled: (() => void) | undefined;
    let cancelled = 0;
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
      viewport: {
        overscanBefore: 5,
        overscanAfter: 15,
        schedule(update) {
          scheduled = update;
          return () => {
            cancelled += 1;
          };
        },
      },
    });

    store.scheduleViewportMeasurement({
      clientHeight: 80,
      clientWidth: 400,
      verticalStart: 25,
      retainedRange: { start: 200, end: 224 },
    });
    expect(store.flushViewportMeasurement()).toBe(true);
    expect(cancelled).toBe(1);
    expect(store.flushViewportMeasurement()).toBe(false);
    expect(store.getSnapshot().viewport).toMatchObject({
      queryVerticalStart: 20,
      queryVerticalExtent: 204,
      status: 'measured',
    });

    store.updateUncontrolledSession({
      selection: [],
      viewport: { verticalStart: 40 },
    });
    expect(store.getSnapshot().viewport).toMatchObject({
      verticalStart: 40,
      queryVerticalStart: 35,
      queryVerticalExtent: 100,
    });

    store.scheduleViewportMeasurement({
      clientHeight: 50,
      clientWidth: 300,
      verticalStart: 12,
    });
    expect(store.clearViewportMeasurement()).toBe(true);
    expect(cancelled).toBe(2);
    expect(store.getSnapshot().viewport).toMatchObject({
      status: 'unmeasured',
      verticalStart: 40,
      queryVerticalExtent: 0,
    });
    scheduled?.();
    expect(store.getSnapshot().viewport.status).toBe('unmeasured');
    expect(store.clearViewportMeasurement()).toBe(false);
  });

  it('handles unsubscribe and reentrant updates safely during publication', () => {
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
    });
    let firstCalls = 0;
    let secondCalls = 0;
    let depth = 0;
    let maximumDepth = 0;
    let unsubscribeSecond = () => {};
    store.subscribe(() => {
      depth += 1;
      maximumDepth = Math.max(maximumDepth, depth);
      firstCalls += 1;
      unsubscribeSecond();
      if (firstCalls === 1) {
        store.updateUncontrolledSession({
          selection: [],
          viewport: { verticalStart: 2 },
        });
      }
      depth -= 1;
    });
    unsubscribeSecond = store.subscribe(() => {
      secondCalls += 1;
    });

    store.updateUncontrolledSession({
      selection: [],
      viewport: { verticalStart: 1 },
    });

    expect(maximumDepth).toBe(1);
    expect(firstCalls).toBe(2);
    expect(secondCalls).toBe(0);
    expect(store.getSnapshot().session.viewport.verticalStart).toBe(2);
  });

  it('finishes publication and remains usable when a subscriber throws', () => {
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
    });
    const unsubscribeThrowing = store.subscribe(() => {
      throw new Error('Host subscriber failed');
    });
    let peerCalls = 0;
    store.subscribe(() => {
      peerCalls += 1;
    });

    expect(() => store.setHistoryCapabilities(true, false)).toThrow('Host subscriber failed');
    expect(peerCalls).toBe(1);
    unsubscribeThrowing();
    expect(() => store.setHistoryCapabilities(false, false)).not.toThrow();
    expect(peerCalls).toBe(2);
  });

  it('stages one controlled proposal and acknowledges exact serialized candidates', () => {
    const base = createPatchTestDocument();
    const store = createGanttRuntimeStore({
      document: { kind: 'controlled', value: base },
    });
    const capture = store.captureDocument();
    const candidate = changedTaskDocument(base, 'Proposed');
    const mutableCandidate = JSON.parse(serializeGanttDocument(candidate)) as GanttDocument;

    expect(
      store.stageControlledDocumentProposal({
        baseSerialization: capture.serialization,
        candidate: mutableCandidate,
        proposalId: 'proposal-1',
      }),
    ).toEqual({ status: 'staged' });
    (mutableCandidate.tasks[0] as { title: string }).title = 'Mutated after staging';
    expect(store.getSnapshot().ownership.pendingDocument?.proposalId).toBe('proposal-1');
    expect(store.getSnapshot().ownership.pendingDocument?.candidate.tasks[0]?.title).toBe(
      'Proposed',
    );
    expect(store.getSnapshot().interaction).toEqual({
      proposalId: 'proposal-1',
      status: 'document-proposal-pending',
    });
    expect(
      store.stageControlledDocumentProposal({
        baseSerialization: capture.serialization,
        candidate,
        proposalId: 'proposal-2',
      }),
    ).toEqual({ status: 'pending-proposal' });

    expect(store.updateControlledDocument(base)).toEqual({ status: 'unchanged' });
    expect(store.getSnapshot().ownership.pendingDocument?.proposalId).toBe('proposal-1');

    const acknowledgement = JSON.parse(serializeGanttDocument(candidate)) as GanttDocument;
    expect(store.updateControlledDocument(acknowledgement)).toEqual({
      proposalId: 'proposal-1',
      status: 'acknowledged',
    });
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Proposed');
    expect(store.getSnapshot().ownership.pendingDocument).toBeUndefined();
    expect(store.getSnapshot().interaction).toEqual({ status: 'idle' });
    expect(store.getSnapshot().ownership.lastDocumentReconciliation).toBe('acknowledged');
  });

  it('rejects stale or duplicate proposal staging and clears matching proposals', () => {
    const base = createPatchTestDocument();
    const store = createGanttRuntimeStore({
      document: { kind: 'controlled', value: base },
    });
    const oldCapture = store.captureDocument();
    const external = changedTaskDocument(base, 'External');
    expect(store.updateControlledDocument(external)).toEqual({ status: 'external-content' });
    expect(
      store.stageControlledDocumentProposal({
        baseSerialization: oldCapture.serialization,
        candidate: changedTaskDocument(base, 'Stale candidate'),
        proposalId: 'stale',
      }),
    ).toEqual({ status: 'stale-base' });

    const capture = store.captureDocument();
    const candidate = changedTaskDocument(external, 'Candidate');
    expect(
      store.stageControlledDocumentProposal({
        baseSerialization: capture.serialization,
        candidate,
        proposalId: 'clear-me',
      }),
    ).toEqual({ status: 'staged' });
    expect(store.clearControlledDocumentProposal('other')).toBe(false);
    expect(store.clearControlledDocumentProposal('clear-me')).toBe(true);
    expect(store.clearControlledDocumentProposal('clear-me')).toBe(false);
  });

  it('preserves history metadata for revision-only replacement and invalidates content changes', () => {
    const base = createPatchTestDocument();
    const store = createGanttRuntimeStore({
      document: { kind: 'controlled', value: base },
    });
    store.setHistoryCapabilities(true, true);
    const beforeRevision = store.getSnapshot().history;

    expect(store.updateControlledDocument(withRevision(base, 'revision-8'))).toEqual({
      status: 'revision-only',
    });
    expect(store.getSnapshot().history).toBe(beforeRevision);
    expect(store.getSnapshot().history.canUndo).toBe(true);
    expect(store.getSnapshot().history.canRedo).toBe(true);

    const external = changedTaskDocument(store.getSnapshot().document, 'External content');
    expect(store.updateControlledDocument(external)).toEqual({ status: 'external-content' });
    expect(store.getSnapshot().history).toMatchObject({
      canRedo: false,
      canUndo: false,
      invalidationVersion: 1,
      lastInvalidation: 'external-content',
    });
  });

  it('treats a server revision before acknowledgement as divergence without invalidating history', () => {
    const base = createPatchTestDocument();
    const store = createGanttRuntimeStore({
      document: { kind: 'controlled', value: base },
    });
    store.setHistoryCapabilities(true, false);
    const history = store.getSnapshot().history;
    const capture = store.captureDocument();
    store.stageControlledDocumentProposal({
      baseSerialization: capture.serialization,
      candidate: changedTaskDocument(base, 'Candidate'),
      proposalId: 'revision-race',
    });

    expect(store.updateControlledDocument(withRevision(base, 'server-revision'))).toEqual({
      proposalId: 'revision-race',
      status: 'diverged',
    });
    expect(store.getSnapshot().history).toBe(history);
    expect(store.getSnapshot().history.canUndo).toBe(true);
    expect(store.getSnapshot().history.invalidationVersion).toBe(0);
  });

  it('cancels divergent proposals without overwriting controlled authority', () => {
    const base = createPatchTestDocument();
    const store = createGanttRuntimeStore({
      document: { kind: 'controlled', value: base },
    });
    store.setHistoryCapabilities(true, false);
    const capture = store.captureDocument();
    const candidate = changedTaskDocument(base, 'Candidate');
    store.stageControlledDocumentProposal({
      baseSerialization: capture.serialization,
      candidate,
      proposalId: 'proposal-diverge',
    });
    const external = changedTaskDocument(base, 'Server replacement');

    expect(store.updateControlledDocument(external)).toEqual({
      proposalId: 'proposal-diverge',
      status: 'diverged',
    });
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Server replacement');
    expect(store.getSnapshot().ownership.pendingDocument).toBeUndefined();
    expect(store.getSnapshot().history).toMatchObject({
      canUndo: false,
      invalidationVersion: 1,
    });
  });

  it('prunes uncontrolled occurrences and moves focus deterministically', () => {
    const first = taskTarget('first', 'lane-a');
    const second = taskTarget('second', 'lane-a');
    const third = taskTarget('third', 'lane-b');
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
      session: {
        kind: 'uncontrolled',
        value: {
          focused: first,
          selection: [first, first, third],
          viewport: { verticalStart: 12 },
        },
      },
    });

    expect(store.getSnapshot().session.selection.map((target) => target.viewKey)).toEqual([
      'first',
      'third',
    ]);
    store.setOccurrences([
      occurrence(first, 0, 10),
      occurrence(second, 0, 30),
      occurrence(third, 1, 12),
    ]);
    store.setOccurrences([occurrence(second, 0, 30), occurrence(third, 1, 12)]);
    expect(store.getSnapshot().session.focused?.viewKey).toBe('second');
    expect(store.getSnapshot().session.selection.map((target) => target.viewKey)).toEqual([
      'third',
    ]);

    store.setOccurrences([occurrence(third, 1, 12)]);
    expect(store.getSnapshot().session.focused?.viewKey).toBe('third');
    store.setOccurrences([]);
    expect(store.getSnapshot().session.focused).toBeUndefined();
    expect(store.getSnapshot().session.selection).toEqual([]);
  });

  it('records one complete controlled session reconciliation proposal', () => {
    const stale = taskTarget('stale', 'lane-a');
    const survivor = taskTarget('survivor', 'lane-a');
    const controlled: GanttSessionState = {
      focused: stale,
      selection: [stale],
      viewport: { verticalStart: 4 },
    };
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
      session: { kind: 'controlled', value: controlled },
    });
    store.setOccurrences([occurrence(stale, 0, 10), occurrence(survivor, 0, 20)]);
    store.setOccurrences([occurrence(survivor, 0, 20)]);

    expect(store.getSnapshot().session).toMatchObject({
      focused: survivor,
      selection: [],
      viewport: { verticalStart: 4 },
    });
    expect(store.getSnapshot().ownership.pendingSession).toEqual(store.getSnapshot().session);
    expect(controlled.focused).toBe(stale);

    store.updateControlledSession(store.getSnapshot().session);
    expect(store.getSnapshot().ownership.pendingSession).toBeUndefined();
  });

  it('keeps lane/task families and repeated task occurrences distinct', () => {
    const lane = { kind: 'lane' as const, viewKey: 'shared' };
    const first = taskTarget('shared', 'lane-a', 'task-1');
    const second = taskTarget('other-occurrence', 'lane-b', 'task-1');
    const store = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
      session: {
        kind: 'uncontrolled',
        value: {
          selection: [lane, first, second],
          viewport: { verticalStart: 0 },
        },
      },
    });

    expect(
      store.getSnapshot().session.selection.map((target) => [target.kind, target.viewKey]),
    ).toEqual([
      ['lane', 'shared'],
      ['task', 'shared'],
      ['task', 'other-occurrence'],
    ]);
  });

  it('enforces ownership modes, input validity, and disposal', () => {
    const uncontrolled = createGanttRuntimeStore({
      document: { kind: 'uncontrolled', value: createPatchTestDocument() },
    });
    expect(() => uncontrolled.updateControlledDocument(createPatchTestDocument())).toThrow(
      'Uncontrolled document',
    );
    expect(() =>
      uncontrolled.updateControlledSession({ selection: [], viewport: { verticalStart: 0 } }),
    ).toThrow('Uncontrolled session');
    expect(() =>
      uncontrolled.updateUncontrolledSession({
        selection: [],
        viewport: { verticalStart: -1 },
      }),
    ).toThrow('verticalStart');
    expect(() =>
      uncontrolled.setOccurrences([
        occurrence(taskTarget('duplicate', 'lane'), 0, 1),
        occurrence(taskTarget('duplicate', 'lane'), 0, 2),
      ]),
    ).toThrow('Duplicate runtime occurrence');

    uncontrolled.dispose();
    expect(uncontrolled.isDisposed()).toBe(true);
    expect(() => uncontrolled.subscribe(() => {})).toThrow('disposed');
    expect(() => uncontrolled.setHistoryCapabilities(true, false)).toThrow('disposed');
    uncontrolled.dispose();
  });
});

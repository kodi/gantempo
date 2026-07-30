import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import { createPatchTestDocument } from '../commands/patches.test-fixtures';
import type { GanttCommand } from '../commands/types';
import type { Diagnostic } from '../model/diagnostics';
import { serializeGanttDocument } from '../model/serialize';
import type { GanttDocument } from '../model/types';
import { createGanttCommandBus, createGanttCommandCancellationController } from './command-bus';
import { createGanttRuntimeStore } from './store';
import type {
  CreateGanttCommandBusOptions,
  GanttCommandInterception,
  GanttDocumentChange,
} from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function changedTaskDocument(document: GanttDocument, title: string): GanttDocument {
  const outcome = applyGanttCommand(document, {
    changes: { title },
    id: 'task-1',
    type: 'task.update',
  });
  if (outcome.status !== 'committed') {
    throw new Error('Test task changes must commit.');
  }
  return outcome.document;
}

function createUncontrolledBus(
  options: Omit<CreateGanttCommandBusOptions, 'store'> = {},
  historyCapacity = 100,
) {
  const store = createGanttRuntimeStore({
    document: { kind: 'uncontrolled', value: createPatchTestDocument() },
    historyCapacity,
  });
  return {
    bus: createGanttCommandBus({ ...options, store }),
    store,
  };
}

function createControlledBus(
  options: Omit<CreateGanttCommandBusOptions, 'store' | 'onDocumentChange'> & {
    readonly onDocumentChange?: (change: GanttDocumentChange) => void;
  } = {},
  historyCapacity = 100,
) {
  const store = createGanttRuntimeStore({
    document: { kind: 'controlled', value: createPatchTestDocument() },
    historyCapacity,
  });
  return {
    bus: createGanttCommandBus({
      ...options,
      onDocumentChange: options.onDocumentChange ?? (() => {}),
      store,
    }),
    store,
  };
}

describe('Gantt command bus', () => {
  it('adopts uncontrolled candidates before immutable callbacks and commit events', async () => {
    const order: string[] = [];
    const changes: GanttDocumentChange[] = [];
    const { bus, store } = createUncontrolledBus({
      onCommandCommitted(event) {
        order.push('committed');
        expect(event.change).toBe(changes[0]);
        expect(Object.isFrozen(event)).toBe(true);
      },
      onDocumentChange(change) {
        order.push('change');
        changes.push(change);
        expect(store.getSnapshot().document).toEqual(change.document);
      },
    });
    store.subscribe(() => order.push('store'));
    const mutableCommand = {
      changes: { title: 'Bus change' },
      id: 'task-1',
      type: 'task.update' as const,
    };
    const resultPromise = bus.dispatch(mutableCommand, {
      source: { kind: 'toolbar' },
    });
    mutableCommand.changes.title = 'Mutated after dispatch';
    const result = await resultPromise;

    expect(result.status).toBe('committed');
    expect(order).toEqual(['store', 'change', 'committed']);
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Bus change');
    expect(store.getSnapshot().history.canUndo).toBe(true);
    const change = changes[0]!;
    expect(change).toMatchObject({
      baseRevision: 'revision-7',
      operation: 'dispatch',
      proposalId: 'proposal-1',
      source: { kind: 'toolbar' },
    });
    expect(change.originalCommand).toEqual({
      changes: { title: 'Bus change' },
      id: 'task-1',
      type: 'task.update',
    });
    expect(change.command).toEqual(change.originalCommand);
    expect(change.patches).toHaveLength(1);
    expect(change.inversePatches).toHaveLength(1);
    expect(change.entityChanges).toEqual([
      {
        after: change.document.tasks[0],
        before: createPatchTestDocument().tasks[0],
        collection: 'tasks',
        id: 'task-1',
        kind: 'update',
      },
    ]);
    expect(Object.isFrozen(change)).toBe(true);
    expect(Object.isFrozen(change.entityChanges)).toBe(true);
    expect(Object.isFrozen(change.entityChanges[0])).toBe(true);
    expect(Object.isFrozen(change.originalCommand)).toBe(true);
    expect(Object.isFrozen(change.source)).toBe(true);
  });

  it('runs each interceptor once in order and forwards bounded replacements', async () => {
    const seen: string[] = [];
    const changes: GanttDocumentChange[] = [];
    const firstReplacement: GanttCommand = {
      changes: { title: 'First replacement' },
      id: 'task-1',
      type: 'task.update',
    };
    const transactionReplacement: GanttCommand = {
      commands: [
        {
          changes: { title: 'Final replacement' },
          id: 'task-1',
          type: 'task.update',
        },
        { delta: 5, id: 'task-1', type: 'task.move' },
      ],
      type: 'transaction',
    };
    const { bus, store } = createUncontrolledBus({
      interceptors: [
        (proposal) => {
          seen.push(`first:${proposal.command.type}`);
          return { command: firstReplacement, kind: 'replace' };
        },
        (proposal) => {
          seen.push(
            `second:${proposal.command.type}:${
              proposal.command.type === 'task.update' ? proposal.command.changes.title : ''
            }`,
          );
          return { command: transactionReplacement, kind: 'replace' };
        },
      ],
      onDocumentChange: (change) => changes.push(change),
    });

    const result = await bus.dispatch({
      changes: { title: 'Original' },
      id: 'task-1',
      type: 'task.update',
    });

    expect(result.status).toBe('committed');
    expect(seen).toEqual(['first:task.update', 'second:task.update:First replacement']);
    expect(store.getSnapshot().document.tasks[0]).toMatchObject({
      schedule: { end: 25, start: 15 },
      title: 'Final replacement',
    });
    expect(changes[0]?.originalCommand).toMatchObject({
      changes: { title: 'Original' },
      type: 'task.update',
    });
    expect(changes[0]?.command).toEqual(transactionReplacement);
    expect(changes[0]?.patches).toHaveLength(2);
  });

  it('rejects typed, thrown, and malformed interceptor outcomes without mutation', async () => {
    const rejection: Diagnostic = {
      code: 'command.invalid-payload',
      message: 'Policy rejected the command.',
      path: '/policy',
      severity: 'error',
    };
    const cases: readonly GanttCommandInterception[] = [
      { diagnostic: rejection, kind: 'reject' },
      null as unknown as GanttCommandInterception,
    ];
    for (const interception of cases) {
      const { bus, store } = createUncontrolledBus({
        interceptors: [() => interception],
      });
      const base = store.getSnapshot().document;
      const result = await bus.dispatch({
        changes: { title: 'Rejected' },
        id: 'task-1',
        type: 'task.update',
      });
      expect(result.status).toBe('rejected');
      expect(store.getSnapshot().document).toBe(base);
      expect(result.status === 'rejected' ? result.diagnostics[0]?.code : '').toBe(
        interception === null ? 'runtime.invalid-interceptor-result' : 'command.invalid-payload',
      );
    }

    const { bus, store } = createUncontrolledBus({
      interceptors: [
        async () => {
          throw new Error('Interceptor failure');
        },
      ],
    });
    const base = store.getSnapshot().document;
    const result = await bus.dispatch({
      changes: { title: 'Rejected' },
      id: 'task-1',
      type: 'task.update',
    });
    expect(result.status).toBe('rejected');
    expect(store.getSnapshot().document).toBe(base);
    expect(result.status === 'rejected' ? result.diagnostics[0]?.code : '').toBe(
      'runtime.interceptor-threw',
    );
  });

  it('serializes dispatch while allowing queued aborts to settle immediately', async () => {
    const gate = deferred<GanttCommandInterception>();
    const entered: string[] = [];
    const { bus } = createUncontrolledBus({
      interceptors: [
        (proposal) => {
          entered.push(proposal.proposalId);
          return proposal.proposalId === 'proposal-1' ? gate.promise : { kind: 'allow' };
        },
      ],
    });
    const firstController = createGanttCommandCancellationController();
    const secondController = createGanttCommandCancellationController();
    const first = bus.dispatch(
      { changes: { title: 'First' }, id: 'task-1', type: 'task.update' },
      { cancellation: firstController.signal },
    );
    await Promise.resolve();
    const second = bus.dispatch(
      { changes: { title: 'Second' }, id: 'task-1', type: 'task.update' },
      { cancellation: secondController.signal },
    );
    secondController.abort();
    const secondResult = await second;

    expect(secondResult.status).toBe('rejected');
    expect(secondResult.status === 'rejected' ? secondResult.diagnostics[0]?.code : '').toBe(
      'runtime.aborted',
    );
    expect(entered).toEqual(['proposal-1']);

    gate.resolve({ kind: 'allow' });
    expect((await first).status).toBe('committed');
  });

  it('rejects a controlled dispatch when interception makes its captured base stale', async () => {
    const gate = deferred<GanttCommandInterception>();
    const changes: GanttDocumentChange[] = [];
    const { bus, store } = createControlledBus({
      interceptors: [() => gate.promise],
      onDocumentChange: (change) => changes.push(change),
    });
    const pending = bus.dispatch({
      changes: { title: 'Candidate' },
      id: 'task-1',
      type: 'task.update',
    });
    await Promise.resolve();
    expect(
      bus.updateControlledDocument(changedTaskDocument(store.getSnapshot().document, 'External')),
    ).toEqual({ status: 'external-content' });
    gate.resolve({ kind: 'allow' });

    const result = await pending;
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' ? result.diagnostics[0]?.code : '').toBe(
      'runtime.stale-base',
    );
    expect(changes).toEqual([]);
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('External');
  });

  it('proposes one controlled candidate and commits only after exact acknowledgement', async () => {
    const changes: GanttDocumentChange[] = [];
    const committed: string[] = [];
    const rejected: string[] = [];
    const { bus, store } = createControlledBus({
      onCommandCommitted: (event) => committed.push(event.proposalId),
      onCommandRejected: (event) => rejected.push(event.diagnostics[0]?.code ?? 'missing'),
      onDocumentChange: (change) => changes.push(change),
    });
    const base = store.getSnapshot().document;
    const first = await bus.dispatch({
      changes: { title: 'Candidate' },
      id: 'task-1',
      type: 'task.update',
    });

    expect(first.status).toBe('proposed');
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('First');
    expect(committed).toEqual([]);
    const second = await bus.dispatch({
      changes: { title: 'Blocked' },
      id: 'task-1',
      type: 'task.update',
    });
    expect(second.status).toBe('rejected');
    expect(second.status === 'rejected' ? second.diagnostics[0]?.code : '').toBe(
      'runtime.pending-proposal',
    );
    expect(store.getSnapshot().document).toBe(base);

    expect(bus.updateControlledDocument(changes[0]!.document)).toEqual({
      proposalId: 'proposal-1',
      status: 'acknowledged',
    });
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Candidate');
    expect(store.getSnapshot().history.canUndo).toBe(true);
    expect(committed).toEqual(['proposal-1']);
    expect(rejected).toEqual(['runtime.pending-proposal']);
  });

  it('emits controlled divergence rejection and preserves the external authority', async () => {
    const changes: GanttDocumentChange[] = [];
    const rejected: string[] = [];
    const { bus, store } = createControlledBus({
      onCommandRejected: (event) => rejected.push(event.diagnostics[0]?.code ?? 'missing'),
      onDocumentChange: (change) => changes.push(change),
    });
    expect(
      (
        await bus.dispatch({
          changes: { title: 'Candidate' },
          id: 'task-1',
          type: 'task.update',
        })
      ).status,
    ).toBe('proposed');
    const external = changedTaskDocument(store.getSnapshot().document, 'Server');

    expect(bus.updateControlledDocument(external)).toEqual({
      proposalId: 'proposal-1',
      status: 'diverged',
    });
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Server');
    expect(rejected).toEqual(['runtime.controlled-proposal-diverged']);
    expect(changes).toHaveLength(1);
  });

  it('keeps controlled document-only usage read-only and skips no-op candidates', async () => {
    const readOnlyStore = createGanttRuntimeStore({
      document: { kind: 'controlled', value: createPatchTestDocument() },
    });
    const readOnlyBus = createGanttCommandBus({ store: readOnlyStore });
    const rejected = await readOnlyBus.dispatch({
      delta: 1,
      id: 'task-1',
      type: 'task.move',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.status === 'rejected' ? rejected.diagnostics[0]?.code : '').toBe(
      'runtime.read-only',
    );

    const changes: GanttDocumentChange[] = [];
    const { bus } = createControlledBus({
      onDocumentChange: (change) => changes.push(change),
    });
    const noOp = await bus.dispatch({
      delta: 0,
      id: 'task-1',
      type: 'task.move',
    });
    expect(noOp).toMatchObject({ status: 'committed' });
    expect(noOp.status === 'committed' ? noOp.change : undefined).toBeUndefined();
    expect(changes).toEqual([]);
  });

  it('settles active and queued work on abort or disposal', async () => {
    const never = new Promise<GanttCommandInterception>(() => {});
    const { bus } = createUncontrolledBus({ interceptors: [() => never] });
    const controller = createGanttCommandCancellationController();
    const active = bus.dispatch(
      { changes: { title: 'Active' }, id: 'task-1', type: 'task.update' },
      { cancellation: controller.signal },
    );
    await Promise.resolve();
    controller.abort();
    const aborted = await active;
    expect(aborted.status).toBe('rejected');
    expect(aborted.status === 'rejected' ? aborted.diagnostics[0]?.code : '').toBe(
      'runtime.aborted',
    );

    const { bus: disposable } = createUncontrolledBus({
      interceptors: [() => never],
    });
    const current = disposable.dispatch({
      changes: { title: 'Current' },
      id: 'task-1',
      type: 'task.update',
    });
    const queued = disposable.dispatch({
      changes: { title: 'Queued' },
      id: 'task-1',
      type: 'task.update',
    });
    await Promise.resolve();
    disposable.dispose();
    const [currentResult, queuedResult] = await Promise.all([current, queued]);
    expect(currentResult.status).toBe('rejected');
    expect(queuedResult.status).toBe('rejected');
    expect(currentResult.status === 'rejected' ? currentResult.diagnostics[0]?.code : '').toBe(
      'runtime.disposed',
    );
    expect(queuedResult.status === 'rejected' ? queuedResult.diagnostics[0]?.code : '').toBe(
      'runtime.disposed',
    );
    expect(disposable.isDisposed()).toBe(true);
  });

  it('reports callback failures without rolling back an adopted command', async () => {
    const hostError = new Error('Host callback failed');
    const reported: unknown[] = [];
    const runtimeErrors: string[] = [];
    const { bus, store } = createUncontrolledBus({
      onDocumentChange() {
        throw hostError;
      },
      onRuntimeError(event) {
        runtimeErrors.push(event.diagnostic.code);
      },
      reportHostError(error) {
        reported.push(error);
      },
    });

    const result = await bus.dispatch({
      changes: { title: 'Still committed' },
      id: 'task-1',
      type: 'task.update',
    });

    expect(result.status).toBe('committed');
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Still committed');
    expect(runtimeErrors).toEqual(['runtime.callback-threw']);
    expect(reported).toEqual([hostError]);
  });

  it('treats throwing store subscribers as host errors after adoption', async () => {
    const reported: unknown[] = [];
    const { bus, store } = createUncontrolledBus({
      reportHostError(error) {
        reported.push(error);
      },
    });
    const subscriberError = new Error('Subscriber failed');
    store.subscribe(() => {
      throw subscriberError;
    });

    const result = await bus.dispatch({
      changes: { title: 'Adopted despite subscriber' },
      id: 'task-1',
      type: 'task.update',
    });

    expect(result.status).toBe('committed');
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Adopted despite subscriber');
    expect(reported).toEqual([subscriberError]);
  });

  it('orchestrates bounded uncontrolled undo/redo without re-running interceptors', async () => {
    let interceptorCalls = 0;
    const changes: GanttDocumentChange[] = [];
    const { bus, store } = createUncontrolledBus(
      {
        interceptors: [
          () => {
            interceptorCalls += 1;
            return { kind: 'allow' };
          },
        ],
        onDocumentChange: (change) => changes.push(change),
      },
      2,
    );
    for (const title of ['One', 'Two', 'Three']) {
      expect(
        (
          await bus.dispatch({
            changes: { title },
            id: 'task-1',
            type: 'task.update',
          })
        ).status,
      ).toBe('committed');
    }
    expect(interceptorCalls).toBe(3);
    expect(store.getSnapshot().history.canUndo).toBe(true);

    const undoOne = await bus.undo();
    const undoTwo = await bus.undo();
    const undoEmpty = await bus.undo();
    expect(undoOne.status).toBe('committed');
    expect(undoTwo.status).toBe('committed');
    expect(undoEmpty.status).toBe('rejected');
    expect(undoEmpty.status === 'rejected' ? undoEmpty.diagnostics[0]?.code : '').toBe(
      'runtime.history-empty',
    );
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('One');
    expect(store.getSnapshot().history.canRedo).toBe(true);
    expect(interceptorCalls).toBe(3);

    expect((await bus.redo()).status).toBe('committed');
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Two');
    expect(
      (
        await bus.dispatch({
          changes: { title: 'Branch' },
          id: 'task-1',
          type: 'task.update',
        })
      ).status,
    ).toBe('committed');
    expect(store.getSnapshot().history.canRedo).toBe(false);
    expect(changes.map((change) => change.operation)).toEqual([
      'dispatch',
      'dispatch',
      'dispatch',
      'undo',
      'undo',
      'redo',
      'dispatch',
    ]);
  });

  it('proposes controlled undo/redo and preserves history across revision-only input', async () => {
    const changes: GanttDocumentChange[] = [];
    const { bus, store } = createControlledBus({
      onDocumentChange: (change) => changes.push(change),
    });
    const dispatch = await bus.dispatch({
      changes: { title: 'Controlled change' },
      id: 'task-1',
      type: 'task.update',
    });
    expect(dispatch.status).toBe('proposed');
    bus.updateControlledDocument(
      dispatch.status === 'proposed' ? dispatch.change.document : store.getSnapshot().document,
    );
    expect(store.getSnapshot().history.canUndo).toBe(true);

    expect(
      bus.updateControlledDocument(
        Object.freeze({ ...store.getSnapshot().document, revision: 'server-8' }),
      ),
    ).toEqual({ status: 'revision-only' });
    expect(store.getSnapshot().history.canUndo).toBe(true);

    const undo = await bus.undo();
    expect(undo.status).toBe('proposed');
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Controlled change');
    expect(undo.status === 'proposed' ? undo.change.operation : '').toBe('undo');
    if (undo.status === 'proposed') {
      bus.updateControlledDocument(undo.change.document);
    }
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('First');
    expect(store.getSnapshot().document.revision).toBe('server-8');
    expect(store.getSnapshot().history.canRedo).toBe(true);

    const redo = await bus.redo();
    expect(redo.status).toBe('proposed');
    if (redo.status === 'proposed') {
      bus.updateControlledDocument(redo.change.document);
    }
    expect(store.getSnapshot().document.tasks[0]?.title).toBe('Controlled change');
    expect(changes.map((change) => change.operation)).toEqual(['dispatch', 'undo', 'redo']);
  });

  it('stores a transaction as one runtime history entry', async () => {
    const { bus, store } = createUncontrolledBus();
    const before = serializeGanttDocument(store.getSnapshot().document);
    const transaction = await bus.dispatch({
      commands: [
        { delta: 5, id: 'task-1', type: 'task.move' },
        { edge: 'end', id: 'task-1', time: 30, type: 'task.resize' },
      ],
      type: 'transaction',
    });
    expect(transaction.status).toBe('committed');
    expect(store.getSnapshot().document.tasks[0]?.schedule).toEqual({
      end: 30,
      mode: 'instant',
      start: 15,
    });

    expect((await bus.undo()).status).toBe('committed');
    expect(serializeGanttDocument(store.getSnapshot().document)).toBe(before);
    const empty = await bus.undo();
    expect(empty.status).toBe('rejected');
    expect(empty.status === 'rejected' ? empty.diagnostics[0]?.code : '').toBe(
      'runtime.history-empty',
    );
  });

  it('clears controlled history on content-changing external replacement', async () => {
    const { bus, store } = createControlledBus();
    const proposed = await bus.dispatch({
      changes: { title: 'Local' },
      id: 'task-1',
      type: 'task.update',
    });
    if (proposed.status === 'proposed') {
      bus.updateControlledDocument(proposed.change.document);
    }
    expect(store.getSnapshot().history.canUndo).toBe(true);

    expect(
      bus.updateControlledDocument(changedTaskDocument(store.getSnapshot().document, 'External')),
    ).toEqual({ status: 'external-content' });
    expect(store.getSnapshot().history.canUndo).toBe(false);
    const undo = await bus.undo();
    expect(undo.status).toBe('rejected');
    expect(undo.status === 'rejected' ? undo.diagnostics[0]?.code : '').toBe(
      'runtime.history-empty',
    );
  });

  it('produces deterministic JSON-compatible change envelopes', async () => {
    const changes: GanttDocumentChange[] = [];
    const { bus } = createUncontrolledBus({
      onDocumentChange: (change) => changes.push(change),
    });
    await bus.dispatch(
      {
        commands: [
          { delta: 5, id: 'task-1', type: 'task.move' },
          { edge: 'end', id: 'task-1', time: 30, type: 'task.resize' },
        ],
        type: 'transaction',
      },
      {
        source: { kind: 'pointer', pointerType: 'touch' },
        target: {
          kind: 'task',
          laneViewKey: 'lane-view',
          taskId: 'task-1',
          viewKey: 'task-view',
        },
      },
    );

    const serialized = JSON.stringify(changes[0]);
    expect(JSON.parse(serialized)).toEqual(changes[0]);
    expect(serialized).toContain('"pointerType":"touch"');
    expect(changes[0]?.patches).toHaveLength(2);
  });

  it('rejects an unacknowledged controlled proposal when disposed', async () => {
    const rejected: string[] = [];
    const { bus } = createControlledBus({
      onCommandRejected: (event) => rejected.push(event.diagnostics[0]?.code ?? 'missing'),
    });
    expect(
      (
        await bus.dispatch({
          changes: { title: 'Pending' },
          id: 'task-1',
          type: 'task.update',
        })
      ).status,
    ).toBe('proposed');

    bus.dispose();
    expect(rejected).toEqual(['runtime.disposed']);
  });
});

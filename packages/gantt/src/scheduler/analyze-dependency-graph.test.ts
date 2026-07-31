import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';

import type { DependencyRecord, GanttDocument } from '../model/types';
import { analyzeDependencyGraph, dependencyPathExists } from './analyze-dependency-graph';

function documentWith(dependencies: readonly DependencyRecord[]): GanttDocument {
  return {
    assignments: [],
    dependencies,
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      kind: id === 'd' ? ('milestone' as const) : ('task' as const),
      segments: [],
      title: id.toUpperCase(),
    })),
  };
}

const dependency = (
  id: string,
  fromTaskId: string,
  toTaskId: string,
  type: DependencyRecord['type'] = 'finish-to-start',
): DependencyRecord => ({ id, fromTaskId, toTaskId, type });

describe('Community dependency graph analysis', () => {
  it('preserves every generated DAG edge independent of dependency array order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ from: fc.nat(39), priority: fc.integer(), span: fc.nat(39) }), {
          maxLength: 120,
        }),
        (inputs) => {
          const tasks = Array.from({ length: 40 }, (_, index) => ({
            id: `task-${String(index).padStart(2, '0')}`,
            kind: 'task' as const,
            segments: [],
            title: String(index),
          }));
          const seen = new Set<string>();
          const dependencies = inputs.flatMap((input, index) => {
            const from = input.from % (tasks.length - 1);
            const to = from + 1 + (input.span % (tasks.length - from - 1));
            const key = `${from}:${to}`;
            if (seen.has(key)) {
              return [];
            }
            seen.add(key);
            return [
              {
                dependency: dependency(`edge-${index}`, tasks[from]!.id, tasks[to]!.id),
                priority: input.priority,
              },
            ];
          });
          const ordered = dependencies
            .sort((left, right) => left.priority - right.priority)
            .map((item) => item.dependency);
          const document: GanttDocument = {
            assignments: [],
            dependencies: ordered,
            lanes: [],
            placements: [],
            resources: [],
            schemaVersion: 1,
            tasks,
          };
          const graph = analyzeDependencyGraph(document);

          expect(graph.stronglyConnectedComponents).toEqual([]);
          expect(
            [...graph.outgoingByTaskId.values()].reduce(
              (count, outgoing) => count + outgoing.length,
              0,
            ),
          ).toBe(ordered.length);
          expect(
            analyzeDependencyGraph({ ...document, dependencies: [...ordered].reverse() }),
          ).toEqual(graph);
        },
      ),
      { numRuns: 150, seed: 20_260_731 },
    );
  });

  it('indexes all dependency types and task kinds without interpreting elapsed lag', () => {
    const document = documentWith([
      { ...dependency('ab', 'a', 'b'), lag: { mode: 'elapsed', unit: 'day', value: -2 } },
      dependency('bc', 'b', 'c', 'start-to-start'),
      dependency('cd', 'c', 'd', 'finish-to-finish'),
      dependency('ad', 'a', 'd', 'start-to-finish'),
    ]);
    const graph = analyzeDependencyGraph(document);

    expect(graph.outgoingByTaskId.get('a')?.map((item) => item.id)).toEqual(['ab', 'ad']);
    expect(graph.incomingByTaskId.get('d')?.map((item) => item.id)).toEqual(['ad', 'cd']);
    expect(graph.stronglyConnectedComponents).toEqual([]);
    expect(graph.diagnostics).toEqual([]);
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.outgoingByTaskId.get('a'))).toBe(true);
  });

  it('normalizes duplicate, cycle, and working-lag diagnostics across input order', () => {
    const dependencies: readonly DependencyRecord[] = [
      dependency('ca', 'c', 'a'),
      dependency('ab-2', 'a', 'b'),
      { ...dependency('bc', 'b', 'c'), lag: { mode: 'working', unit: 'hour', value: 4 } },
      dependency('ab-1', 'a', 'b'),
    ];
    const first = analyzeDependencyGraph(documentWith(dependencies));
    const second = analyzeDependencyGraph(documentWith([...dependencies].reverse()));

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(first.stronglyConnectedComponents).toEqual([['a', 'b', 'c']]);
    expect(first.diagnostics).toEqual([
      expect.objectContaining({
        code: 'dependency.cycle',
        details: expect.objectContaining({
          path: ['a', 'b', 'c', 'a'],
          taskIds: ['a', 'b', 'c'],
        }),
      }),
      expect.objectContaining({ code: 'dependency.duplicate', entityIds: ['ab-1', 'ab-2'] }),
      expect.objectContaining({ code: 'dependency.working-lag', entityIds: ['bc'] }),
    ]);
  });

  it('detects prospective paths and handles a deep graph iteratively', () => {
    const count = 5_000;
    const tasks = Array.from({ length: count }, (_, index) => ({
      id: `task-${String(index).padStart(4, '0')}`,
      kind: 'task' as const,
      segments: [],
      title: String(index),
    }));
    const dependencies = Array.from({ length: count - 1 }, (_, index) =>
      dependency(`edge-${index}`, tasks[index]!.id, tasks[index + 1]!.id),
    );
    const document: GanttDocument = {
      assignments: [],
      dependencies,
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks,
    };

    expect(analyzeDependencyGraph(document).stronglyConnectedComponents).toEqual([]);
    expect(dependencyPathExists(document, tasks[0]!.id, tasks.at(-1)!.id)).toBe(true);
    expect(dependencyPathExists(document, tasks.at(-1)!.id, tasks[0]!.id)).toBe(false);
    const cyclic = analyzeDependencyGraph({
      ...document,
      dependencies: [...dependencies, dependency('closing-edge', tasks.at(-1)!.id, tasks[0]!.id)],
    });
    const cycleDiagnostic = cyclic.diagnostics[0]!;
    expect(cycleDiagnostic).toMatchObject({
      code: 'dependency.cycle',
      details: { pathTruncated: true, taskCount: count },
    });
    expect((cycleDiagnostic.details!.path as unknown[]).length).toBe(32);
  });
});

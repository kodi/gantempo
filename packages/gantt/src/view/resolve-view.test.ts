import { describe, expect, it } from 'vite-plus/test';

import type { GanttDocument } from '../model/types';
import { resolveView } from './resolve-view';
import type { GanttViewDefinition } from './types';

function createDocument(): GanttDocument {
  return {
    schemaVersion: 1,
    tasks: [
      {
        id: 'shared',
        title: 'Design',
        kind: 'task',
        segments: [
          {
            id: 'segment-a',
            schedule: { mode: 'instant', start: 1, end: 2 },
          },
        ],
      },
      { id: 'task-b', title: 'Build', kind: 'task', segments: [] },
    ],
    resources: [
      { id: 'shared', title: 'Ada' },
      { id: 'resource-b', title: 'Grace' },
    ],
    lanes: [
      { id: 'shared', title: 'Planned', height: 72 },
      { id: 'lane-b', title: 'Later' },
    ],
    assignments: [
      { id: 'shared', taskId: 'shared', resourceId: 'shared' },
      { id: 'assignment-b', taskId: 'shared', resourceId: 'resource-b' },
    ],
    placements: [
      {
        id: 'shared',
        taskId: 'shared',
        laneId: 'shared',
        segmentId: 'segment-a',
        assignmentId: 'shared',
      },
    ],
    dependencies: [],
  };
}

describe('resolveView', () => {
  it('preserves document lane and placement order with canonical provenance', () => {
    const result = resolveView(createDocument(), { kind: 'document' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes.map((lane) => lane.title)).toEqual(['Planned', 'Later']);
    expect(result.view.lanes[0]).toMatchObject({
      minimumHeight: 72,
      source: { kind: 'document-lane', laneId: 'shared' },
    });
    expect(result.view.placements).toHaveLength(1);
    expect(result.view.placements[0]).toMatchObject({
      taskId: 'shared',
      segmentId: 'segment-a',
      assignmentId: 'shared',
      source: {
        kind: 'document-placement',
        placementId: 'shared',
        laneId: 'shared',
      },
    });
    expect(result.view.lanes[0]?.key).not.toBe(result.view.placements[0]?.key);
  });

  it('derives one flat project lane and placement per task', () => {
    const result = resolveView(createDocument(), { kind: 'project' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes.map((lane) => lane.source)).toEqual([
      { kind: 'project-task', taskId: 'shared' },
      { kind: 'project-task', taskId: 'task-b' },
    ]);
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual([
      'shared',
      'task-b',
    ]);
    expect(result.view.lanes.map((lane) => lane.project)).toEqual([
      { depth: 0, hasChildren: false },
      { depth: 0, hasChildren: false },
    ]);
  });

  it('projects ordered trees, collapse, ancestor-aware filters, and stable keys', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [
        { id: 'root-b', kind: 'summary', order: 2, segments: [], title: 'Root B' },
        {
          id: 'child-b',
          kind: 'task',
          order: 2,
          parentId: 'root-a',
          segments: [],
          title: 'Child B',
        },
        { id: 'root-a', kind: 'summary', order: 1, segments: [], title: 'Root A' },
        {
          id: 'nested',
          kind: 'summary',
          order: 1,
          parentId: 'root-a',
          segments: [],
          title: 'Nested',
        },
        {
          id: 'needle',
          kind: 'task',
          parentId: 'nested',
          segments: [],
          title: 'Needle',
        },
      ],
    };

    const expanded = resolveView(document, { kind: 'project' });
    expect(expanded.status).toBe('resolved');
    if (expanded.status !== 'resolved') {
      return;
    }
    expect(expanded.view.lanes.map((lane) => lane.source)).toEqual([
      { kind: 'project-task', taskId: 'root-a' },
      { kind: 'project-task', taskId: 'nested' },
      { kind: 'project-task', taskId: 'needle' },
      { kind: 'project-task', taskId: 'child-b' },
      { kind: 'project-task', taskId: 'root-b' },
    ]);
    expect(expanded.view.lanes.map((lane) => lane.project)).toEqual([
      { depth: 0, expanded: true, hasChildren: true },
      { depth: 1, expanded: true, hasChildren: true },
      { depth: 2, hasChildren: false },
      { depth: 1, hasChildren: false },
      { depth: 0, hasChildren: false },
    ]);

    const collapsed = resolveView(
      document,
      { kind: 'project' },
      { project: { collapsedTaskIds: ['nested', 'missing', 'nested'] } },
    );
    expect(collapsed.status).toBe('resolved');
    if (collapsed.status !== 'resolved') {
      return;
    }
    expect(collapsed.view.placements.map((placement) => placement.taskId)).toEqual([
      'root-a',
      'nested',
      'child-b',
      'root-b',
    ]);
    expect(collapsed.view.lanes[1]?.project).toEqual({
      depth: 1,
      expanded: false,
      hasChildren: true,
    });

    const filtered = resolveView(
      document,
      { kind: 'project', filter: (task) => task.id === 'needle' },
      { project: { collapsedTaskIds: ['root-a', 'nested'] } },
    );
    expect(filtered.status).toBe('resolved');
    if (filtered.status !== 'resolved') {
      return;
    }
    expect(filtered.view.placements.map((placement) => placement.taskId)).toEqual([
      'root-a',
      'nested',
      'needle',
    ]);
    expect(filtered.view.lanes.map((lane) => lane.project?.filterMatch)).toEqual([
      'ancestor',
      'ancestor',
      'direct',
    ]);
    expect(filtered.view.lanes.slice(0, 2).map((lane) => lane.project?.expanded)).toEqual([
      true,
      true,
    ]);
    expect(filtered.view.lanes[2]?.key).toBe(expanded.view.lanes[2]?.key);
    expect(filtered.view.placements[2]?.key).toBe(expanded.view.placements[2]?.key);

    const directlyMatchedAncestor = resolveView(
      document,
      {
        filter: (task) => task.id === 'root-a' || task.id === 'needle',
        kind: 'project',
      },
      { project: { collapsedTaskIds: ['root-a', 'nested'] } },
    );
    expect(directlyMatchedAncestor.status).toBe('resolved');
    if (directlyMatchedAncestor.status !== 'resolved') {
      return;
    }
    expect(directlyMatchedAncestor.view.placements.map((placement) => placement.taskId)).toEqual([
      'root-a',
      'nested',
      'needle',
    ]);
    expect(directlyMatchedAncestor.view.lanes[0]?.project).toMatchObject({
      expanded: true,
      filterMatch: 'direct',
    });
  });

  it('sorts only siblings and preserves canonical order for comparator ties', () => {
    const document = createDocument();
    const ascending = resolveView(document, {
      kind: 'project',
      sort: (left, right) => left.title.localeCompare(right.title),
    });
    expect(ascending.status).toBe('resolved');
    if (ascending.status !== 'resolved') {
      return;
    }
    expect(ascending.view.placements.map((placement) => placement.taskId)).toEqual([
      'task-b',
      'shared',
    ]);

    const tied = resolveView(document, { kind: 'project', sort: () => 0 });
    expect(tied.status).toBe('resolved');
    if (tied.status !== 'resolved') {
      return;
    }
    expect(tied.view.placements.map((placement) => placement.taskId)).toEqual(['shared', 'task-b']);
  });

  it('rejects malformed project queries and callback failures without mutating input', () => {
    const document = createDocument();
    const snapshot = structuredClone(document);
    let receivedFrozenTask = false;
    let receivedIsolatedTask = false;
    const filtered = resolveView(document, {
      filter(task) {
        receivedFrozenTask =
          Object.isFrozen(task) &&
          Object.isFrozen(task.segments) &&
          Object.isFrozen(task.segments[0]?.schedule);
        receivedIsolatedTask =
          task !== document.tasks[0] && task.segments !== document.tasks[0]?.segments;
        return true;
      },
      kind: 'project',
    });
    expect(filtered.status).toBe('resolved');
    expect(receivedFrozenTask).toBe(true);
    expect(receivedIsolatedTask).toBe(true);
    expect(document).toEqual(snapshot);

    const thrown = resolveView(document, {
      filter: () => {
        throw new Error('consumer failure');
      },
      kind: 'project',
    });
    expect(thrown.status).toBe('rejected');
    expect(thrown.diagnostics[0]?.code).toBe('view.project-filter');

    const nonBoolean = resolveView(document, {
      filter: (() => 'yes') as unknown as (task: GanttDocument['tasks'][number]) => boolean,
      kind: 'project',
    });
    expect(nonBoolean.status).toBe('rejected');
    expect(nonBoolean.diagnostics[0]?.code).toBe('view.project-filter');

    const nonFiniteSort = resolveView(document, { kind: 'project', sort: () => Number.NaN });
    expect(nonFiniteSort.status).toBe('rejected');
    expect(nonFiniteSort.diagnostics[0]?.code).toBe('view.project-sort');

    const thrownSort = resolveView(document, {
      kind: 'project',
      sort: () => {
        throw new Error('consumer failure');
      },
    });
    expect(thrownSort.status).toBe('rejected');
    expect(thrownSort.diagnostics[0]?.code).toBe('view.project-sort');

    const malformedQuery = resolveView(document, { kind: 'project' }, {
      project: { collapsedTaskIds: 'bad' },
    } as never);
    expect(malformedQuery.status).toBe('rejected');
    expect(malformedQuery.diagnostics[0]?.code).toBe('view.project-query');

    const malformedQueryObject = resolveView(document, { kind: 'project' }, {
      project: null,
    } as never);
    expect(malformedQueryObject.status).toBe('rejected');
    expect(malformedQueryObject.diagnostics[0]?.code).toBe('view.project-query');

    const invalidTopology = resolveView(
      { ...document, tasks: [...document.tasks, document.tasks[0]!] },
      { kind: 'project' },
    );
    expect(invalidTopology.status).toBe('rejected');
    expect(invalidTopology.diagnostics[0]?.code).toBe('view.duplicate-source-id');
  });

  it('does not retain unmatched descendants when a summary matches the filter', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [
        { id: 'summary', kind: 'summary', segments: [], title: 'Summary' },
        {
          id: 'child',
          kind: 'task',
          parentId: 'summary',
          segments: [],
          title: 'Child',
        },
      ],
    };

    const result = resolveView(document, {
      filter: (task) => task.id === 'summary',
      kind: 'project',
    });
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual(['summary']);
    expect(result.view.lanes[0]?.project).toEqual({
      depth: 0,
      expanded: true,
      filterMatch: 'direct',
      hasChildren: true,
    });
  });

  it('projects 10,000 tasks to 2,000 collapsed root lanes with stable identity', () => {
    const tasks: GanttDocument['tasks'][number][] = [];
    const collapsedTaskIds: string[] = [];
    for (let rootIndex = 0; rootIndex < 2_000; rootIndex += 1) {
      const rootId = `root-${rootIndex}`;
      collapsedTaskIds.push(rootId);
      tasks.push({ id: rootId, kind: 'summary', order: rootIndex, segments: [], title: rootId });
      for (let childIndex = 0; childIndex < 4; childIndex += 1) {
        const childId = `${rootId}-child-${childIndex}`;
        tasks.push({
          id: childId,
          kind: 'task',
          order: childIndex,
          parentId: rootId,
          segments: [],
          title: childId,
        });
      }
    }
    const document: GanttDocument = {
      assignments: [],
      dependencies: [],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks,
    };

    const result = resolveView(document, { kind: 'project' }, { project: { collapsedTaskIds } });
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes).toHaveLength(2_000);
    expect(result.view.placements).toHaveLength(2_000);
    expect(new Set(result.view.lanes.map((lane) => lane.key)).size).toBe(2_000);
    expect(result.view.lanes[0]?.project).toEqual({
      depth: 0,
      expanded: false,
      hasChildren: true,
    });
    expect(result.view.lanes.at(-1)?.source).toEqual({
      kind: 'project-task',
      taskId: 'root-1999',
    });
  });

  it('derives resource lanes and repeated task placements from assignment order', () => {
    const result = resolveView(createDocument(), { kind: 'resource' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes.map((lane) => lane.title)).toEqual(['Ada', 'Grace']);
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual([
      'shared',
      'shared',
    ]);
    expect(result.view.placements.map((placement) => placement.assignmentId)).toEqual([
      'shared',
      'assignment-b',
    ]);
    expect(new Set(result.view.placements.map((placement) => placement.laneKey)).size).toBe(2);
  });

  it('normalizes custom data without retaining caller-owned descriptors', () => {
    const definition: GanttViewDefinition = {
      kind: 'custom',
      id: 'status',
      lanes: [{ key: 'doing', title: 'Doing', minimumHeight: 80 }],
      placements: [
        {
          key: 'design',
          laneKey: 'doing',
          taskId: 'shared',
          segmentId: 'segment-a',
        },
      ],
    };

    const result = resolveView(createDocument(), definition);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.lanes[0]).toMatchObject({
      title: 'Doing',
      minimumHeight: 80,
      source: { kind: 'custom', viewId: 'status', customLaneKey: 'doing' },
    });
    expect(result.view.placements[0]).toMatchObject({
      taskId: 'shared',
      segmentId: 'segment-a',
    });
    expect(Object.isFrozen(result.view)).toBe(true);
    expect(Object.isFrozen(result.view.lanes[0]?.source)).toBe(true);
    expect(result.view.lanes[0]).not.toBe(definition.lanes[0]);
  });

  it('rejects duplicate keys and missing custom lane topology', () => {
    const result = resolveView(createDocument(), {
      kind: 'custom',
      id: 'invalid',
      lanes: [
        { key: 'same', title: 'One' },
        { key: 'same', title: 'Two' },
      ],
      placements: [
        { key: 'same', laneKey: 'missing', taskId: 'shared' },
        { key: 'same', laneKey: 'same', taskId: 'shared' },
      ],
    });

    expect(result.status).toBe('rejected');
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'view.duplicate-lane-key',
      'view.missing-lane',
      'view.duplicate-placement-key',
    ]);
  });

  it('omits only placements with invalid canonical references', () => {
    const result = resolveView(createDocument(), {
      kind: 'custom',
      id: 'references',
      lanes: [{ key: 'lane', title: 'Lane' }],
      placements: [
        { key: 'missing', laneKey: 'lane', taskId: 'missing' },
        { key: 'segment', laneKey: 'lane', taskId: 'shared', segmentId: 'missing' },
        { key: 'valid', laneKey: 'lane', taskId: 'shared' },
      ],
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }
    expect(result.view.placements.map((placement) => placement.taskId)).toEqual(['shared']);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'view.missing-task',
      'view.missing-segment',
    ]);
  });

  it('rejects duplicate built-in source IDs without confusing cross-family reuse', () => {
    const document = createDocument();
    const duplicateLaneDocument = {
      ...document,
      lanes: [...document.lanes, { id: 'shared', title: 'Duplicate lane' }],
    };

    expect(resolveView(duplicateLaneDocument, { kind: 'document' }).status).toBe('rejected');
    expect(resolveView(document, { kind: 'document' }).status).toBe('resolved');
  });
});

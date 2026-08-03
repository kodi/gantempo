import { describe, expect, it } from 'vite-plus/test';
import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';
import { createChartScenePipeline } from './scene-pipeline';

function task(
  id: string,
  start: number,
  end: number,
  parentId?: string,
  kind: 'milestone' | 'summary' | 'task' = 'task',
): GanttDocument['tasks'][number] {
  return {
    id,
    kind,
    ...(parentId === undefined ? {} : { parentId }),
    schedule: { end, mode: 'instant', start },
    segments: [],
    title: id,
  };
}

function scene(document: GanttDocument, collapsedTaskIds: readonly string[] = []) {
  return buildChartScene({
    document,
    projectQuery: { collapsedTaskIds },
    range: { end: 1_000, start: 0 },
    tickAnchor: 0,
    tickInterval: 100,
    timeZone: 'UTC',
    view: { kind: 'project' },
  });
}

describe('dependency scene projection', () => {
  it('routes all link types with canonical and occurrence identity', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [
        { fromTaskId: 'a', id: 'fs', toTaskId: 'b', type: 'finish-to-start' },
        { fromTaskId: 'a', id: 'ss', toTaskId: 'b', type: 'start-to-start' },
        { fromTaskId: 'a', id: 'ff', toTaskId: 'b', type: 'finish-to-finish' },
        { fromTaskId: 'a', id: 'sf', toTaskId: 'b', type: 'start-to-finish' },
      ],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [task('a', 100, 300), task('b', 600, 800, undefined, 'milestone')],
    };
    const result = scene(document);
    expect(result.dependencyPaths.map((path) => path.dependencyId)).toEqual([
      'ff',
      'fs',
      'sf',
      'ss',
    ]);
    expect(result.dependencyPaths.every((path) => path.fromViewKey && path.toViewKey)).toBe(true);
    expect(result.dependencySummaries).toHaveLength(4);
  });

  it('proxies collapsed descendants to their nearest visible summary and omits self-proxies', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [
        { fromTaskId: 'child', id: 'outside', toTaskId: 'peer', type: 'finish-to-start' },
        { fromTaskId: 'child', id: 'inside', toTaskId: 'sibling', type: 'finish-to-start' },
      ],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [
        task('summary', 100, 500, undefined, 'summary'),
        task('child', 100, 200, 'summary'),
        task('sibling', 300, 400, 'summary'),
        task('peer', 700, 800),
      ],
    };
    const result = scene(document, ['summary']);
    expect(result.dependencyPaths).toHaveLength(1);
    expect(result.dependencyPaths[0]).toMatchObject({
      dependencyId: 'outside',
      hiddenEndpoint: true,
    });
    expect(
      result.dependencySummaries.find((item) => item.dependency.id === 'inside'),
    ).toMatchObject({
      hiddenEndpoint: true,
      visualized: false,
    });
  });

  it('keeps diagnosed cycles visible and semantically invalid', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [
        { fromTaskId: 'a', id: 'a-b', toTaskId: 'b', type: 'finish-to-start' },
        { fromTaskId: 'b', id: 'b-a', toTaskId: 'a', type: 'finish-to-start' },
      ],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [task('a', 100, 200), task('b', 300, 400)],
    };
    expect(scene(document).dependencyPaths.map((path) => path.status)).toEqual([
      'invalid',
      'invalid',
    ]);
  });

  it('keeps an earlier adjacent target route outside both task rectangles', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [
        { fromTaskId: 'a', id: 'earlier-target', toTaskId: 'b', type: 'finish-to-start' },
      ],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [task('a', 100, 600), task('b', 400, 800)],
    };
    const result = scene(document);
    const source = result.taskBars.find((item) => item.taskId === 'a')!;
    const target = result.taskBars.find((item) => item.taskId === 'b')!;
    const points = result.dependencyPaths[0]!.points;
    const gutterY = (source.y + source.height + target.y) / 2;

    expect(points).toHaveLength(6);
    expect(points[1]).toMatchObject({ y: source.y + source.height / 2 });
    expect(points[2]).toEqual({ x: points[1]!.x, y: gutterY });
    expect(points[3]).toMatchObject({ y: gutterY });
    expect(points[4]).toEqual({ x: points[3]!.x, y: target.y + target.height / 2 });
    expect(points[1]!.x).toBeGreaterThan(source.x + source.width);
    expect(points[3]!.x).toBeLessThan(target.x);
  });

  it('uses a retained filter-context ancestor as a hidden endpoint proxy', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [
        { fromTaskId: 'hidden', id: 'hidden-peer', toTaskId: 'peer', type: 'finish-to-start' },
      ],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [
        task('summary', 100, 500, undefined, 'summary'),
        task('hidden', 100, 200, 'summary'),
        task('match', 300, 400, 'summary'),
        task('peer', 700, 800),
      ],
    };
    const result = buildChartScene({
      document,
      range: { end: 1_000, start: 0 },
      tickAnchor: 0,
      tickInterval: 100,
      timeZone: 'UTC',
      view: {
        filter: (candidate) => candidate.id === 'match' || candidate.id === 'peer',
        kind: 'project',
      },
    });
    expect(result.dependencyPaths[0]).toMatchObject({
      dependencyId: 'hidden-peer',
      hiddenEndpoint: true,
    });
  });

  it('clips offscreen endpoints while retaining a viewport-crossing route', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [{ fromTaskId: 'a', id: 'a-d', toTaskId: 'd', type: 'finish-to-start' }],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [task('a', 100, 200), task('b', 200, 300), task('c', 300, 400), task('d', 400, 500)],
    };
    const result = buildChartScene({
      document,
      range: { end: 1_000, start: 0 },
      tickAnchor: 0,
      tickInterval: 100,
      timeZone: 'UTC',
      view: { kind: 'project' },
      viewport: { verticalExtent: 116, verticalStart: 58 },
    });
    expect(result.taskBars.map((bar) => bar.taskId)).toEqual(['b', 'c']);
    expect(result.dependencyPaths[0]).toMatchObject({ clippedEnd: true, clippedStart: true });
    expect(result.dependencyPaths[0]?.points[0]?.y).toBe(58);
    expect(result.dependencyPaths[0]?.points.at(-1)?.y).toBe(174);
  });

  it('does not render project relationship paths in repeated-occurrence views', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [{ fromTaskId: 'a', id: 'a-b', toTaskId: 'b', type: 'finish-to-start' }],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [task('a', 100, 200), task('b', 300, 400)],
    };
    const result = buildChartScene({
      document,
      range: { end: 1_000, start: 0 },
      tickAnchor: 0,
      tickInterval: 100,
      timeZone: 'UTC',
    });
    expect(result.dependencyPaths).toEqual([]);
    expect(result.dependencySummaries).toHaveLength(1);
  });

  it('invalidates dependency geometry selectively without rebuilding task topology', () => {
    const document: GanttDocument = {
      assignments: [],
      dependencies: [{ fromTaskId: 'a', id: 'a-b', toTaskId: 'b', type: 'finish-to-start' }],
      lanes: [],
      placements: [],
      resources: [],
      schemaVersion: 1,
      tasks: [task('a', 100, 200), task('b', 300, 400)],
    };
    const options = {
      document,
      range: { end: 1_000, start: 0 },
      tickAnchor: 0,
      tickInterval: 100,
      timeZone: 'UTC',
      view: { kind: 'project' as const },
    };
    const pipeline = createChartScenePipeline();
    const first = pipeline.build(options);
    const appearanceVariants = [
      { id: 'accent', label: 'Accent', tokens: { 'task.fill': '#123456' } },
    ] as const;
    const appearanceOnly = pipeline.build({
      ...options,
      appearanceVariants,
    });
    expect(appearanceOnly.scene.dependencyPaths).toBe(first.scene.dependencyPaths);

    const nextDocument = {
      ...document,
      dependencies: [
        ...document.dependencies,
        { fromTaskId: 'b', id: 'b-a', toTaskId: 'a', type: 'finish-to-start' as const },
      ],
    };
    const changed = pipeline.build(
      { ...options, appearanceVariants, document: nextDocument },
      { affected: [{ collection: 'dependencies', id: 'b-a' }], kind: 'affected' },
    );
    expect(changed.work).toMatchObject({
      lanePrimitiveBuilds: 0,
      taskPrimitiveBuilds: 0,
      topologyBuilds: 0,
    });
    expect(changed.scene.dependencyPaths).toHaveLength(2);
    expect(changed.scene.dependencyPaths.every((path) => path.status === 'invalid')).toBe(true);
  });
});

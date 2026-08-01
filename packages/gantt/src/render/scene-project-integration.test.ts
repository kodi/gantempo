import { describe, expect, it } from 'vite-plus/test';

import { applyGanttCommand } from '../commands/reduce';
import type { GanttDocument } from '../model/types';
import { buildChartScene } from './build-chart-scene';
import { createChartScenePipeline } from './scene-pipeline';

const DAY = 24 * 60 * 60 * 1_000;
const START = Date.UTC(2026, 6, 29);

function fixture(): GanttDocument {
  return {
    assignments: [],
    dependencies: [
      {
        fromTaskId: 'child-a',
        id: 'child-peer',
        toTaskId: 'peer-b',
        type: 'finish-to-start',
      },
    ],
    lanes: [],
    placements: [],
    resources: [],
    schemaVersion: 1,
    tasks: [
      { id: 'summary-a', kind: 'summary', segments: [], title: 'Summary A' },
      {
        id: 'child-a',
        kind: 'task',
        parentId: 'summary-a',
        progress: 0.5,
        schedule: { end: START + 3 * DAY, mode: 'instant', start: START + DAY },
        segments: [],
        title: 'Child A',
      },
      {
        id: 'milestone-a',
        kind: 'milestone',
        parentId: 'summary-a',
        schedule: { end: START + 4 * DAY, mode: 'instant', start: START + 4 * DAY },
        segments: [],
        title: 'Milestone A',
      },
      { id: 'summary-b', kind: 'summary', segments: [], title: 'Summary B' },
      {
        id: 'peer-b',
        kind: 'task',
        parentId: 'summary-b',
        schedule: { end: START + 8 * DAY, mode: 'instant', start: START + 6 * DAY },
        segments: [],
        title: 'Peer B',
      },
    ],
  };
}

const base = {
  direction: 'ltr' as const,
  locale: 'en-US',
  range: { end: START + 10 * DAY, start: START },
  tickAnchor: START,
  tickInterval: DAY,
  timeZone: 'UTC',
  view: { kind: 'project' as const },
};

describe('M5 project pipeline integration', () => {
  it('invalidates locale, formatter, direction, query, dependency, and zoom inputs selectively', () => {
    const document = fixture();
    const pipeline = createChartScenePipeline();
    const initialOptions = { ...base, document };
    const initial = pipeline.build(initialOptions);

    expect(initial.scene).toEqual(buildChartScene(initialOptions));
    expect(initial.work.dependencyPrimitiveBuilds).toBe(1);
    expect(
      pipeline.getDependencies()?.occurrenceKeysByReference.get('tasks\u0000child-a'),
    ).toHaveLength(1);

    const localeOptions = { ...initialOptions, locale: 'sr-Latn-RS' };
    const localized = pipeline.build(localeOptions);
    expect(localized.scene).toEqual(buildChartScene(localeOptions));
    expect(localized.work).toMatchObject({
      dependencyPrimitiveBuilds: 0,
      intervalBuilds: 0,
      laneStackBuilds: 0,
      occurrenceCatalogBuilds: 0,
      taskPrimitiveBuilds: 0,
      tickBuilds: 1,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });

    const formatters = {
      dateTime: (value: number) => `tick:${value}`,
    };
    const formatterOptions = { ...localeOptions, formatters };
    const formatted = pipeline.build(formatterOptions);
    expect(formatted.scene).toEqual(buildChartScene(formatterOptions));
    expect(formatted.scene.ticks.every((tick) => tick.label.startsWith('tick:'))).toBe(true);
    expect(formatted.work).toMatchObject({
      dependencyPrimitiveBuilds: 0,
      intervalBuilds: 0,
      taskPrimitiveBuilds: 0,
      tickBuilds: 1,
      topologyBuilds: 0,
      viewportQueries: 0,
    });

    const rtlOptions = { ...formatterOptions, direction: 'rtl' as const };
    const rtl = pipeline.build(rtlOptions);
    expect(rtl.scene).toEqual(buildChartScene(rtlOptions));
    expect(rtl.work).toMatchObject({
      dependencyPrimitiveBuilds: 1,
      intervalBuilds: 0,
      tickBuilds: 1,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });
    expect(rtl.work.taskPrimitiveBuilds).toBe(rtl.scene.taskBars.length);

    const collapsedOptions = {
      ...rtlOptions,
      projectQuery: { collapsedTaskIds: ['summary-a'] },
    };
    const collapsed = pipeline.build(collapsedOptions);
    expect(collapsed.scene).toEqual(buildChartScene(collapsedOptions));
    expect(collapsed.work).toMatchObject({
      dependencyPrimitiveBuilds: 1,
      intervalBuilds: 1,
      occurrenceCatalogBuilds: 1,
      topologyBuilds: 1,
    });
    expect(collapsed.scene.dependencyPaths[0]).toMatchObject({ hiddenEndpoint: true });

    const update = applyGanttCommand(document, {
      changes: { type: 'start-to-start' },
      id: 'child-peer',
      type: 'dependency.update',
    });
    expect(update.status).toBe('committed');
    if (update.status !== 'committed') return;
    const dependencyOptions = { ...collapsedOptions, document: update.document };
    const dependency = pipeline.build(dependencyOptions, {
      affected: update.affected,
      kind: 'affected',
    });
    expect(dependency.scene).toEqual(buildChartScene(dependencyOptions));
    expect(dependency.scene.dependencyPaths[0]?.type).toBe('start-to-start');
    expect(dependency.work).toMatchObject({
      dependencyPrimitiveBuilds: 1,
      intervalBuilds: 0,
      occurrenceCatalogBuilds: 0,
      taskPrimitiveBuilds: 0,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 0,
    });

    const zoomOptions = {
      ...dependencyOptions,
      range: { end: START + 9 * DAY, start: START + DAY },
    };
    const zoomed = pipeline.build(zoomOptions);
    expect(zoomed.scene).toEqual(buildChartScene(zoomOptions));
    expect(zoomed.work).toMatchObject({
      dependencyPrimitiveBuilds: 1,
      intervalBuilds: 0,
      occurrenceCatalogBuilds: 0,
      tickBuilds: 1,
      topologyBuilds: 0,
      viewportKernelBuilds: 0,
      viewportQueries: 1,
    });

    const filter = (task: GanttDocument['tasks'][number]) => task.id.includes('peer');
    const filteredOptions = {
      ...zoomOptions,
      view: {
        filter,
        kind: 'project' as const,
        sort: (left: GanttDocument['tasks'][number], right: GanttDocument['tasks'][number]) =>
          right.title.localeCompare(left.title),
      },
    };
    const filtered = pipeline.build(filteredOptions);
    expect(filtered.scene).toEqual(buildChartScene(filteredOptions));
    expect(filtered.work).toMatchObject({
      dependencyPrimitiveBuilds: 1,
      intervalBuilds: 1,
      occurrenceCatalogBuilds: 1,
      topologyBuilds: 1,
    });
    expect(filtered.scene.lanes.map((lane) => lane.title)).toEqual(['Summary B', 'Peer B']);
  });
});

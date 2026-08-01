import type { DependencyType, EpochMilliseconds, LocalDateString } from '../model/types';

export type GanttDirection = 'ltr' | 'rtl';
export type GanttMessageValue = number | string;
export type GanttMessageValues = Readonly<Record<string, GanttMessageValue>>;

export type GanttMessageKey =
  | 'chart.empty'
  | 'chart.label'
  | 'chart.read-only'
  | 'common.cancel'
  | 'common.delete'
  | 'common.save'
  | 'dependency.create'
  | 'dependency.delete'
  | 'dependency.edit'
  | 'dependency.hidden-endpoint'
  | 'dependency.incoming'
  | 'dependency.invalid'
  | 'dependency.lag'
  | 'dependency.outgoing'
  | 'dependency.relationships'
  | `dependency.type.${DependencyType}`
  | 'field.appearance'
  | 'field.description'
  | 'field.end'
  | 'field.kind'
  | 'field.lag'
  | 'field.lane'
  | 'field.order'
  | 'field.parent'
  | 'field.progress'
  | 'field.start'
  | 'field.title'
  | 'interaction.cancelled'
  | 'interaction.committed'
  | 'interaction.create'
  | 'interaction.link'
  | 'interaction.move'
  | 'interaction.progress'
  | 'interaction.rejected'
  | 'interaction.resize'
  | 'interaction.selection'
  | 'properties.edit'
  | 'properties.view'
  | 'task.kind.milestone'
  | 'task.kind.summary'
  | 'task.kind.task'
  | 'task.progress'
  | 'task.unscheduled'
  | 'tree.collapse'
  | 'tree.expand'
  | 'tree.filtered-ancestor'
  | 'tree.hidden-focus'
  | 'validation.summary'
  | 'zoom.fit'
  | 'zoom.in'
  | 'zoom.out';

export interface GanttMessageDescriptor {
  readonly defaultMessage: string;
  readonly key: GanttMessageKey;
  readonly values: GanttMessageValues;
}

export type GanttFormatUse =
  | 'dependency-lag'
  | 'progress'
  | 'task-end'
  | 'task-start'
  | 'tick-major'
  | 'tick-minor';

export interface GanttFormatContext {
  readonly direction: GanttDirection;
  readonly locale: string;
  readonly timeZone: string;
  readonly use: GanttFormatUse;
}

export interface GanttFormatters {
  readonly date?: (value: LocalDateString, context: GanttFormatContext) => string;
  readonly dateTime?: (value: EpochMilliseconds, context: GanttFormatContext) => string;
  readonly message?: (descriptor: GanttMessageDescriptor) => string;
  readonly number?: (value: number, context: GanttFormatContext) => string;
}

export type GanttMessages = Partial<Readonly<Record<GanttMessageKey, string>>>;

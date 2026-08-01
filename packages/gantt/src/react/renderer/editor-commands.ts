import type { GanttCommand } from '../../commands/types';
import type { LaneRowPrimitive, TaskBarPrimitive } from '../../render/primitives';
import type { GanttReactRuntime, GanttReactRuntimeSnapshot } from '../runtime';
import type { GanttItemPropertiesValue, GanttTaskEditorValue } from '../types';

export function taskEditDisabledReason(
  task: TaskBarPrimitive,
  runtime: GanttReactRuntime,
  disabled: boolean,
  editorEnabled: boolean,
): string | undefined {
  if (disabled) {
    return 'The chart is read-only.';
  }
  if (!editorEnabled) {
    return 'Task editing is not enabled.';
  }
  if (task.segmentId !== undefined) {
    return 'Segment occurrences are not editable in the basic editor.';
  }
  if (task.source.kind === 'custom') {
    return 'Custom-view occurrences are not editable in the basic editor.';
  }
  if (task.source.kind !== 'document-placement') {
    return 'Derived task occurrences are not editable in the basic editor.';
  }
  const record = runtime
    .getSnapshot()
    .selector.document.tasks.find((candidate) => candidate.id === task.taskId);
  if (record?.schedule?.mode !== 'instant') {
    return record?.schedule?.mode === 'all-day'
      ? 'All-day tasks are not editable in the basic editor.'
      : 'Unscheduled tasks are not editable in the basic editor.';
  }
  return undefined;
}

export function validateTaskEditorValue(value: GanttTaskEditorValue): string | undefined {
  if (value.title.trim() === '') {
    return 'Title is required.';
  }
  if (!Number.isFinite(value.start) || !Number.isFinite(value.end)) {
    return 'Start and end must be ISO 8601 datetimes with an explicit offset.';
  }
  if (value.end <= value.start) {
    return 'End must be later than start.';
  }
  return undefined;
}

export function taskEditorCommand(
  task: TaskBarPrimitive,
  currentTitle: string,
  value: GanttTaskEditorValue,
): GanttCommand | undefined {
  const commands: GanttCommand[] = [];
  const title = value.title.trim();
  if (title !== currentTitle) {
    commands.push({ changes: { title }, id: task.taskId, type: 'task.update' });
  }
  if (value.start !== task.start) {
    commands.push({ id: task.taskId, start: value.start, type: 'task.move' });
  }
  if (value.end !== task.end) {
    // Resize follows move so the submitted end wins even when the start also changed.
    commands.push({ edge: 'end', id: task.taskId, time: value.end, type: 'task.resize' });
  }
  if (commands.length === 0) {
    return undefined;
  }
  return commands.length === 1 ? commands[0] : { commands, type: 'transaction' };
}

export function taskPropertiesValue(
  task: TaskBarPrimitive,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): GanttItemPropertiesValue | undefined {
  const record = document.tasks.find((candidate) => candidate.id === task.taskId);
  if (record === undefined) {
    return undefined;
  }
  const schedule =
    record.schedule?.mode === 'instant' && task.segmentId === undefined && record.kind !== 'summary'
      ? {
          end: record.kind === 'milestone' ? record.schedule.start : record.schedule.end,
          start: record.schedule.start,
        }
      : {};
  return Object.freeze({
    ...(record.appearance === undefined ? {} : { appearance: record.appearance }),
    ...(record.description === undefined ? {} : { description: record.description }),
    ...schedule,
    kind: 'task',
    ...(task.laneId === undefined ? {} : { laneId: task.laneId }),
    ...(record.order === undefined ? {} : { order: record.order }),
    ...(record.parentId === undefined ? {} : { parentId: record.parentId }),
    ...(task.placementId === undefined ? {} : { placementId: task.placementId }),
    ...(record.kind !== 'task' || record.progress === undefined
      ? {}
      : { progress: record.progress }),
    taskId: record.id,
    taskKind: record.kind,
    title: record.title,
  });
}

export function lanePropertiesValue(
  lane: LaneRowPrimitive,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): GanttItemPropertiesValue | undefined {
  if (lane.laneId === undefined) {
    return undefined;
  }
  const record = document.lanes.find((candidate) => candidate.id === lane.laneId);
  return record === undefined
    ? undefined
    : Object.freeze({
        ...(record.appearance === undefined ? {} : { appearance: record.appearance }),
        kind: 'lane',
        laneId: record.id,
        title: record.title,
      });
}

export function appearanceVariant(value: GanttItemPropertiesValue): string | undefined {
  return value.appearance?.variant;
}

export function validateItemPropertiesValue(
  initial: GanttItemPropertiesValue,
  value: GanttItemPropertiesValue,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): string | undefined {
  if (
    initial.kind !== value.kind ||
    (initial.kind === 'task' && value.kind === 'task' && initial.taskId !== value.taskId) ||
    (initial.kind === 'lane' && value.kind === 'lane' && initial.laneId !== value.laneId)
  ) {
    return 'The submitted properties target does not match the inspected item.';
  }
  if (value.title.trim() === '') {
    return 'Title is required.';
  }
  if (value.appearance !== undefined && value.appearance.variant.trim() === '') {
    return 'Appearance must use a non-empty semantic variant.';
  }
  if (value.kind === 'lane') {
    return undefined;
  }
  if (
    (value.start === undefined) !== (value.end === undefined) ||
    (value.start !== undefined &&
      value.end !== undefined &&
      (!Number.isFinite(value.start) ||
        !Number.isFinite(value.end) ||
        (value.taskKind === 'milestone' ? value.end !== value.start : value.end <= value.start)))
  ) {
    return 'End must be later than start.';
  }
  if (
    value.progress !== undefined &&
    (!Number.isFinite(value.progress) || value.progress < 0 || value.progress > 1)
  ) {
    return 'Progress must be between 0% and 100%.';
  }
  if (value.order !== undefined && !Number.isFinite(value.order)) {
    return 'Order must be a finite number.';
  }
  if (
    value.parentId !== undefined &&
    !document.tasks.some(
      (candidate) => candidate.id === value.parentId && candidate.kind === 'summary',
    )
  ) {
    return 'Parent must be an existing summary task.';
  }
  if (value.parentId === value.taskId) {
    return 'A task cannot be its own parent.';
  }
  if (
    value.laneId !== undefined &&
    !document.lanes.some((candidate) => candidate.id === value.laneId)
  ) {
    return 'The selected lane no longer exists.';
  }
  return undefined;
}

export function itemPropertiesCommand(
  initial: GanttItemPropertiesValue,
  value: GanttItemPropertiesValue,
  document: GanttReactRuntimeSnapshot['selector']['document'],
): GanttCommand | undefined {
  if (initial.kind === 'lane' && value.kind === 'lane') {
    const record = document.lanes.find((candidate) => candidate.id === initial.laneId);
    if (record === undefined) {
      return undefined;
    }
    const changes: {
      appearance?: { readonly variant: string } | null;
      title?: string;
    } = {};
    const title = value.title.trim();
    if (title !== record.title) {
      changes.title = title;
    }
    if (appearanceVariant(value) !== record.appearance?.variant) {
      changes.appearance = value.appearance ?? null;
    }
    return Object.keys(changes).length === 0
      ? undefined
      : { changes, id: record.id, type: 'lane.update' };
  }
  if (initial.kind !== 'task' || value.kind !== 'task') {
    return undefined;
  }
  const record = document.tasks.find((candidate) => candidate.id === initial.taskId);
  if (record === undefined) {
    return undefined;
  }
  const commands: GanttCommand[] = [];
  const changes: {
    appearance?: { readonly variant: string } | null;
    description?: string | null;
    kind?: 'milestone' | 'summary' | 'task';
    order?: number | null;
    parentId?: string | null;
    progress?: number | null;
    schedule?: { readonly end: number; readonly mode: 'instant'; readonly start: number };
    title?: string;
  } = {};
  const title = value.title.trim();
  if (title !== record.title) {
    changes.title = title;
  }
  if (value.description !== record.description) {
    changes.description = value.description ?? null;
  }
  if (appearanceVariant(value) !== record.appearance?.variant) {
    changes.appearance = value.appearance ?? null;
  }
  if (value.taskKind !== record.kind) {
    changes.kind = value.taskKind;
  }
  if (value.order !== record.order) {
    changes.order = value.order ?? null;
  }
  if (value.parentId !== record.parentId) {
    changes.parentId = value.parentId ?? null;
  }
  if (value.taskKind === 'task' && value.progress !== record.progress) {
    changes.progress = value.progress ?? null;
  }
  if (
    record.schedule?.mode === 'instant' &&
    value.taskKind !== 'summary' &&
    value.start !== undefined &&
    value.end !== undefined &&
    (value.start !== record.schedule.start || value.end !== record.schedule.end)
  ) {
    changes.schedule = {
      end: value.taskKind === 'milestone' ? value.start : value.end,
      mode: 'instant',
      start: value.start,
    };
  }
  if (Object.keys(changes).length > 0) {
    commands.push({ changes, id: record.id, type: 'task.update' });
  }
  if (
    initial.placementId !== undefined &&
    initial.laneId !== undefined &&
    value.laneId !== undefined &&
    value.laneId !== initial.laneId
  ) {
    const placement = document.placements.find(
      (candidate) =>
        candidate.id === initial.placementId &&
        candidate.taskId === initial.taskId &&
        candidate.laneId === initial.laneId,
    );
    if (placement !== undefined) {
      commands.push({
        id: placement.id,
        laneId: value.laneId,
        type: 'placement.move',
      });
    }
  }
  if (commands.length === 0) {
    return undefined;
  }
  return commands.length === 1 ? commands[0] : { commands, type: 'transaction' };
}

export function elapsedDuration(value: GanttItemPropertiesValue): string | undefined {
  if (value.kind !== 'task' || value.start === undefined || value.end === undefined) {
    return undefined;
  }
  const minutes = Math.round((value.end - value.start) / 60_000);
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const remainder = minutes % 60;
  return (
    [
      ...(days === 0 ? [] : [`${days}d`]),
      ...(hours === 0 ? [] : [`${hours}h`]),
      ...(remainder === 0 ? [] : [`${remainder}m`]),
    ].join(' ') || '0m'
  );
}

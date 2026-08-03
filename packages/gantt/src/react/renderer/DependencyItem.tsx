import { memo, type ReactElement } from 'react';

import type { GanttLocalization } from '../../localization/format';
import type { DependencyPathPrimitive } from '../../render/primitives';
import { useGanttSelector } from '../context';
import type { GanttDependencySummary, GanttProps } from '../types';
import { idleClassState, joinClasses, percent, resolveClassName } from './presentation';

function dependencyPathData(
  points: DependencyPathPrimitive['points'],
  timelineWidth: number,
): string {
  const first = points[0];
  if (first === undefined) return '';
  const commands = [`M ${first.x * timelineWidth} ${first.y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (Math.abs(previous.y - current.y) < 1e-9) {
      commands.push(`H ${current.x * timelineWidth}`);
    } else if (Math.abs(previous.x - current.x) < 1e-9) {
      commands.push(`V ${current.y}`);
    } else {
      commands.push(`L ${current.x * timelineWidth} ${current.y}`);
    }
  }
  return commands.join(' ');
}

function dependencyStateEqual(
  previous: readonly [boolean, boolean, boolean],
  next: readonly [boolean, boolean, boolean],
): boolean {
  return previous.every((value, index) => value === next[index]);
}

export const DependencyItem = memo(function DependencyItem({
  classNames,
  dependency,
  disabled,
  localization,
  markerId,
  onActivate,
  onOpenProperties,
  summary,
  timelineHeight,
  timelineWidth,
}: {
  readonly classNames?: GanttProps['classNames'];
  readonly dependency: DependencyPathPrimitive;
  readonly disabled: boolean;
  readonly localization: GanttLocalization;
  readonly markerId: string;
  readonly onActivate: (dependencyId: string) => void;
  readonly onOpenProperties: (dependencyId: string) => void;
  readonly summary: GanttDependencySummary | undefined;
  readonly timelineHeight: number;
  readonly timelineWidth: number;
}): ReactElement {
  const [selected, focused, pending] = useGanttSelector((snapshot) => {
    const dependencyId = dependency.dependencyId;
    return [
      snapshot.session.selection.some(
        (candidate) => candidate.kind === 'dependency' && candidate.dependencyId === dependencyId,
      ),
      snapshot.session.focused?.kind === 'dependency' &&
        snapshot.session.focused.dependencyId === dependencyId,
      snapshot.interaction.status === 'pending' &&
        snapshot.interaction.target?.kind === 'dependency' &&
        snapshot.interaction.target.dependencyId === dependencyId,
    ] as const;
  }, dependencyStateEqual);
  const target = summary?.target ?? {
    dependencyId: dependency.dependencyId,
    kind: 'dependency' as const,
  };
  const state = Object.freeze({
    ...idleClassState(disabled, target),
    focused,
    invalid: dependency.status === 'invalid',
    pending,
    selected,
  });
  const pathData = dependencyPathData(dependency.points, timelineWidth);
  return (
    <g
      aria-disabled={disabled || undefined}
      aria-keyshortcuts="Enter Delete Backspace Space"
      aria-label={
        summary === undefined
          ? `Dependency ${dependency.dependencyId}`
          : `${summary.fromTitle} to ${summary.toTitle}, ${localization.message(
              `dependency.type.${summary.dependency.type}`,
              undefined,
              summary.dependency.type.replaceAll('-', ' '),
            )}`
      }
      aria-pressed={selected}
      className="gt-gantt__dependency"
      data-clipped-end={dependency.clippedEnd || undefined}
      data-clipped-start={dependency.clippedStart || undefined}
      data-dependency-id={dependency.dependencyId}
      data-from-task-id={dependency.fromTaskId}
      data-from-view-key={dependency.fromViewKey}
      data-gt-part="dependency"
      data-hidden-endpoint={dependency.hiddenEndpoint || undefined}
      data-focused={focused || undefined}
      data-pending={pending || undefined}
      data-selected={selected || undefined}
      data-status={dependency.status}
      data-to-task-id={dependency.toTaskId}
      data-to-view-key={dependency.toViewKey}
      data-type={dependency.type}
      onClick={() => onActivate(dependency.dependencyId)}
      onDoubleClick={() => onOpenProperties(dependency.dependencyId)}
      role="button"
      tabIndex={focused ? 0 : -1}
    >
      <path
        aria-hidden="true"
        className={joinClasses(
          'gt-gantt__dependency-path',
          resolveClassName(classNames?.dependencyPath, state),
        )}
        d={pathData}
        markerEnd={dependency.clippedEnd ? undefined : `url(#${markerId})`}
      />
      <path
        aria-hidden="true"
        className="gt-gantt__dependency-hit"
        d={pathData}
        data-gt-part="dependency-hit-target"
      />
      {dependency.clippedStart ? (
        <circle
          aria-hidden="true"
          className="gt-gantt__dependency-continuation"
          cx={percent(dependency.points[0]!.x)}
          cy={percent(dependency.points[0]!.y / timelineHeight)}
          data-edge="start"
          data-gt-part="dependency-continuation"
          r="3"
        />
      ) : null}
      {dependency.clippedEnd ? (
        <circle
          aria-hidden="true"
          className="gt-gantt__dependency-continuation"
          cx={percent(dependency.points.at(-1)!.x)}
          cy={percent(dependency.points.at(-1)!.y / timelineHeight)}
          data-edge="end"
          data-gt-part="dependency-continuation"
          r="3"
        />
      ) : null}
    </g>
  );
});

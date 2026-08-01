import type { ReactElement } from 'react';

import type { TaskBarPrimitive } from '../../render/primitives';
import type { GanttInteractionState } from '../types';
import { percent } from './presentation';

export function DependencyPreview({
  direction,
  markerId,
  source,
  target,
  timelineHeight,
}: {
  readonly direction: 'ltr' | 'rtl';
  readonly markerId: string;
  readonly source: TaskBarPrimitive | undefined;
  readonly target: TaskBarPrimitive | undefined;
  readonly timelineHeight: number;
}): ReactElement | null {
  if (source === undefined) return null;
  return (
    <line
      aria-hidden="true"
      className="gt-gantt__dependency-preview"
      data-gt-part="dependency-preview"
      markerEnd={`url(#${markerId})`}
      x1={percent(
        source.presentation.geometry.kind === 'milestone'
          ? source.presentation.geometry.centerX
          : direction === 'rtl'
            ? source.x
            : source.x + source.width,
      )}
      x2={percent(
        target === undefined
          ? direction === 'rtl'
            ? Math.max(0, source.x - 0.06)
            : Math.min(1, source.x + source.width + 0.06)
          : target.presentation.geometry.kind === 'milestone'
            ? target.presentation.geometry.centerX
            : direction === 'rtl'
              ? target.x + target.width
              : target.x,
      )}
      y1={percent((source.y + source.height / 2) / timelineHeight)}
      y2={percent(((target ?? source).y + (target ?? source).height / 2) / timelineHeight)}
    />
  );
}

export function InteractionPreview({
  interaction,
}: {
  readonly interaction: GanttInteractionState;
}): ReactElement | null {
  return 'preview' in interaction &&
    interaction.preview !== undefined &&
    interaction.preview.kind !== 'dependency' ? (
    <div
      aria-hidden="true"
      className="gt-gantt__interaction-preview"
      data-gt-part="interaction-preview"
      data-preview-kind={interaction.preview.kind}
      data-preview-progress={interaction.preview.progress}
      style={{
        height: interaction.preview.height,
        left: interaction.preview.x,
        top: interaction.preview.y,
        width: interaction.preview.width,
      }}
    />
  ) : null;
}

export function ProgressPreviewValue({
  interaction,
}: {
  readonly interaction: GanttInteractionState;
}): ReactElement | null {
  return 'preview' in interaction &&
    interaction.status === 'progressing' &&
    interaction.preview.kind === 'progress' &&
    interaction.preview.progress !== undefined ? (
    <span
      aria-hidden="true"
      data-gt-part="progress-preview-value"
      style={{
        left: `clamp(20px, calc(var(--gt-lane-column-width) + ${interaction.preview.x + interaction.preview.width}px), calc(100% - 20px))`,
        top: interaction.preview.y + interaction.preview.height / 2,
      }}
    >
      {Math.round(interaction.preview.progress * 100)}%
    </span>
  ) : null;
}

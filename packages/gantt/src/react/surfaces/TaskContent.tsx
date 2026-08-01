import type { ReactElement } from 'react';

import type { GanttTaskContentProps } from '../types';

export function DefaultTaskContent({ task }: GanttTaskContentProps): ReactElement {
  return <span>{task.title}</span>;
}

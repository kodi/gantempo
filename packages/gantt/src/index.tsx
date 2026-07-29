import type { ReactElement, ReactNode } from 'react';

export interface GanttProps {
  children?: ReactNode;
  className?: string;
  label?: string;
}

/**
 * The public React entry point for Gantempo.
 *
 * Rendering and scheduling capabilities will be composed behind this boundary as
 * their packages are introduced.
 */
export function Gantt({ children, className, label = 'Gantt chart' }: GanttProps): ReactElement {
  return (
    <div aria-label={label} className={className} data-gantempo="" role="region">
      {children}
    </div>
  );
}

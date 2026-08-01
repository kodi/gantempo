import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function OverlayLayer({
  children,
  host,
}: {
  readonly children: ReactNode;
  readonly host: HTMLDivElement | null;
}): ReactElement | null {
  return host === null ? null : createPortal(children, host);
}

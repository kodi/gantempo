import type { ReactElement } from 'react';

import { InteractivePage } from './pages/InteractivePage';
import { MainPage } from './pages/MainPage';
import { MatrixPage } from './pages/MatrixPage';
import { UncontrolledPage } from './pages/UncontrolledPage';

interface PlaygroundLink {
  href: string;
  label: string;
}

const links: readonly PlaygroundLink[] = [
  { href: '/', label: 'Main' },
  { href: '/matrix', label: 'Matrix' },
  { href: '/interactive', label: 'Interactive' },
  { href: '/uncontrolled', label: 'Runtime-owned' },
];

function PlaygroundHeader({ pathname }: { pathname: string }): ReactElement {
  return (
    <header className="playground-header">
      <a aria-label="Gantempo playground home" className="brand" href="/">
        <span aria-hidden="true" className="brand__mark">
          G
        </span>
        <span>
          <strong>Gantempo</strong>
          <small>Playground</small>
        </span>
      </a>

      <nav aria-label="Playground pages" className="playground-nav">
        {links.map((link) => {
          const isCurrent = pathname === link.href;

          return (
            <a
              aria-current={isCurrent ? 'page' : undefined}
              className="playground-nav__link"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}

export function Playground(): ReactElement {
  const pathname = window.location.pathname;
  const page =
    pathname === '/matrix' ? (
      <MatrixPage />
    ) : pathname === '/interactive' ? (
      <InteractivePage />
    ) : pathname === '/uncontrolled' ? (
      <UncontrolledPage />
    ) : (
      <MainPage />
    );

  return (
    <div className="playground-shell">
      <PlaygroundHeader pathname={pathname} />
      <main>{page}</main>
    </div>
  );
}

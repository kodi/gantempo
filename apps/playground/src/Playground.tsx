import type { ReactElement } from 'react';

import { InteractiveCustomPage } from './pages/InteractiveCustomPage';
import { InteractivePage } from './pages/InteractivePage';
import { MainPage } from './pages/MainPage';
import { MatrixPage } from './pages/MatrixPage';
import { NavigationPage } from './pages/NavigationPage';
import { ProjectPage } from './pages/ProjectPage';
import { UncontrolledPage } from './pages/UncontrolledPage';

interface PlaygroundLink {
  href: string;
  label: string;
}

const links: readonly PlaygroundLink[] = [
  { href: '/', label: 'Main' },
  { href: '/matrix', label: 'Matrix' },
  { href: '/interactive', label: 'Interactive' },
  { href: '/interactive-custom', label: 'Interactive Custom' },
  { href: '/uncontrolled', label: 'Runtime-owned' },
  { href: '/navigation', label: 'Navigation' },
  { href: '/project', label: 'Project' },
];

function PlaygroundHeader({ pathname }: { pathname: string }): ReactElement {
  return (
    <header className="playground-header">
      <a aria-label="Gantempo Playground" className="brand" href="/">
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
    ) : pathname === '/interactive-custom' ? (
      <InteractiveCustomPage />
    ) : pathname === '/interactive' ? (
      <InteractivePage />
    ) : pathname === '/uncontrolled' ? (
      <UncontrolledPage />
    ) : pathname === '/navigation' ? (
      <NavigationPage />
    ) : pathname === '/project' ? (
      <ProjectPage search={window.location.search} />
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

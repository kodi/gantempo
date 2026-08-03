import type { ReactElement } from 'react';

import { InteractiveCustomPage } from './pages/InteractiveCustomPage';
import { InteractivePage } from './pages/InteractivePage';
import { MainPage } from './pages/MainPage';
import { MatrixPage } from './pages/MatrixPage';
import { NavigationPage } from './pages/NavigationPage';
import { ProjectPage } from './pages/ProjectPage';
import { SimpleProjectExamplePage } from './pages/SimpleProjectExamplePage';
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
  { href: '/examples/simple-project', label: 'API Example' },
];

function PlaygroundHeader({ pathname }: { pathname: string }): ReactElement {
  return (
    <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-ink/10 bg-canvas/[92%] px-[clamp(20px,4vw,64px)] backdrop-blur-[16px] max-[561px]:gap-2 max-[561px]:px-4">
      <a
        aria-label="Gantempo Playground"
        className="inline-flex items-center gap-[11px] text-inherit no-underline"
        href="/"
      >
        <span
          aria-hidden="true"
          className="grid size-[34px] place-items-center rounded-[10px] bg-brand font-extrabold text-[#f9faf8]"
        >
          G
        </span>
        <span className="grid gap-px max-[561px]:hidden">
          <strong className="text-sm tracking-[0.01em]">Gantempo</strong>
          <small className="text-[11px] text-muted">Playground</small>
        </span>
      </a>

      <nav
        aria-label="Playground pages"
        className="flex gap-[5px] rounded-xl border border-ink/10 bg-white/50 p-1 max-[561px]:min-w-0 max-[561px]:overflow-x-auto"
      >
        {links.map((link) => {
          const isCurrent = pathname === link.href;

          return (
            <a
              aria-current={isCurrent ? 'page' : undefined}
              className="rounded-lg px-[13px] py-[7px] text-[13px] font-semibold text-[#687181] no-underline aria-[current=page]:bg-white aria-[current=page]:text-[#18352f] aria-[current=page]:shadow-[0_1px_3px_rgb(36_48_68/9%)] max-[561px]:shrink-0 max-[561px]:px-[9px] max-[561px]:whitespace-nowrap"
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
    ) : pathname === '/examples/simple-project' ? (
      <SimpleProjectExamplePage />
    ) : (
      <MainPage />
    );

  return (
    <div className="min-h-screen [&_a]:font-[inherit] [&_button]:cursor-pointer [&_button]:font-[inherit]">
      <PlaygroundHeader pathname={pathname} />
      <main>{page}</main>
    </div>
  );
}

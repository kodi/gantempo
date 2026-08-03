import type { ReactElement, ReactNode } from 'react';

import { HighlightedCode, type SourceLanguage } from '../HighlightedCode';
import { SimpleProjectExample } from '../examples/SimpleProjectExample';
import componentSource from '../examples/SimpleProjectExample.tsx?raw';
import adapterSource from '../examples/simple-project-api.ts?raw';
import mainSource from '../examples/simple-project-main.tsx?raw';
import viteConfigSource from '../examples/simple-project-vite.config.txt?raw';
import stylesSource from '../examples/styles.css?raw';

const INSTALL_SOURCE = `pnpm add @gantempo/gantt @tanstack/react-query
pnpm add -D tailwindcss @tailwindcss/vite`;

function SourcePanel({
  children,
  filename,
  language,
  open = false,
}: {
  readonly children: string;
  readonly filename: string;
  readonly language: SourceLanguage;
  readonly open?: boolean;
}): ReactElement {
  return (
    <details
      className="mt-4 overflow-hidden rounded-[13px] border border-ink/15 bg-[#17211f]"
      open={open}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 bg-[#202c29] px-3.5 font-mono text-[10px] text-[#dfe9e4] focus-visible:-outline-offset-3 focus-visible:outline-3 focus-visible:outline-[#7fd4b9] [&::-webkit-details-marker]:hidden">
        <span>{filename}</span>
        <span className="text-[#96aaa2]">View complete file</span>
      </summary>
      <pre className="m-0 overflow-visible p-[18px] font-mono text-[11px] leading-[1.65] whitespace-pre-wrap text-[#e8efec] [overflow-wrap:anywhere] [tab-size:2] max-[561px]:p-3.5 max-[561px]:text-[10px]">
        <HighlightedCode language={language} source={children} />
      </pre>
    </details>
  );
}

function Step({
  children,
  number,
  title,
}: {
  readonly children: ReactNode;
  readonly number: number;
  readonly title: string;
}): ReactElement {
  return (
    <li className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-5 pb-[42px] max-[561px]:grid-cols-[34px_minmax(0,1fr)] max-[561px]:gap-3">
      {number < 3 ? (
        <span
          aria-hidden="true"
          className="absolute top-[42px] bottom-0 left-[21px] w-px bg-ink/15 max-[561px]:top-[34px] max-[561px]:left-4"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="relative z-1 grid size-11 place-items-center rounded-[13px] border border-brand/25 bg-[#f7faf7] text-[13px] font-extrabold text-brand shadow-[0_4px_12px_rgb(36_48_68/6%)] max-[561px]:size-[34px] max-[561px]:rounded-[10px]"
      >
        {number}
      </div>
      <div className="min-w-0 pt-[5px]">
        <h2 className="m-0 text-[19px] font-bold tracking-[-0.02em] text-[#263142]">{title}</h2>
        {children}
      </div>
    </li>
  );
}

export function SimpleProjectExamplePage(): ReactElement {
  return (
    <div className="mx-auto w-full max-w-[1480px] px-[clamp(20px,4vw,64px)] pt-[clamp(34px,5vw,70px)] pb-20 max-[561px]:px-3.5">
      <header className="mb-[34px] flex items-end justify-between gap-8 max-[800px]:items-start max-[800px]:flex-col">
        <div>
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
            Simple · TanStack Query · Load + Save
          </p>
          <h1 className="mt-[5px] mb-0 text-[clamp(28px,3.3vw,46px)] font-bold tracking-[-0.04em] text-ink-strong">
            Your first working Gantt chart
          </h1>
          <p className="mt-2.5 mb-0 max-w-[650px] text-[15px] leading-[1.6] text-muted">
            Add a QueryClient, give Gantempo one load function and one Save function, then render
            the chart. TanStack Query handles the server state while Gantempo protects edits.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-[#69717e] max-[561px]:flex-wrap">
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            ~5 minute integration
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            5 ordinary tasks
          </span>
          <span className="rounded-lg border border-ink/10 bg-white/45 px-2.5 py-[7px]">
            2 dependencies
          </span>
        </div>
      </header>

      <ol
        aria-label="Integration steps"
        className="mx-auto grid max-w-[1120px] list-none gap-0 p-0"
      >
        <Step number={1} title="Set up TanStack Query">
          <p className="mt-[9px] mb-0 text-[13px] leading-[1.65] text-[#5d6876]">
            Add Gantempo and TanStack Query, enable Tailwind in Vite, and render the chart inside a
            QueryClientProvider. These are complete standalone files—there is no playground-specific
            component.
          </p>
          <SourcePanel filename="terminal" language="bash" open>
            {INSTALL_SOURCE}
          </SourcePanel>
          <SourcePanel filename="vite.config.ts" language="typescript" open>
            {viteConfigSource}
          </SourcePanel>
          <SourcePanel filename="styles.css" language="css" open>
            {stylesSource}
          </SourcePanel>
          <SourcePanel filename="main.tsx" language="tsx" open>
            {mainSource}
          </SourcePanel>
        </Step>

        <Step number={2} title="Load and save data">
          <p className="mt-[9px] mb-0 text-[13px] leading-[1.65] text-[#5d6876]">
            These are the only API functions the example needs: GET the project and PUT the edited
            project back. Replace this URL with your own endpoint.
          </p>
          <SourcePanel filename="simple-project-api.ts" language="typescript" open>
            {adapterSource}
          </SourcePanel>
        </Step>

        <Step number={3} title="Show the Gantt chart">
          <p className="mt-[9px] mb-0 text-[13px] leading-[1.65] text-[#5d6876]">
            The Gantempo adapter uses TanStack Query's familiar queryFn and mutationFn. Its native
            query and mutation state remain available while Gantempo owns the editable draft.
          </p>
          <SourcePanel filename="SimpleProjectExample.tsx" language="tsx" open>
            {componentSource}
          </SourcePanel>
        </Step>
      </ol>

      <section
        aria-labelledby="working-example-title"
        className="mt-6 border-t border-ink/10 pt-[52px]"
      >
        <div className="mb-[22px] max-w-[720px]">
          <div>
            <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-brand-light uppercase">
              Final working example
            </p>
            <h2
              className="mt-[5px] mb-0 text-[clamp(21px,2.4vw,30px)] font-bold tracking-[-0.03em] text-[#1c2b3a]"
              id="working-example-title"
            >
              A small project plan that just works
            </h2>
            <p className="mt-[9px] mb-0 text-[13px] leading-[1.65] text-[#5d6876]">
              Five normal tasks, progress, and two dependency links. Open a task or adjust its
              progress, then save the controlled document.
            </p>
          </div>
        </div>
        <SimpleProjectExample />
      </section>
    </div>
  );
}

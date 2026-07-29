# Gantempo

React and TypeScript primitives for Gantt charts, resource planning, and scheduling.

Applications using the packaged chart should load its default structural and visual
styles once:

```ts
import '@gantempo/gantt/styles.css';
```

## Toolchain

- [Vite+](https://viteplus.dev/) for formatting, linting, type checking, and tests
- [tsdown](https://tsdown.dev/) through `vp pack` for library bundles
- [mise](https://mise.jdx.dev/) for the Node.js runtime
- pnpm pinned through the workspace `packageManager` field
- React 19 for development, with React 18 and 19 supported as peer versions
- TypeScript 7

## Setup

Install the Vite+ `vp` CLI once, then bootstrap the pinned environment and dependencies:

```sh
mise install
vp install
```

Run the development checks:

```sh
vp check
vp test run
vp pack
```

The same commands are available as mise tasks:

```sh
mise run ci
```

## Local development

Start the React playground:

```sh
pnpm dev
```

The playground exercises the first real read-only rendering pipeline: canonical task,
lane, and placement records pass through deterministic time-scale and scene primitives
before the DOM/SVG renderer draws them. It has two pages:

- `/` keeps the main development scenario at a large, useful size;
- `/matrix` shows a small set of content, density, and theme variants together.

The equivalent mise command is `mise run dev`. To verify the standalone playground
build, run `pnpm build:playground`.

See:

- [Architecture](docs/ARCHITECTURE.md) for system and package boundaries.
- [UI and theming](docs/UI_THEMING.md) for the design-system and Tailwind strategy.

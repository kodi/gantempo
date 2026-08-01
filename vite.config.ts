import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['docs/**'],
    semi: true,
    singleQuote: true,
  },
  lint: {
    ignorePatterns: ['**/dist/**', '**/coverage/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
  test: {
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
  },
  pack: {
    clean: true,
    deps: {
      neverBundle: true,
    },
    dts: true,
    entry: ['packages/gantt/src/index.tsx'],
    format: ['esm'],
    outDir: 'packages/gantt/dist',
    platform: 'neutral',
    root: 'packages/gantt/src',
    sourcemap: true,
    target: 'es2022',
    unbundle: true,
  },
});

import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@gantempo\/gantt\/react-query$/,
        replacement: new URL('./packages/gantt/src/react-query.ts', import.meta.url).pathname,
      },
      {
        find: /^@gantempo\/gantt\/styles\.css$/,
        replacement: new URL('./packages/gantt/src/styles.css', import.meta.url).pathname,
      },
      {
        find: /^@gantempo\/gantt$/,
        replacement: new URL('./packages/gantt/src/index.tsx', import.meta.url).pathname,
      },
    ],
  },
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
    entry: ['packages/gantt/src/index.tsx', 'packages/gantt/src/react-query.ts'],
    format: ['esm'],
    outDir: 'packages/gantt/dist',
    platform: 'neutral',
    root: 'packages/gantt/src',
    sourcemap: true,
    target: 'es2022',
    unbundle: true,
  },
});

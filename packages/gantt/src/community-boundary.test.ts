import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:bench|test)\./.test(entry.name) ? [path] : [];
  });
}

describe('M5 Community source boundary', () => {
  it('keeps project kernels React-, DOM-, browser-, clock-, and host-locale-independent', () => {
    const pureDirectories = ['hierarchy', 'interaction', 'layout', 'scheduler', 'time', 'view'];
    const violations = pureDirectories.flatMap((directory) =>
      sourceFiles(join(SOURCE_ROOT, directory)).flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        return [
          /(?:from|import)\s*['"]react(?:-dom)?/.test(source) ? 'React import' : undefined,
          /\b(?:navigator|requestAnimationFrame|ResizeObserver|window)\s*[.[]|\bglobalThis\.document\b|\bdocument\.(?:body|createElement|documentElement|querySelector)/.test(
            source,
          )
            ? 'browser global'
            : undefined,
          /\bDate\.now\s*\(/.test(source) ? 'wall clock' : undefined,
          /\.toLocale(?:Date|String|TimeString)\s*\(/.test(source) ? 'host locale' : undefined,
        ].flatMap((problem) =>
          problem === undefined ? [] : [`${relative(SOURCE_ROOT, path)}: ${problem}`],
        );
      }),
    );

    expect(violations).toEqual([]);
  });

  it('contains no Pro import, licensing gate, working calendar, auto-scheduling, or leveling path', () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return [
        /@gantempo\/gantt-pro|packages\/gantt-pro/.test(source) ? 'Pro import' : undefined,
        /\blicen[cs](?:e|ing)\b/i.test(source) ? 'licensing gate' : undefined,
        /working[- ]calendar|holiday calendar|work shift/i.test(source)
          ? 'working calendar'
          : undefined,
        /auto(?:matic)?[- ]schedul/i.test(source) ? 'automatic scheduling' : undefined,
        /critical[- ]path|resource[- ]level/i.test(source) ? 'Pro scheduling result' : undefined,
      ].flatMap((problem) =>
        problem === undefined ? [] : [`${relative(SOURCE_ROOT, path)}: ${problem}`],
      );
    });

    expect(violations).toEqual([]);
  });

  it('keeps private M5 engines behind the root facade', () => {
    const facade = readFileSync(join(SOURCE_ROOT, 'index.tsx'), 'utf8');
    for (const privateName of [
      'analyzeDependencyGraph',
      'buildTaskHierarchyIndexes',
      'createChartScenePipeline',
      'createGanttLocalization',
      'routeDependency',
      'zoomRangeToLevel',
    ]) {
      expect(facade).not.toContain(privateName);
    }
    expect(facade).toContain('GanttDirection');
    expect(facade).toContain('GanttFormatters');
    expect(facade).toContain('GanttMessageKey');
    expect(facade).toContain('GanttTimeScaleDefinition');
  });
});

import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { createHighlighterCoreSync } from 'shiki/core';
import bash from 'shiki/dist/langs/bash.mjs';
import css from 'shiki/dist/langs/css.mjs';
import tsx from 'shiki/dist/langs/tsx.mjs';
import typescript from 'shiki/dist/langs/typescript.mjs';
import githubDarkDimmed from 'shiki/dist/themes/github-dark-dimmed.mjs';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [bash, css, tsx, typescript],
  themes: [githubDarkDimmed],
});

export type SourceLanguage = 'bash' | 'css' | 'tsx' | 'typescript';

export function HighlightedCode({
  language,
  source,
}: {
  readonly language: SourceLanguage;
  readonly source: string;
}): ReactElement {
  const highlightedSource = useMemo(
    () =>
      highlighter.codeToTokens(source.trim(), {
        lang: language,
        theme: 'github-dark-dimmed',
      }),
    [language, source],
  );

  return (
    <code className={`shiki language-${language}`} style={{ color: highlightedSource.fg }}>
      {highlightedSource.tokens.map((line, lineIndex) => (
        <span key={lineIndex} className="line">
          {line.map((token) => {
            const fontStyle = token.fontStyle ?? 0;
            const style: CSSProperties = {
              backgroundColor: token.bgColor,
              color: token.color,
              fontStyle: fontStyle & 1 ? 'italic' : undefined,
              fontWeight: fontStyle & 2 ? 'bold' : undefined,
              textDecoration: fontStyle & 4 ? 'underline' : undefined,
            };

            return (
              <span data-shiki-token="" key={token.offset} style={style}>
                {token.content}
              </span>
            );
          })}
          {lineIndex < highlightedSource.tokens.length - 1 ? '\n' : null}
        </span>
      ))}
    </code>
  );
}

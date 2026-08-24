/**
 * The cubby design-token vocabulary, as CSS text.
 *
 * Single source of truth: foundation/build.mjs writes this out to
 * pb_public/css/tokens.css (which cubby's own apps <link> statically), and
 * core.js embeds the same string so ensureTokens() can inject it on a foreign
 * host that has no such link. Two hand-maintained copies would drift.
 *
 * Three blocks, deliberately:
 *   :root                                          the complete light palette
 *   @media dark { :root:not([data-theme="light"]) } system dark, unless opted out
 *   :root[data-theme="dark"]                       explicit dark, beats the media query
 *
 * The :not() guard is what makes an explicit data-theme="light" survive a dark
 * OS setting. Never give a token its only definition inside a media or
 * [data-theme] block: a token defined only in the dark block is undefined in
 * light mode.
 */

/** The dark palette, emitted at two nesting depths. */
const dark = (pad) =>
  [
    '--bg: #16130f;',
    '--fg: #ede9e3;',
    '--muted: #9a938a;',
    '--accent: #e8823f;',
    '--accent-soft: #e8823f26;',
    '--card: #201c17;',
    '--border: #362f27;',
    '--code-bg: #211d18;',
    '--shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 12px rgb(0 0 0 / 0.25);',
    '--shadow-hover: 0 2px 4px rgb(0 0 0 / 0.35), 0 10px 24px rgb(0 0 0 / 0.4);',
  ]
    .map((line) => pad + line)
    .join('\n')

export const TOKENS_CSS = `:root {
  color-scheme: light dark;

  --bg: #faf8f5;
  --fg: #201d1a;
  --muted: #77706a;
  --accent: #c2571b;
  --accent-soft: #c2571b22;
  --card: #ffffff;
  --border: #e7e2da;
  --code-bg: #f2eee8;
  --shadow: 0 1px 2px rgb(32 29 26 / 0.05), 0 4px 12px rgb(32 29 26 / 0.06);
  --shadow-hover: 0 2px 4px rgb(32 29 26 / 0.07), 0 10px 24px rgb(32 29 26 / 0.1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${dark('    ')}
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;

${dark('  ')}
}

:root[data-theme='light'] {
  color-scheme: light;
}
`

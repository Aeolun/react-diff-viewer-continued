/**
 * Syntax-highlighting colour themes for the first-party `highlightLanguage`
 * feature. Colours are applied inline (`style={{ color }}`) on token spans, so
 * they never collide with host-page CSS and require no stylesheet import —
 * matching the way the rest of the diff viewer pins its own presentation.
 *
 * Keys are Prism token types (the class Prism emits after the leading `token`,
 * e.g. `keyword`, `attr-name`). The special `default` key colours text that
 * carries no token type. Unknown token types fall back to `default`.
 */

export type HighlightTheme = Record<string, string>;

/**
 * Light palette, harmonised with the GitHub-light diff theme used by
 * `defaultLightThemeVariables` in `styles.ts`.
 */
export const defaultLightHighlightTheme: HighlightTheme = {
  default: "#24292e",
  comment: "#6a737d",
  prolog: "#6a737d",
  doctype: "#6a737d",
  cdata: "#6a737d",
  punctuation: "#24292e",
  property: "#005cc5",
  tag: "#22863a",
  boolean: "#005cc5",
  number: "#005cc5",
  constant: "#005cc5",
  symbol: "#005cc5",
  deleted: "#b31d28",
  selector: "#6f42c1",
  "attr-name": "#6f42c1",
  string: "#032f62",
  char: "#032f62",
  builtin: "#005cc5",
  inserted: "#22863a",
  operator: "#d73a49",
  entity: "#22863a",
  url: "#032f62",
  "attr-value": "#032f62",
  keyword: "#d73a49",
  atrule: "#d73a49",
  "class-name": "#6f42c1",
  function: "#6f42c1",
  regex: "#032f62",
  important: "#e36209",
  variable: "#e36209",
};

/**
 * Dark palette, tuned to the Dracula-family colours the diff viewer's dark
 * theme already leans on (and what consumers previously paired with
 * `useDarkTheme`).
 */
export const defaultDarkHighlightTheme: HighlightTheme = {
  default: "#f8f8f2",
  comment: "#6272a4",
  prolog: "#6272a4",
  doctype: "#6272a4",
  cdata: "#6272a4",
  punctuation: "#f8f8f2",
  property: "#8be9fd",
  tag: "#ff79c6",
  boolean: "#bd93f9",
  number: "#bd93f9",
  constant: "#bd93f9",
  symbol: "#bd93f9",
  deleted: "#ff5555",
  selector: "#50fa7b",
  "attr-name": "#50fa7b",
  string: "#f1fa8c",
  char: "#f1fa8c",
  builtin: "#8be9fd",
  inserted: "#50fa7b",
  operator: "#f8f8f2",
  entity: "#ff79c6",
  url: "#f1fa8c",
  "attr-value": "#f1fa8c",
  keyword: "#ff79c6",
  atrule: "#ff79c6",
  "class-name": "#8be9fd",
  function: "#50fa7b",
  regex: "#ffb86c",
  important: "#ffb86c",
  variable: "#f8f8f2",
};

/**
 * Resolve the colour for a token whose Prism class list is `classNames`
 * (e.g. `["token", "attr-value"]` or `["token", "punctuation", "attr-equals"]`).
 * Picks the most specific class present in the theme, walking from the most
 * specific class back toward the generic ones; falls back to `default`.
 */
export const resolveTokenColor = (
  theme: HighlightTheme,
  classNames: readonly string[],
): string => {
  for (let i = classNames.length - 1; i >= 0; i--) {
    const name = classNames[i];
    if (name === "token") continue;
    if (theme[name]) return theme[name];
  }
  return theme.default;
};

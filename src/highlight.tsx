/**
 * First-party syntax highlighting for the diff viewer.
 *
 * The problem this solves: highlighting a diff line-by-line loses lexer state
 * across line boundaries (a tag or string that wraps onto the next line is
 * mis-tokenised), and highlighting that runs *after* the diff can't be merged
 * with the word-level change marks on a changed line. So instead we highlight
 * each whole side once — lexer state carries across every line — then express
 * both the highlight tokens and the diff chunks as `[start, end)` intervals over
 * the same line string and intersect them. Every resulting atom carries one
 * colour (from the grammar) and one diff status (default / added / removed).
 *
 * Grammars are loaded lazily per language via `ensureLanguage`, tokenisation is
 * synchronous (`refractor.highlight`), and colours are applied inline
 * (`style={{ color }}`) so they never collide with host-page CSS.
 */

import cn from "classnames";
import type { ReactElement } from "react";
import { refractor } from "refractor/core";

import { type DiffInformation, DiffType } from "./compute-lines.js";
import { type HighlightTheme, resolveTokenColor } from "./highlight-theme.js";

/** A coloured run over a single line, in that line's character coordinate space. */
export interface HighlightToken {
  start: number;
  end: number;
  color: string;
}

/** Contiguous coloured runs for one line (covers the whole line, no gaps). */
export type LineTokens = HighlightToken[];

/**
 * Lazy grammar loaders. A static map (not `import(`refractor/${name}`)`) so a
 * bundler can see every possible chunk and code-split them individually — only
 * the grammar a consumer actually asks for is fetched. Covers refractor's
 * "common" language set.
 */
const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  arduino: () => import("refractor/arduino"),
  bash: () => import("refractor/bash"),
  basic: () => import("refractor/basic"),
  c: () => import("refractor/c"),
  clike: () => import("refractor/clike"),
  cpp: () => import("refractor/cpp"),
  csharp: () => import("refractor/csharp"),
  css: () => import("refractor/css"),
  diff: () => import("refractor/diff"),
  go: () => import("refractor/go"),
  ini: () => import("refractor/ini"),
  java: () => import("refractor/java"),
  javascript: () => import("refractor/javascript"),
  json: () => import("refractor/json"),
  kotlin: () => import("refractor/kotlin"),
  less: () => import("refractor/less"),
  lua: () => import("refractor/lua"),
  makefile: () => import("refractor/makefile"),
  markdown: () => import("refractor/markdown"),
  markup: () => import("refractor/markup"),
  "markup-templating": () => import("refractor/markup-templating"),
  objectivec: () => import("refractor/objectivec"),
  perl: () => import("refractor/perl"),
  php: () => import("refractor/php"),
  python: () => import("refractor/python"),
  r: () => import("refractor/r"),
  regex: () => import("refractor/regex"),
  ruby: () => import("refractor/ruby"),
  rust: () => import("refractor/rust"),
  sass: () => import("refractor/sass"),
  scss: () => import("refractor/scss"),
  sql: () => import("refractor/sql"),
  swift: () => import("refractor/swift"),
  typescript: () => import("refractor/typescript"),
  vbnet: () => import("refractor/vbnet"),
  yaml: () => import("refractor/yaml"),
};

/**
 * Friendly names → canonical loader keys. refractor also registers a grammar's
 * own aliases on `register` (e.g. `markup` enables `html`/`xml`/`svg`, and
 * `typescript` enables `ts`), but we still need to know *which* loader to run
 * when a consumer passes the alias, so map the common ones here.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  html: "markup",
  xml: "markup",
  svg: "markup",
  mathml: "markup",
  ssml: "markup",
  atom: "markup",
  rss: "markup",
  js: "javascript",
  jsx: "javascript",
  node: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  "c++": "cpp",
  objc: "objectivec",
  cs: "csharp",
  dotnet: "csharp",
  kt: "kotlin",
  rs: "rust",
  golang: "go",
};

/** Languages we've tried and failed to load — never retried. */
const negativeCache = new Set<string>();
/** In-flight loads, deduped so concurrent requests share one import. */
const inflight = new Map<string, Promise<void>>();

/** Resolve a requested language name to its canonical (registerable) key. */
const canonicalName = (language: string): string => {
  const requested = language.toLowerCase();
  return LANGUAGE_ALIASES[requested] ?? requested;
};

/**
 * Ensures the grammar for `language` is registered, loading it lazily if needed.
 * Resolves with the canonical language name to hand to `highlightSide`, or
 * `null` if the language is unknown or failed to load (caller falls back to no
 * highlighting). Safe to call repeatedly — registered/negative/in-flight are
 * all cached.
 */
export const ensureLanguage = async (
  language: string,
): Promise<string | null> => {
  const canonical = canonicalName(language);
  if (refractor.registered(canonical)) return canonical;
  if (negativeCache.has(canonical)) return null;

  const loader = LANGUAGE_LOADERS[canonical];
  if (!loader) {
    negativeCache.add(canonical);
    return null;
  }

  let load = inflight.get(canonical);
  if (!load) {
    load = loader()
      .then((mod) => {
        refractor.register(
          mod.default as Parameters<typeof refractor.register>[0],
        );
      })
      .catch(() => {
        negativeCache.add(canonical);
      })
      .finally(() => {
        inflight.delete(canonical);
      });
    inflight.set(canonical, load);
  }
  await load;

  return refractor.registered(canonical) ? canonical : null;
};

/** Minimal structural view of the hast nodes refractor emits. */
interface HastNode {
  type: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

interface Leaf {
  start: number;
  end: number;
  color: string;
  text: string;
}

/**
 * Walks the hast tree in document order, assigning each text leaf a character
 * range and the colour of its innermost token class. Offsets are contiguous, so
 * the leaves losslessly tile the input string.
 */
const collectLeaves = (
  nodes: readonly HastNode[],
  theme: HighlightTheme,
  color: string,
  offset: number,
  out: Leaf[],
): number => {
  let pos = offset;
  for (const node of nodes) {
    if (node.type === "text") {
      const value = node.value ?? "";
      if (value.length > 0) {
        out.push({ start: pos, end: pos + value.length, color, text: value });
        pos += value.length;
      }
    } else if (node.children) {
      const className = node.properties?.className;
      const nextColor = Array.isArray(className)
        ? resolveTokenColor(theme, className as string[])
        : color;
      pos = collectLeaves(node.children, theme, nextColor, pos, out);
    }
  }
  return pos;
};

/** Splits contiguous leaves into per-line token arrays, rebased to line-start. */
const tokensByLine = (
  leaves: readonly Leaf[],
  lineCount: number,
): LineTokens[] => {
  const lines: LineTokens[] = Array.from({ length: lineCount }, () => []);
  let line = 0;
  let lineStart = 0;
  for (const leaf of leaves) {
    let segStart = leaf.start;
    for (let i = 0; i < leaf.text.length; i++) {
      if (leaf.text[i] === "\n") {
        const segEnd = leaf.start + i;
        if (segEnd > segStart && lines[line]) {
          lines[line].push({
            start: segStart - lineStart,
            end: segEnd - lineStart,
            color: leaf.color,
          });
        }
        line += 1;
        lineStart = leaf.start + i + 1;
        segStart = lineStart;
      }
    }
    if (leaf.end > segStart && lines[line]) {
      lines[line].push({
        start: segStart - lineStart,
        end: leaf.end - lineStart,
        color: leaf.color,
      });
    }
  }
  return lines;
};

/**
 * Highlights an entire side and returns per-line token arrays (index `i` is the
 * `i`-th line of `text`). Lexer state carries across lines because the whole
 * string is tokenised in one pass. `language` must be a canonical name from
 * `ensureLanguage`; returns `null` if tokenisation fails.
 */
export const highlightSide = (
  text: string,
  language: string,
  theme: HighlightTheme,
): LineTokens[] | null => {
  if (text.length === 0) return [];
  let root: { children?: HastNode[] };
  try {
    root = refractor.highlight(text, language) as unknown as {
      children?: HastNode[];
    };
  } catch {
    return null;
  }
  const leaves: Leaf[] = [];
  collectLeaves(root.children ?? [], theme, theme.default, 0, leaves);
  const lineCount = text.split("\n").length;
  return tokensByLine(leaves, lineCount);
};

/**
 * Re-bases a line's tokens to a sub-range starting at `from` (used to drop the
 * peeled leading-whitespace indent so body tokens align with the diff body).
 */
export const sliceLineTokens = (
  tokens: LineTokens,
  from: number,
): LineTokens => {
  if (from <= 0) return tokens;
  const out: LineTokens = [];
  for (const token of tokens) {
    if (token.end <= from) continue;
    out.push({
      start: Math.max(token.start, from) - from,
      end: token.end - from,
      color: token.color,
    });
  }
  return out;
};

interface MergeStyles {
  wordDiff: string;
  wordAdded: string;
  wordRemoved: string;
}

interface MergeOptions {
  styles: MergeStyles;
  showHighlight: boolean;
}

const renderAtom = (
  text: string,
  color: string | undefined,
  type: DiffType,
  { styles, showHighlight }: MergeOptions,
  key: number,
): ReactElement => {
  const style = color ? { color } : undefined;
  if (type === DiffType.ADDED) {
    return (
      <ins
        key={key}
        className={cn(styles.wordDiff, { [styles.wordAdded]: showHighlight })}
        style={style}
      >
        {text}
      </ins>
    );
  }
  if (type === DiffType.REMOVED) {
    return (
      <del
        key={key}
        className={cn(styles.wordDiff, { [styles.wordRemoved]: showHighlight })}
        style={style}
      >
        {text}
      </del>
    );
  }
  return (
    <span key={key} className={styles.wordDiff} style={style}>
      {text}
    </span>
  );
};

/**
 * Intersects a changed line's highlight tokens with its word-diff chunks. Both
 * are contiguous partitions of the same body string, so a two-pointer walk over
 * their union of boundaries yields atoms that each carry one colour and one diff
 * status — preserving syntax colour *and* the `<ins>`/`<del>` word marks.
 */
export const mergeHighlightWithDiff = (
  bodyText: string,
  bodyTokens: LineTokens,
  diffArray: readonly DiffInformation[],
  options: MergeOptions,
): ReactElement[] => {
  const ranges: { start: number; end: number; type: DiffType }[] = [];
  let pos = 0;
  for (const diff of diffArray) {
    const value = typeof diff.value === "string" ? diff.value : "";
    if (value.length > 0) {
      ranges.push({
        start: pos,
        end: pos + value.length,
        type: diff.type ?? DiffType.DEFAULT,
      });
      pos += value.length;
    }
  }

  const total = bodyText.length;
  const out: ReactElement[] = [];
  let ti = 0;
  let ri = 0;
  let cur = 0;
  let key = 0;
  while (cur < total) {
    const token = bodyTokens[ti];
    const range = ranges[ri];
    const tokenEnd = token ? token.end : total;
    const rangeEnd = range ? range.end : total;
    const end = Math.min(tokenEnd, rangeEnd, total);
    if (end <= cur) {
      // Zero-width or stale interval — advance past it to guarantee progress.
      if (tokenEnd <= cur) ti += 1;
      else if (rangeEnd <= cur) ri += 1;
      else break;
      continue;
    }
    out.push(
      renderAtom(
        bodyText.slice(cur, end),
        token?.color,
        range ? range.type : DiffType.DEFAULT,
        options,
        key++,
      ),
    );
    cur = end;
    if (tokenEnd <= cur) ti += 1;
    if (rangeEnd <= cur) ri += 1;
  }
  return out;
};

/**
 * Renders a non-changed (context / fully-added / fully-removed) line as coloured
 * spans, with no word-diff wrapping.
 */
export const renderHighlightedPlain = (
  bodyText: string,
  bodyTokens: LineTokens,
): ReactElement[] => {
  if (bodyTokens.length === 0) {
    return [<span key={0}>{bodyText}</span>];
  }
  return bodyTokens.map((token, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional runs, not keyed data
    <span key={i} style={{ color: token.color }}>
      {bodyText.slice(token.start, token.end)}
    </span>
  ));
};

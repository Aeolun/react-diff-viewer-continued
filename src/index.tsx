import cn from "classnames";
import * as React from "react";
import type { JSX, ReactElement, RefObject } from "react";

import type { Change } from "diff";
import memoize from "memoize-one";
import { type Block, computeHiddenBlocks } from "./compute-hidden-blocks.js";
import {
  type DiffInformation,
  DiffMethod,
  DiffType,
  type LineInformation,
  computeLineInformationWorker,
  computeDiff,
} from "./compute-lines.js";
import { Expand } from "./expand.js";
import computeStyles, {
  type ReactDiffViewerStyles,
  type ReactDiffViewerStylesOverride,
  type ReactDiffViewerStylesVariables,
} from "./styles.js";

import { Fold } from "./fold.js";
import {
  type LineTokens,
  ensureLanguage,
  highlightSide,
  mergeHighlightWithDiff,
  renderHighlightedPlain,
  sliceLineTokens,
} from "./highlight.js";
import {
  type HighlightTheme,
  defaultDarkHighlightTheme,
  defaultLightHighlightTheme,
} from "./highlight-theme.js";

type IntrinsicElements = JSX.IntrinsicElements;

const LEADING_WHITESPACE = /^[ \t]+/;

/**
 * Splits a line's leading whitespace off its content so it can be rendered as a
 * separate fixed-width indent column (see `contentFlex`/`lineIndent`/`lineBody`
 * styles). Peeling happens *before* the value is highlighted/word-diffed, so the
 * indent never gets swept into a syntax token or a diff chunk.
 *
 * Handles both shapes `renderLine` receives: a raw string, or a word-diff array
 * whose leading whitespace may span one or more leading chunks (WORDS_WITH_SPACE
 * isolates indentation as its own chunk) or prefix the first chunk. The remaining
 * chunks are returned intact so their diff types/colours are preserved.
 */
function splitLeadingWhitespace(
  value: string | DiffInformation[] | undefined,
): {
  indent: string;
  rest: string | DiffInformation[] | undefined;
} {
  if (typeof value === "string") {
    const match = value.match(LEADING_WHITESPACE);
    return match
      ? { indent: match[0], rest: value.slice(match[0].length) }
      : { indent: "", rest: value };
  }
  if (Array.isArray(value)) {
    const chunks = value.map((chunk) => ({ ...chunk }));
    let indent = "";
    let i = 0;
    for (; i < chunks.length; i++) {
      const chunkValue =
        typeof chunks[i].value === "string"
          ? (chunks[i].value as string)
          : null;
      if (chunkValue === null) break;
      const match = chunkValue.match(LEADING_WHITESPACE);
      if (!match) break;
      if (match[0].length === chunkValue.length) {
        // Whole chunk is whitespace — consume it and keep scanning.
        indent += chunkValue;
        continue;
      }
      // Chunk starts with whitespace then real content — keep the trimmed remainder.
      indent += match[0];
      chunks[i] = { ...chunks[i], value: chunkValue.slice(match[0].length) };
      break;
    }
    return indent
      ? { indent, rest: chunks.slice(i) }
      : { indent: "", rest: value };
  }
  return { indent: "", rest: value };
}

/**
 * Applies diff styling (ins/del tags) to pre-highlighted HTML by walking through
 * the HTML and wrapping text portions based on character positions in the diff.
 */
function applyDiffToHighlightedHtml(
  html: string,
  diffArray: DiffInformation[],
  styles: { wordDiff: string; wordAdded: string; wordRemoved: string },
): string {
  // Build diff ranges with character positions
  interface DiffRange {
    start: number;
    end: number;
    type: DiffType;
  }

  const ranges: DiffRange[] = [];
  let pos = 0;
  for (const diff of diffArray) {
    const value = typeof diff.value === "string" ? diff.value : "";
    if (value.length > 0) {
      ranges.push({ start: pos, end: pos + value.length, type: diff.type ?? DiffType.DEFAULT });
      pos += value.length;
    }
  }

  // Parse HTML into tag and text segments
  interface Segment {
    type: "tag" | "text";
    content: string;
  }

  const segments: Segment[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) {
        // Malformed HTML, treat rest as text
        segments.push({ type: "text", content: html.slice(i) });
        break;
      }
      segments.push({ type: "tag", content: html.slice(i, tagEnd + 1) });
      i = tagEnd + 1;
    } else {
      // Find the next tag or end of string
      let textEnd = html.indexOf("<", i);
      if (textEnd === -1) textEnd = html.length;
      segments.push({ type: "text", content: html.slice(i, textEnd) });
      i = textEnd;
    }
  }

  // Helper to decode HTML entities for character counting
  function decodeEntities(text: string): string {
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, "\u00A0");
  }

  // Helper to get the wrapper tag for a diff type
  function getWrapper(
    type: DiffType,
  ): { open: string; close: string } | null {
    if (type === DiffType.ADDED) {
      return {
        open: `<ins class="${styles.wordDiff} ${styles.wordAdded}">`,
        close: "</ins>",
      };
    }
    if (type === DiffType.REMOVED) {
      return {
        open: `<del class="${styles.wordDiff} ${styles.wordRemoved}">`,
        close: "</del>",
      };
    }
    return {
      open: `<span class="${styles.wordDiff}">`,
      close: "</span>",
    };
  }

  // Process segments, tracking text position
  let textPos = 0;
  let result = "";

  for (const segment of segments) {
    if (segment.type === "tag") {
      result += segment.content;
    } else {
      // Text segment - we need to split it according to diff ranges
      const text = segment.content;
      const decodedText = decodeEntities(text);

      // Walk through the text, character by character (in decoded form)
      // but output the original encoded form
      let localDecodedPos = 0;
      let localEncodedPos = 0;

      while (localDecodedPos < decodedText.length) {
        const globalPos = textPos + localDecodedPos;

        // Find the range that covers this position
        const range = ranges.find(
          (r) => globalPos >= r.start && globalPos < r.end,
        );

        if (!range) {
          // No range covers this position (shouldn't happen, but be safe)
          // Just output the character
          const char = text[localEncodedPos];
          result += char;
          localEncodedPos++;
          localDecodedPos++;
          continue;
        }

        // How many decoded characters until the end of this range?
        const charsUntilRangeEnd = range.end - globalPos;
        // How many decoded characters until the end of this text segment?
        const charsUntilTextEnd = decodedText.length - localDecodedPos;
        // Take the minimum
        const charsToTake = Math.min(charsUntilRangeEnd, charsUntilTextEnd);

        // Now we need to find the corresponding encoded substring
        // Walk through encoded text, counting decoded characters
        let encodedChunkEnd = localEncodedPos;
        let decodedCount = 0;
        while (decodedCount < charsToTake && encodedChunkEnd < text.length) {
          if (text[encodedChunkEnd] === "&") {
            // Find entity end
            const entityEnd = text.indexOf(";", encodedChunkEnd);
            if (entityEnd !== -1 && entityEnd - encodedChunkEnd < 10) {
              encodedChunkEnd = entityEnd + 1;
            } else {
              encodedChunkEnd++;
            }
          } else {
            encodedChunkEnd++;
          }
          decodedCount++;
        }

        const chunk = text.slice(localEncodedPos, encodedChunkEnd);
        const wrapper = getWrapper(range.type);

        if (wrapper) {
          result += wrapper.open + chunk + wrapper.close;
        } else {
          result += chunk;
        }

        localEncodedPos = encodedChunkEnd;
        localDecodedPos += charsToTake;
      }

      textPos += decodedText.length;
    }
  }

  return result;
}

export enum LineNumberPrefix {
  LEFT = "L",
  RIGHT = "R",
}

export interface InfiniteLoadingProps {
  pageSize: number,
  containerHeight: string,
  overscan?: number,
}

export interface ComputedDiffResult {
  lineInformation: LineInformation[];
  lineBlocks: Record<number, number>;
  blocks: Block[];
}

export interface ReactDiffViewerProps {
  // Old value to compare.
  oldValue: string | Record<string, unknown>;
  // New value to compare.
  newValue: string | Record<string, unknown>;
  // Enable/Disable split view.
  splitView?: boolean;
  // Set line Offset
  linesOffset?: number;
  // Enable/Disable word diff.
  disableWordDiff?: boolean;
  // JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
  compareMethod?: DiffMethod | ((oldStr: string, newStr: string) => Change[]);
  // Number of unmodified lines surrounding each line diff.
  extraLinesSurroundingDiff?: number;
  // Show/hide line number.
  hideLineNumbers?: boolean;
  /**
   * Show the lines indicated here. Specified as L20 or R18 for respectively line 20 on the left or line 18 on the right.
   */
  alwaysShowLines?: string[];
  // Show only diff between the two values.
  showDiffOnly?: boolean;
  // Render prop to format final string before displaying them in the UI.
  renderContent?: (source: string) => ReactElement;
  // Render prop to format code fold message.
  codeFoldMessageRenderer?: (
    totalFoldedLines: number,
    leftStartLineNumber: number,
    rightStartLineNumber: number,
  ) => ReactElement;
  // Event handler for line number click.
  onLineNumberClick?: (
    lineId: string,
    event: React.MouseEvent<HTMLTableCellElement>,
  ) => void;
  // render gutter
  renderGutter?: (data: {
    lineNumber: number;
    type: DiffType;
    prefix: LineNumberPrefix;
    value: string | DiffInformation[];
    additionalLineNumber?: number;
    additionalPrefix?: LineNumberPrefix;
    styles: ReactDiffViewerStyles;
  }) => ReactElement;
  // Array of line ids to highlight lines.
  highlightLines?: string[];
  // Style overrides.
  styles?: ReactDiffViewerStylesOverride;
  // Use dark theme.
  useDarkTheme?: boolean;
  /**
   * Used to describe the thing being diffed
   */
  summary?: string | ReactElement;
  // Title for left column
  leftTitle?: string | ReactElement;
  // Title for left column
  rightTitle?: string | ReactElement;
  // Nonce
  nonce?: string;
  /**
   * to enable infiniteLoading for better performance
   */
  infiniteLoading?: InfiniteLoadingProps;
  /**
   * to display loading element when diff is being computed
   */
  loadingElement?: () => ReactElement
  /**
   * Hide the summary bar (expand/collapse button, change count, filename)
   */
  hideSummary?: boolean
  /**
   * Show debug overlay with virtualization info (for development)
   */
  showDebugInfo?: boolean
  /**
   * Disable Web Worker for diff computation, using synchronous fallback instead.
   * Useful when the worker bundle fails to load in certain bundler configurations.
   */
  disableWorker?: boolean
  /**
   * Enable first-party syntax highlighting for the given language (a Prism/
   * refractor language name or alias, e.g. `"typescript"`, `"json"`, `"html"`).
   * Each side is highlighted as a whole — so constructs that wrap across lines
   * tokenise correctly — and the highlighting is merged with word-diff marks on
   * changed lines. Takes precedence over `renderContent` for line content.
   * Unknown languages fall back gracefully to no highlighting.
   */
  highlightLanguage?: string
  /**
   * Optional overrides for the syntax-highlight colour palette. Merged over the
   * built-in light/dark theme (selected by `useDarkTheme`). Keys are Prism token
   * types (`keyword`, `string`, `tag`, ...) plus `default`.
   */
  highlightTheme?: HighlightTheme
}

export interface ReactDiffViewerState {
  expandedBlocks: number[];
  noSelect?: "left" | "right";
  scrollableContainerRef: RefObject<HTMLDivElement>
  computedDiffResult: Record<string, ComputedDiffResult>
  isLoading: boolean
  // For virtualization: the first visible row index
  visibleStartRow: number
  // For variable row heights with text wrapping
  contentColumnWidth: number | null;
  charWidth: number | null;
  cumulativeOffsets: number[] | null;
  isScrolling: boolean;
  // Per-side syntax-highlight tokens, keyed by line number. Null when
  // `highlightLanguage` is unset or the grammar is unavailable.
  highlightResult: {
    key: string;
    left: Map<number, LineTokens>;
    right: Map<number, LineTokens>;
  } | null;
}

class DiffViewer extends React.Component<
  ReactDiffViewerProps,
  ReactDiffViewerState
> {
  private styles!: ReactDiffViewerStyles;

  // Cache for on-demand word diff computation
  private wordDiffCache: Map<string, { left: DiffInformation[]; right: DiffInformation[] }> = new Map();

  // Ensures the highlightLanguage/renderContent precedence warning fires once.
  private highlightPrecedenceWarned = false;

  // Refs for measuring content column width and character width
  private contentColumnRef: RefObject<HTMLTableCellElement> = React.createRef();
  private charMeasureRef: RefObject<HTMLSpanElement> = React.createRef();
  private stickyHeaderRef: RefObject<HTMLDivElement> = React.createRef();
  private resizeObserver: ResizeObserver | null = null;
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRenderedRange: { start: number; end: number } = { start: 0, end: Infinity };

  public static defaultProps: ReactDiffViewerProps = {
    oldValue: "",
    newValue: "",
    splitView: true,
    highlightLines: [],
    disableWordDiff: false,
    compareMethod: DiffMethod.CHARS,
    styles: {},
    hideLineNumbers: false,
    extraLinesSurroundingDiff: 3,
    showDiffOnly: true,
    useDarkTheme: false,
    linesOffset: 0,
    nonce: "",
  };

  public constructor(props: ReactDiffViewerProps) {
    super(props);

    this.state = {
      expandedBlocks: [],
      noSelect: undefined,
      scrollableContainerRef: React.createRef(),
      computedDiffResult: {},
      isLoading: false,
      visibleStartRow: 0,
      contentColumnWidth: null,
      charWidth: null,
      cumulativeOffsets: null,
      isScrolling: false,
      highlightResult: null,
    };
  }

  /**
   * Computes word diff on-demand for a line, with caching.
   * This is used when word diff was deferred during initial computation.
   */
  private getWordDiffValues = (
    left: DiffInformation,
    right: DiffInformation,
    lineIndex: number
  ): { leftValue: string | DiffInformation[] | undefined; rightValue: string | DiffInformation[] | undefined } => {
    if (!left || !right) {
      return { leftValue: left?.value, rightValue: right?.value };
    }

    if (left.rawValue === undefined || right.rawValue === undefined) {
      return { leftValue: left.value, rightValue: right.value };
    }

    const cacheKey = `${lineIndex}-${left.rawValue}-${right.rawValue}`;
    let cached = this.wordDiffCache.get(cacheKey);

    if (!cached) {
      const compareMethod = (this.props.compareMethod === DiffMethod.JSON || this.props.compareMethod === DiffMethod.YAML)
        ? DiffMethod.CHARS
        : this.props.compareMethod;
      const computed = computeDiff(left.rawValue, right.rawValue, compareMethod);
      cached = { left: computed.left ?? [], right: computed.right ?? [] };
      this.wordDiffCache.set(cacheKey, cached);
    }

    return { leftValue: cached.left, rightValue: cached.right };
  };

  /**
   * Resets code block expand to the initial stage. Will be exposed to the parent component via
   * refs.
   */
  public resetCodeBlocks = (): boolean => {
    if (this.state.expandedBlocks.length > 0) {
      this.setState({
        expandedBlocks: [],
      });
      return true;
    }
    return false;
  };

  /**
   * Pushes the target expanded code block to the state. During the re-render,
   * this value is used to expand/fold unmodified code.
   */
  private onBlockExpand = (id: number): void => {
    const prevState = this.state.expandedBlocks.slice();
    prevState.push(id);

    this.setState(
      { expandedBlocks: prevState },
      () => this.recalculateOffsets()
    );
  };

  /**
   * Gets the height of the sticky header, if present.
   */
  private getStickyHeaderHeight(): number {
    return this.stickyHeaderRef.current?.offsetHeight || 0;
  }

  /**
   * Measures the width of a single character in the monospace font.
   * Falls back to 7.2px if measurement fails.
   */
  private measureCharWidth(): number {
    const span = this.charMeasureRef.current;
    if (!span) return 7.2; // fallback
    return span.getBoundingClientRect().width || 7.2;
  }

  /**
   * Measures the available width for content in a content column.
   * Falls back to estimating from container width if direct measurement fails.
   */
  private measureContentColumnWidth(): number | null {
    // Try direct measurement first
    const cell = this.contentColumnRef.current;
    if (cell && cell.clientWidth > 0) {
      const style = window.getComputedStyle(cell);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const width = cell.clientWidth - padding;
      if (width > 0) return width;
    }

    // Fallback: estimate from container width
    // In split view: container has 2 content columns + gutters (50px each) + markers (28px each)
    // In unified view: 1 content column + 2 gutters + 1 marker
    const container = this.state.scrollableContainerRef.current;
    if (!container || container.clientWidth <= 0) return null;

    const containerWidth = container.clientWidth;
    const gutterWidth = this.props.hideLineNumbers ? 0 : 50;
    const markerWidth = 28;
    const gutterCount = this.props.splitView ? 2 : 2; // left gutter(s)
    const markerCount = this.props.splitView ? 2 : 1;
    const contentColumns = this.props.splitView ? 2 : 1;

    const fixedWidth = gutterCount * gutterWidth + markerCount * markerWidth;
    const availableWidth = containerWidth - fixedWidth;
    return Math.max(100, availableWidth / contentColumns); // minimum 100px
  }

  /**
   * Gets the text length from a value that may be a string or DiffInformation array.
   */
  private getTextLength(value: string | DiffInformation[] | undefined): number {
    if (!value) return 0;
    if (typeof value === 'string') return value.length;
    return value.reduce((sum, d) => sum + (typeof d.value === 'string' ? d.value.length : 0), 0);
  }

  /**
   * Builds cumulative vertical offsets for each line based on character count and column width.
   * This allows accurate scroll position calculations with variable row heights.
   */
  private buildCumulativeOffsets(
    lineInformation: LineInformation[],
    lineBlocks: Record<number, number>,
    blocks: Block[],
    expandedBlocks: number[],
    showDiffOnly: boolean,
    charWidth: number,
    columnWidth: number,
    splitView: boolean,
  ): number[] {
    const offsets: number[] = [0];
    const seenBlocks = new Set<number>();

    for (let i = 0; i < lineInformation.length; i++) {
      const line = lineInformation[i];

      if (showDiffOnly) {
        const blockIndex = lineBlocks[i];
        if (blockIndex !== undefined && !expandedBlocks.includes(blockIndex)) {
          const isLastLine = blocks[blockIndex].endLine === i;
          if (!seenBlocks.has(blockIndex) && isLastLine) {
            seenBlocks.add(blockIndex);
            offsets.push(offsets[offsets.length - 1] + DiffViewer.ESTIMATED_ROW_HEIGHT);
          }
          continue;
        }
      }

      // Calculate visual rows for this line
      const leftLen = line.left?.value ? this.getTextLength(line.left.value) : 0;
      const rightLen = line.right?.value ? this.getTextLength(line.right.value) : 0;
      const maxLen = splitView ? Math.max(leftLen, rightLen) : (leftLen || rightLen);
      const charsPerRow = Math.floor(columnWidth / charWidth);
      const visualRows = charsPerRow > 0 ? Math.max(1, Math.ceil(maxLen / charsPerRow)) : 1;

      offsets.push(offsets[offsets.length - 1] + visualRows * DiffViewer.ESTIMATED_ROW_HEIGHT);
    }

    return offsets;
  }

  /**
   * Binary search to find the line index at a given scroll offset.
   */
  private findLineAtOffset(scrollTop: number, offsets: number[]): number {
    let low = 0;
    let high = offsets.length - 2;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (offsets[mid] <= scrollTop) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  /**
   * Recalculates cumulative offsets based on current measurements.
   * Called on resize and when blocks are expanded/collapsed.
   */
  private recalculateOffsets = (): void => {
    if (!this.props.infiniteLoading) return;

    const columnWidth = this.measureContentColumnWidth();
    const charWidth = this.measureCharWidth();
    if (!columnWidth) return;

    const cacheKey = this.getMemoisedKey();
    const { lineInformation, lineBlocks, blocks } = this.state.computedDiffResult[cacheKey] ?? {};
    if (!lineInformation) return;

    const offsets = this.buildCumulativeOffsets(
      lineInformation,
      lineBlocks,
      blocks,
      this.state.expandedBlocks,
      this.props.showDiffOnly ?? true,
      charWidth,
      columnWidth,
      this.props.splitView ?? true,
    );

    this.setState({ cumulativeOffsets: offsets, contentColumnWidth: columnWidth, charWidth }, () => {
      // Force a scroll position update to recalculate visible rows with new offsets
      this.onScroll();
    });
  };

  /**
   * Computes final styles for the diff viewer. It combines the default styles with the user
   * supplied overrides. The computed styles are cached with performance in mind.
   *
   * @param styles User supplied style overrides.
   */
  private computeStyles: (
    styles: ReactDiffViewerStylesOverride,
    useDarkTheme: boolean,
    nonce: string,
  ) => ReactDiffViewerStyles = memoize(computeStyles);

  /**
   * Returns a function with clicked line number in the closure. Returns an no-op function when no
   * onLineNumberClick handler is supplied.
   *
   * @param id Line id of a line.
   */
  private onLineNumberClickProxy = (id: string): any => {
    if (this.props.onLineNumberClick) {
      return (e: any): void => this.props.onLineNumberClick!(id, e);
    }
    return (): void => {};
  };

  /**
   * Checks if the current compare method should show word-level highlighting.
   * Character, word-level, JSON, and YAML diffs benefit from highlighting individual changes.
   * JSON/YAML use CHARS internally for word-level diff, so they should be highlighted.
   */
  private shouldHighlightWordDiff = (): boolean => {
    const { compareMethod } = this.props;
    return (
      compareMethod === DiffMethod.CHARS ||
      compareMethod === DiffMethod.WORDS ||
      compareMethod === DiffMethod.WORDS_WITH_SPACE ||
      compareMethod === DiffMethod.JSON ||
      compareMethod === DiffMethod.YAML
    );
  };

  /**
   * Maps over the word diff and constructs the required React elements to show word diff.
   *
   * @param diffArray Word diff information derived from line information.
   * @param renderer Optional renderer to format diff words. Useful for syntax highlighting.
   */
  private renderWordDiff = (
    diffArray: DiffInformation[],
    renderer?: (chunk: string) => JSX.Element,
  ): ReactElement[] => {
    const showHighlight = this.shouldHighlightWordDiff();

    // Reconstruct the full line from diff chunks
    const fullLine = diffArray
      .map((d) => (typeof d.value === "string" ? d.value : ""))
      .join("");

    // For very long lines (>500 chars), skip fancy processing - just render plain text
    // without word-level highlighting to avoid performance issues
    const MAX_LINE_LENGTH = 500;
    if (fullLine.length > MAX_LINE_LENGTH) {
      return [<span key="long-line">{fullLine}</span>];
    }

    // If we have a renderer, try to highlight the full line first,
    // then apply diff styling to preserve proper tokenization.
    if (renderer) {
      // Get the syntax-highlighted content
      const highlighted = renderer(fullLine);

      // Check if the renderer uses dangerouslySetInnerHTML (common with Prism, highlight.js, etc.)
      const htmlContent = highlighted?.props?.dangerouslySetInnerHTML?.__html;
      if (typeof htmlContent === "string") {
        // Apply diff styling to the highlighted HTML
        const styledHtml = applyDiffToHighlightedHtml(htmlContent, diffArray, {
          wordDiff: this.styles.wordDiff,
          wordAdded: showHighlight ? this.styles.wordAdded : "",
          wordRemoved: showHighlight ? this.styles.wordRemoved : "",
        });

        // Clone the element with the modified HTML
        return [
          React.cloneElement(highlighted, {
            key: "highlighted-diff",
            dangerouslySetInnerHTML: { __html: styledHtml },
          }),
        ];
      }

      // Renderer doesn't use dangerouslySetInnerHTML - fall through to per-chunk rendering
    }

    // Fallback: render each chunk separately (used for JSON/YAML or non-HTML renderers)
    return diffArray.map((wordDiff, i): JSX.Element => {
      let content: string | JSX.Element | undefined;
      if (typeof wordDiff.value === "string") {
        content = wordDiff.value;
      } else {
        content = undefined;
      }

      return wordDiff.type === DiffType.ADDED ? (
        <ins
          key={i}
          className={cn(this.styles.wordDiff, {
            [this.styles.wordAdded]: showHighlight,
          })}
        >
          {content}
        </ins>
      ) : wordDiff.type === DiffType.REMOVED ? (
        <del
          key={i}
          className={cn(this.styles.wordDiff, {
            [this.styles.wordRemoved]: showHighlight,
          })}
        >
          {content}
        </del>
      ) : (
        <span key={i} className={cn(this.styles.wordDiff)}>
          {content}
        </span>
      );
    });
  };

  /**
   * Maps over the line diff and constructs the required react elements to show line diff. It calls
   * renderWordDiff when encountering word diff. This takes care of both inline and split view line
   * renders.
   *
   * @param lineNumber Line number of the current line.
   * @param type Type of diff of the current line.
   * @param prefix Unique id to prefix with the line numbers.
   * @param value Content of the line. It can be a string or a word diff array.
   * @param additionalLineNumber Additional line number to be shown. Useful for rendering inline
   *  diff view. Right line number will be passed as additionalLineNumber.
   * @param additionalPrefix Similar to prefix but for additional line number.
   */
  private renderLine = (
    lineNumber: number | null | undefined,
    type: DiffType | undefined,
    prefix: LineNumberPrefix,
    value: string | DiffInformation[] | undefined,
    additionalLineNumber?: number | null,
    additionalPrefix?: LineNumberPrefix,
  ): ReactElement => {
    const lineNumberTemplate = `${prefix}-${lineNumber}`;
    const additionalLineNumberTemplate = `${additionalPrefix}-${additionalLineNumber}`;
    const highlightLines = this.props.highlightLines ?? [];
    const highlightLine =
      highlightLines.includes(lineNumberTemplate) ||
      highlightLines.includes(additionalLineNumberTemplate);
    const added = type === DiffType.ADDED;
    const removed = type === DiffType.REMOVED;
    const changed = type === DiffType.CHANGED;
    // Peel the leading whitespace into a separate indent column before any
    // highlighting/word-diffing runs, so wrapped continuation lines hang-indent
    // under the line's first character instead of the cell's left edge.
    const { indent, rest } = splitLeadingWhitespace(value);
    const hasWordDiff = Array.isArray(rest);

    // First-party syntax highlighting: look up this line's whole-side tokens and
    // rebase them past the peeled indent so they line up with the diff body.
    const highlightMap = this.state.highlightResult
      ? prefix === LineNumberPrefix.LEFT
        ? this.state.highlightResult.left
        : this.state.highlightResult.right
      : null;
    const sideLineNumber = lineNumber ?? additionalLineNumber ?? undefined;
    const fullLineTokens =
      highlightMap && sideLineNumber != null ? highlightMap.get(sideLineNumber) : undefined;
    const bodyTokens = fullLineTokens ? sliceLineTokens(fullLineTokens, indent.length) : undefined;

    // Longest body we'll merge char-by-char before falling back to plain colour.
    const MAX_HIGHLIGHT_MERGE_LENGTH = 500;

    let content;
    if (bodyTokens) {
      if (hasWordDiff) {
        const bodyText = rest
          .map((chunk) => (typeof chunk.value === "string" ? chunk.value : ""))
          .join("");
        content =
          bodyText.length > MAX_HIGHLIGHT_MERGE_LENGTH
            ? renderHighlightedPlain(bodyText, bodyTokens)
            : mergeHighlightWithDiff(bodyText, bodyTokens, rest, {
                styles: {
                  wordDiff: this.styles.wordDiff,
                  wordAdded: this.styles.wordAdded,
                  wordRemoved: this.styles.wordRemoved,
                },
                showHighlight: this.shouldHighlightWordDiff(),
              });
      } else if (typeof rest === "string") {
        content = renderHighlightedPlain(rest, bodyTokens);
      } else {
        content = rest;
      }
    } else if (hasWordDiff) {
      content = this.renderWordDiff(rest, this.props.renderContent);
    } else if (this.props.renderContent && typeof rest === "string") {
      content = this.props.renderContent(rest);
    } else {
      content = rest;
    }

    let ElementType: keyof IntrinsicElements = "div";
    if (added && !hasWordDiff) {
      ElementType = "ins";
    } else if (removed && !hasWordDiff) {
      ElementType = "del";
    }

    // A line is only "empty" (gets the empty-line background) when it has neither
    // body content nor peeled indentation — a whitespace-only line is not empty.
    const isEmpty = !content && !indent;

    return (
      <>
        {!this.props.hideLineNumbers && (
          <td
            onClick={
              lineNumber && this.onLineNumberClickProxy(lineNumberTemplate)
            }
            className={cn(this.styles.gutter, {
              [this.styles.emptyGutter]: !lineNumber,
              [this.styles.diffAdded]: added,
              [this.styles.diffRemoved]: removed,
              [this.styles.diffChanged]: changed,
              [this.styles.highlightedGutter]: highlightLine,
            })}
          >
            <pre className={this.styles.lineNumber}>{lineNumber}</pre>
          </td>
        )}
        {!this.props.splitView && !this.props.hideLineNumbers && (
          <td
            onClick={
              additionalLineNumber &&
              this.onLineNumberClickProxy(additionalLineNumberTemplate)
            }
            className={cn(this.styles.gutter, {
              [this.styles.emptyGutter]: !additionalLineNumber,
              [this.styles.diffAdded]: added,
              [this.styles.diffRemoved]: removed,
              [this.styles.diffChanged]: changed,
              [this.styles.highlightedGutter]: highlightLine,
            })}
          >
            <pre className={this.styles.lineNumber}>{additionalLineNumber}</pre>
          </td>
        )}
        {this.props.renderGutter
          ? this.props.renderGutter({
              lineNumber: lineNumber ?? 0,
              type: type ?? DiffType.DEFAULT,
              prefix,
              value: value ?? "",
              additionalLineNumber: additionalLineNumber ?? undefined,
              additionalPrefix,
              styles: this.styles,
            })
          : null}
        <td
          className={cn(this.styles.marker, {
            [this.styles.emptyLine]: isEmpty,
            [this.styles.diffAdded]: added,
            [this.styles.diffRemoved]: removed,
            [this.styles.diffChanged]: changed,
            [this.styles.highlightedLine]: highlightLine,
          })}
        >
          <pre>
            {added && "+"}
            {removed && "-"}
          </pre>
        </td>
        <td
          ref={prefix === LineNumberPrefix.LEFT && !this.state.cumulativeOffsets ? this.contentColumnRef : undefined}
          className={cn(this.styles.content, {
            [this.styles.emptyLine]: isEmpty,
            [this.styles.diffAdded]: added,
            [this.styles.diffRemoved]: removed,
            [this.styles.diffChanged]: changed,
            [this.styles.highlightedLine]: highlightLine,
            left: prefix === LineNumberPrefix.LEFT,
            right: prefix === LineNumberPrefix.RIGHT,
          })}
          onMouseDown={() => {
            const rightElements = document.getElementsByClassName("right");
            for (let i = 0; i < rightElements.length; i++) {
              rightElements[i]?.classList.remove(this.styles.noSelect);
            }
            const leftElements = document.getElementsByClassName("left");
            for (let i = 0; i < leftElements.length; i++) {
              leftElements[i]?.classList.remove(this.styles.noSelect);
            }
            const opposite = document.getElementsByClassName(
              prefix === LineNumberPrefix.LEFT ? "right" : "left",
            );
            for (let i = 0; i < opposite.length; i++) {
              opposite[i]?.classList.add(this.styles.noSelect);
            }
          }}
          title={
            added && !hasWordDiff
              ? "Added line"
              : removed && !hasWordDiff
                ? "Removed line"
                : undefined
          }
        >
          <ElementType className={cn(this.styles.contentText, this.styles.contentFlex)}>
            {indent ? <span className={this.styles.lineIndent}>{indent}</span> : null}
            <span className={this.styles.lineBody}>{content}</span>
          </ElementType>
        </td>
      </>
    );
  };

  /**
   * Generates lines for split view.
   *
   * @param obj Line diff information.
   * @param obj.left Life diff information for the left pane of the split view.
   * @param obj.right Life diff information for the right pane of the split view.
   * @param index React key for the lines.
   */
  private renderSplitView = (
    { left, right }: LineInformation,
    index: number,
  ): ReactElement => {
    // Compute word diff on-demand if deferred
    const { leftValue, rightValue } = this.getWordDiffValues(left, right, index);

    return (
      <tr key={index} className={this.styles.line}>
        {this.renderLine(
          left.lineNumber,
          left.type,
          LineNumberPrefix.LEFT,
          leftValue,
        )}
        {this.renderLine(
          right.lineNumber,
          right.type,
          LineNumberPrefix.RIGHT,
          rightValue,
        )}
      </tr>
    );
  };

  /**
   * Generates lines for inline view.
   *
   * @param obj Line diff information.
   * @param obj.left Life diff information for the added section of the inline view.
   * @param obj.right Life diff information for the removed section of the inline view.
   * @param index React key for the lines.
   */
  public renderInlineView = (
    { left, right }: LineInformation,
    index: number,
  ): ReactElement => {
    // Compute word diff on-demand if deferred
    const { leftValue, rightValue } = this.getWordDiffValues(left, right, index);

    let content;
    if (left.type === DiffType.REMOVED && right.type === DiffType.ADDED) {
      return (
        <React.Fragment key={index}>
          <tr className={this.styles.line}>
            {this.renderLine(
              left.lineNumber,
              left.type,
              LineNumberPrefix.LEFT,
              leftValue,
              null,
            )}
          </tr>
          <tr className={this.styles.line}>
            {this.renderLine(
              null,
              right.type,
              LineNumberPrefix.RIGHT,
              rightValue,
              right.lineNumber,
              LineNumberPrefix.RIGHT,
            )}
          </tr>
        </React.Fragment>
      );
    }
    if (left.type === DiffType.REMOVED) {
      content = this.renderLine(
        left.lineNumber,
        left.type,
        LineNumberPrefix.LEFT,
        leftValue,
        null,
      );
    }
    if (left.type === DiffType.DEFAULT) {
      content = this.renderLine(
        left.lineNumber,
        left.type,
        LineNumberPrefix.LEFT,
        leftValue,
        right.lineNumber,
        LineNumberPrefix.RIGHT,
      );
    }
    if (right.type === DiffType.ADDED) {
      content = this.renderLine(
        null,
        right.type,
        LineNumberPrefix.RIGHT,
        rightValue,
        right.lineNumber,
      );
    }

    return (
      <tr key={index} className={this.styles.line}>
        {content}
      </tr>
    );
  };

  /**
   * Returns a function with clicked block number in the closure.
   *
   * @param id Cold fold block id.
   */
  private onBlockClickProxy =
    (id: number): (() => void) =>
    (): void =>
      this.onBlockExpand(id);

  /**
   * Generates cold fold block. It also uses the custom message renderer when available to show
   * cold fold messages.
   *
   * @param num Number of skipped lines between two blocks.
   * @param blockNumber Code fold block id.
   * @param leftBlockLineNumber First left line number after the current code fold block.
   * @param rightBlockLineNumber First right line number after the current code fold block.
   */
  private renderSkippedLineIndicator = (
    num: number,
    blockNumber: number,
    leftBlockLineNumber: number,
    rightBlockLineNumber: number,
  ): ReactElement => {
    const { hideLineNumbers, splitView } = this.props;
    const message = this.props.codeFoldMessageRenderer ? (
      this.props.codeFoldMessageRenderer(
        num,
        leftBlockLineNumber,
        rightBlockLineNumber,
      )
    ) : (
      <span className={this.styles.codeFoldContent}>
        @@ -{leftBlockLineNumber - num},{num} +{rightBlockLineNumber - num},{num} @@
      </span>
    );
    const content = (
      <td className={this.styles.codeFoldContentContainer}>
        <button
          type="button"
          className={this.styles.codeFoldExpandButton}
          onClick={this.onBlockClickProxy(blockNumber)}
          tabIndex={0}
        >
          {message}
        </button>
      </td>
    );
    const isUnifiedViewWithoutLineNumbers = !splitView && !hideLineNumbers;
    const expandGutter = (
      <td className={this.styles.codeFoldGutter}>
        <Expand />
      </td>
    );

    return (
      <tr
        key={`${leftBlockLineNumber}-${rightBlockLineNumber}`}
        className={this.styles.codeFold}
        onClick={this.onBlockClickProxy(blockNumber)}
        role="button"
        tabIndex={0}
      >
        {!hideLineNumbers && expandGutter}
        {this.props.renderGutter ? (
          <td className={this.styles.codeFoldGutter} />
        ) : null}
        <td
          className={cn({
            [this.styles.codeFoldGutter]: isUnifiedViewWithoutLineNumbers,
          })}
        />

        {/* Swap columns only for unified view without line numbers */}
        {isUnifiedViewWithoutLineNumbers ? (
          <React.Fragment>
            <td />
            {content}
          </React.Fragment>
        ) : (
          <React.Fragment>
            {content}
            {this.props.renderGutter ? <td /> : null}
            <td />
            <td />
            {!hideLineNumbers ? <td /> : null}
          </React.Fragment>
        )}
      </tr>
    );
  };

  /**
   * 
   * Generates a unique cache key based on the current props used in diff computation.
   * 
   * This key is used to memoize results and avoid recomputation for the same inputs.
   * @returns A stringified JSON key representing the current diff settings and input values.
   *
   */
  private getMemoisedKey = () => {
    const {
      oldValue,
      newValue,
      disableWordDiff,
      compareMethod,
      linesOffset,
      alwaysShowLines,
      extraLinesSurroundingDiff,
    } = this.props;

    return JSON.stringify({
      oldValue,
      newValue,
      disableWordDiff,
      compareMethod,
      linesOffset,
      alwaysShowLines,
      extraLinesSurroundingDiff,
    });
  }

  /**
   * Computes and memoizes the diff result between `oldValue` and `newValue`.
   * 
   * If a memoized result exists for the current input configuration, it uses that.
   * Otherwise, it runs the diff logic in a Web Worker to avoid blocking the UI.
   * It also computes hidden line blocks for collapsing unchanged sections,
   * and stores the result in the local component state.
   */
  private memoisedCompute = async () => {
    const {
      oldValue,
      newValue,
      disableWordDiff,
      compareMethod,
      linesOffset
    } = this.props;

    const cacheKey = this.getMemoisedKey()
    if (!!this.state.computedDiffResult[cacheKey]) {
      this.setState((prev) => ({
        ...prev,
        isLoading: false
      }))
      this.updateHighlight();
      return;
    }

    // Defer word diff computation when using infinite loading with reasonable container height
    // This significantly improves initial render time for large diffs
    const containerHeight = this.props.infiniteLoading?.containerHeight;
    const containerHeightPx = containerHeight
      ? typeof containerHeight === 'number'
        ? containerHeight
        : parseInt(containerHeight, 10) || 0
      : 0;
    const shouldDeferWordDiff = !disableWordDiff &&
      !!this.props.infiniteLoading &&
      containerHeightPx > 0 &&
      containerHeightPx < 2000;

    const { lineInformation, diffLines } = await computeLineInformationWorker(
      oldValue,
      newValue,
      disableWordDiff,
      compareMethod,
      linesOffset,
      this.props.alwaysShowLines,
      shouldDeferWordDiff,
      this.props.disableWorker,
    );

    const rawExtraLines = this.props.extraLinesSurroundingDiff ?? 3;
    const extraLines = rawExtraLines < 0 ? 0 : Math.round(rawExtraLines);

    const { lineBlocks, blocks } = computeHiddenBlocks(
      lineInformation,
      diffLines,
      extraLines,
    );

    this.state.computedDiffResult[cacheKey] = { lineInformation, lineBlocks, blocks }
    this.setState((prev) => ({
      ...prev,
      computedDiffResult: this.state.computedDiffResult,
      isLoading: false,
    }), () => {
      // Recompute syntax highlighting now that fresh line information exists.
      this.updateHighlight();
      // Trigger offset recalculation after diff is computed and rendered
      // Use requestAnimationFrame to ensure DOM is ready for measurement
      if (this.props.infiniteLoading) {
        requestAnimationFrame(() => this.recalculateOffsets());
      }
    })
  }

  /**
   * Extracts the raw text of one side of a line for whole-side highlighting.
   * Prefers `rawValue` (deferred word diff), then a plain string value, then the
   * concatenation of word-diff chunk values.
   */
  private lineToText = (info: DiffInformation): string => {
    if (typeof info.rawValue === "string") return info.rawValue;
    if (typeof info.value === "string") return info.value;
    if (Array.isArray(info.value)) {
      return info.value.map((chunk) => (typeof chunk.value === "string" ? chunk.value : "")).join("");
    }
    return "";
  };

  /**
   * Reconstructs one side's full document from the computed line information and
   * highlights it in a single pass, returning per-line tokens keyed by line
   * number. Highlighting the whole side (rather than line-by-line) is what keeps
   * lexer state correct across line boundaries.
   */
  private buildSideTokens = (
    lineInformation: LineInformation[],
    side: "left" | "right",
    language: string,
    theme: HighlightTheme,
  ): Map<number, LineTokens> => {
    const entries: { lineNumber: number; text: string }[] = [];
    for (const line of lineInformation) {
      const info = line[side];
      if (!info || info.lineNumber == null) continue;
      entries.push({ lineNumber: info.lineNumber, text: this.lineToText(info) });
    }
    entries.sort((a, b) => a.lineNumber - b.lineNumber);

    const result = new Map<number, LineTokens>();
    if (entries.length === 0) return result;

    const perLine = highlightSide(entries.map((e) => e.text).join("\n"), language, theme);
    if (!perLine) return result;

    for (let i = 0; i < entries.length; i++) {
      result.set(entries[i].lineNumber, perLine[i] ?? []);
    }
    return result;
  };

  /**
   * Resolves the active highlight theme (built-in light/dark, with any
   * `highlightTheme` overrides merged on top).
   */
  private resolveHighlightTheme = (): HighlightTheme => {
    const base = this.props.useDarkTheme ? defaultDarkHighlightTheme : defaultLightHighlightTheme;
    return this.props.highlightTheme ? { ...base, ...this.props.highlightTheme } : base;
  };

  /**
   * Computes syntax-highlight tokens for both sides when `highlightLanguage` is
   * set, storing them in state. Lazily loads the grammar, is memoised by
   * (diff, language, theme, dark) so it is cheap to call repeatedly, and clears
   * the result when highlighting is disabled or the language is unavailable.
   */
  private updateHighlight = async (): Promise<void> => {
    const { highlightLanguage } = this.props;
    if (!highlightLanguage) {
      if (this.state.highlightResult) this.setState({ highlightResult: null });
      return;
    }

    const diffKey = this.getMemoisedKey();
    const diffResult = this.state.computedDiffResult[diffKey];
    // Diff not ready yet — memoisedCompute re-invokes updateHighlight when it is.
    if (!diffResult) return;

    const dark = this.props.useDarkTheme ?? false;
    const key = `${diffKey}::${highlightLanguage}::${dark}::${JSON.stringify(this.props.highlightTheme ?? null)}`;
    if (this.state.highlightResult?.key === key) return;

    const canonical = await ensureLanguage(highlightLanguage);
    // Bail if props changed while the grammar was loading.
    if (this.props.highlightLanguage !== highlightLanguage || this.getMemoisedKey() !== diffKey) return;
    if (!canonical) {
      if (this.state.highlightResult) this.setState({ highlightResult: null });
      return;
    }

    if (
      !this.highlightPrecedenceWarned &&
      this.props.renderContent &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      this.highlightPrecedenceWarned = true;
      console.warn(
        "[react-diff-viewer] `highlightLanguage` takes precedence over `renderContent`; `renderContent` is ignored for line content while highlighting is active.",
      );
    }

    const theme = this.resolveHighlightTheme();
    const left = this.buildSideTokens(diffResult.lineInformation, "left", canonical, theme);
    const right = this.buildSideTokens(diffResult.lineInformation, "right", canonical, theme);
    this.setState({ highlightResult: { key, left, right } });
  };

  // Estimated row height based on lineHeight: 1.6em with 12px base font
  private static readonly ESTIMATED_ROW_HEIGHT = 19;

  /**
   * Handles scroll events on the scrollable container.
   *
   * Updates the visible start row for virtualization.
   */
  private onScroll = () => {
    const container = this.state.scrollableContainerRef.current
    if (!container || !this.props.infiniteLoading) return;

    // Account for sticky header height in scroll calculations
    const headerHeight = this.getStickyHeaderHeight();
    const contentScrollTop = Math.max(0, container.scrollTop - headerHeight);

    const { cumulativeOffsets } = this.state;
    const newStartRow = cumulativeOffsets
      ? this.findLineAtOffset(contentScrollTop, cumulativeOffsets)
      : Math.floor(contentScrollTop / DiffViewer.ESTIMATED_ROW_HEIGHT);

    const viewportRows = Math.ceil(container.clientHeight / DiffViewer.ESTIMATED_ROW_HEIGHT);
    const newEndRow = newStartRow + viewportRows;
    const leavesRenderedRange = newStartRow < this.lastRenderedRange.start || newEndRow > this.lastRenderedRange.end;

    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }

    const stateUpdate: Partial<ReactDiffViewerState> = {};
    if (newStartRow !== this.state.visibleStartRow) {
      stateUpdate.visibleStartRow = newStartRow;
    }
    if (leavesRenderedRange && !this.state.isScrolling) {
      stateUpdate.isScrolling = true;
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate as ReactDiffViewerState);
    }

    if (this.state.isScrolling || leavesRenderedRange) {
      this.scrollDebounceTimer = setTimeout(() => {
        this.setState({ isScrolling: false });
      }, 150);
    }
  }

  /**
   * Generates the entire diff view with virtualization support.
   */
  private renderDiff = (): {
    diffNodes: ReactElement[];
    lineInformation: LineInformation[];
    blocks: Block[];
    totalRenderedRows: number;
    topPadding: number;
    bottomPadding: number;
    totalContentHeight: number;
    renderedCount: number;
    debug: {
      visibleRowStart: number;
      visibleRowEnd: number;
      totalRows: number;
      offsetsLength: number;
      renderedCount: number;
      scrollTop: number;
      headerHeight: number;
      contentScrollTop: number;
      clientHeight: number;
    };
  } => {
    const { splitView, infiniteLoading, showDiffOnly } = this.props;
    const { computedDiffResult, expandedBlocks, visibleStartRow, scrollableContainerRef, cumulativeOffsets } = this.state
    const cacheKey = this.getMemoisedKey()
    const { lineInformation = [], lineBlocks = [], blocks = [] } = computedDiffResult[cacheKey] ?? {}

    // Calculate visible range for virtualization
    let visibleRowStart = 0;
    let visibleRowEnd = Infinity;
    const buffer = infiniteLoading?.overscan ?? 20;

    if (infiniteLoading && scrollableContainerRef.current) {
      const container = scrollableContainerRef.current;
      // Account for sticky header height in scroll calculations
      const headerHeight = this.getStickyHeaderHeight();
      const contentScrollTop = Math.max(0, container.scrollTop - headerHeight);

      if (cumulativeOffsets) {
        // Variable height mode: use binary search to find visible range
        const totalHeight = cumulativeOffsets[cumulativeOffsets.length - 1] || 0;
        const lastRowIndex = cumulativeOffsets.length - 2;

        visibleRowStart = Math.max(0, this.findLineAtOffset(contentScrollTop, cumulativeOffsets) - buffer);
        visibleRowEnd = this.findLineAtOffset(contentScrollTop + container.clientHeight, cumulativeOffsets) + buffer;

        // IMPORTANT: The calculated offsets may overestimate row heights (based on char count),
        // but actual CSS rendering might produce shorter rows. To prevent empty space,
        // ensure we render at least enough rows to fill the viewport using ESTIMATED_ROW_HEIGHT
        // as a conservative minimum.
        const minRowsToFillViewport = Math.ceil(container.clientHeight / DiffViewer.ESTIMATED_ROW_HEIGHT);
        visibleRowEnd = Math.max(visibleRowEnd, visibleRowStart + minRowsToFillViewport + buffer);

        // Also ensure we render all rows when near the bottom
        if (contentScrollTop + container.clientHeight >= totalHeight - buffer * DiffViewer.ESTIMATED_ROW_HEIGHT) {
          visibleRowEnd = lastRowIndex + buffer;
        }
      } else {
        // Fixed height fallback
        const viewportRows = Math.ceil(container.clientHeight / DiffViewer.ESTIMATED_ROW_HEIGHT);
        visibleRowStart = Math.max(0, visibleStartRow - buffer);
        visibleRowEnd = visibleStartRow + viewportRows + buffer;
      }
    }

    // First pass: build a map of lineIndex -> renderedRowIndex
    // This accounts for code folding where some lines don't render or render as fold indicators
    const lineToRowMap: Map<number, number> = new Map();
    const seenBlocks = new Set<number>();
    let currentRow = 0;

    for (let i = 0; i < lineInformation.length; i++) {
      const blockIndex = lineBlocks[i];

      if (showDiffOnly && blockIndex !== undefined) {
        if (!expandedBlocks.includes(blockIndex)) {
          // Line is in a collapsed block
          const lastLineOfBlock = blocks[blockIndex].endLine === i;
          if (!seenBlocks.has(blockIndex) && lastLineOfBlock) {
            // This line renders as a fold indicator
            seenBlocks.add(blockIndex);
            lineToRowMap.set(i, currentRow);
            currentRow++;
          }
          // Other lines in collapsed block don't render
        } else {
          // Block is expanded, line renders normally
          lineToRowMap.set(i, currentRow);
          currentRow++;
        }
      } else {
        // Not in a block or showDiffOnly is false, line renders normally
        lineToRowMap.set(i, currentRow);
        currentRow++;
      }
    }

    const totalRenderedRows = currentRow;

    // Second pass: render only lines in the visible range
    const diffNodes: ReactElement[] = [];
    let topPadding = 0;
    let firstVisibleFound = false;
    let lastRenderedRowIndex = -1;
    seenBlocks.clear();

    for (let lineIndex = 0; lineIndex < lineInformation.length; lineIndex++) {
      const line = lineInformation[lineIndex];
      const rowIndex = lineToRowMap.get(lineIndex);

      // Skip lines that don't render (hidden in collapsed blocks)
      if (rowIndex === undefined) continue;

      // Skip lines before visible range
      if (rowIndex < visibleRowStart) {
        continue;
      }

      // Stop after visible range
      if (rowIndex > visibleRowEnd) {
        break;
      }

      // Calculate top padding from the first visible row
      if (!firstVisibleFound) {
        topPadding = cumulativeOffsets
          ? cumulativeOffsets[rowIndex] || 0
          : rowIndex * DiffViewer.ESTIMATED_ROW_HEIGHT;
        firstVisibleFound = true;
      }

      // Track the last rendered row for bottom padding calculation
      lastRenderedRowIndex = rowIndex;

      // Render the line
      if (showDiffOnly) {
        const blockIndex = lineBlocks[lineIndex];

        if (blockIndex !== undefined) {
          const lastLineOfBlock = blocks[blockIndex].endLine === lineIndex;
          if (
            !expandedBlocks.includes(blockIndex) &&
            lastLineOfBlock
          ) {
            diffNodes.push(
              <React.Fragment key={lineIndex}>
                {this.renderSkippedLineIndicator(
                  blocks[blockIndex].lines,
                  blockIndex,
                  line.left.lineNumber ?? 0,
                  line.right.lineNumber ?? 0,
                )}
              </React.Fragment>
            );
            continue;
          }
          if (!expandedBlocks.includes(blockIndex)) {
            continue;
          }
        }
      }

      diffNodes.push(
        splitView
          ? this.renderSplitView(line, lineIndex)
          : this.renderInlineView(line, lineIndex)
      );
    }

    // Calculate total content height
    const totalContentHeight = cumulativeOffsets
      ? cumulativeOffsets[cumulativeOffsets.length - 1] || 0
      : totalRenderedRows * DiffViewer.ESTIMATED_ROW_HEIGHT;

    // Calculate bottom padding: space after the last rendered row
    const bottomPadding = cumulativeOffsets && lastRenderedRowIndex >= 0
      ? totalContentHeight - (cumulativeOffsets[lastRenderedRowIndex + 1] || totalContentHeight)
      : 0;

    this.lastRenderedRange = { start: visibleRowStart, end: visibleRowEnd };

    return {
      diffNodes,
      blocks,
      lineInformation,
      totalRenderedRows,
      topPadding,
      bottomPadding,
      totalContentHeight,
      renderedCount: diffNodes.length,
      debug: {
        visibleRowStart,
        visibleRowEnd,
        totalRows: totalRenderedRows,
        offsetsLength: cumulativeOffsets?.length ?? 0,
        renderedCount: diffNodes.length,
        scrollTop: scrollableContainerRef.current?.scrollTop ?? 0,
        headerHeight: this.getStickyHeaderHeight(),
        contentScrollTop: scrollableContainerRef.current
          ? Math.max(0, scrollableContainerRef.current.scrollTop - this.getStickyHeaderHeight())
          : 0,
        clientHeight: scrollableContainerRef.current?.clientHeight ?? 0,
      }
    };
  };

  componentDidUpdate(prevProps: ReactDiffViewerProps) {
    if (
      prevProps.oldValue !== this.props.oldValue ||
      prevProps.newValue !== this.props.newValue ||
      prevProps.compareMethod !== this.props.compareMethod ||
      prevProps.disableWordDiff !== this.props.disableWordDiff ||
      prevProps.linesOffset !== this.props.linesOffset
    ) {
      // Clear word diff cache when diff changes
      this.wordDiffCache.clear();

      // Reset scroll position to top
      const container = this.state.scrollableContainerRef.current;
      if (container) {
        container.scrollTop = 0;
      }

      this.setState((prev) => ({
        ...prev,
        isLoading: true,
        visibleStartRow: 0,
        cumulativeOffsets: null as number[] | null,
      }))
      this.memoisedCompute();
    } else if (
      prevProps.highlightLanguage !== this.props.highlightLanguage ||
      prevProps.highlightTheme !== this.props.highlightTheme ||
      prevProps.useDarkTheme !== this.props.useDarkTheme
    ) {
      // Highlighting inputs changed but the diff itself did not — just re-tokenise.
      this.updateHighlight();
    }
  }

  componentDidMount() {
    this.setState((prev) => ({
      ...prev,
      isLoading: true
    }))
    this.memoisedCompute();

    // Set up ResizeObserver for recalculating offsets on container resize
    if (typeof ResizeObserver !== 'undefined' && this.props.infiniteLoading) {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.recalculateOffsets());
      });
      const container = this.state.scrollableContainerRef.current;
      if (container) {
        this.resizeObserver.observe(container);
      }
    }
  }

  componentWillUnmount() {
    this.resizeObserver?.disconnect();
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
  }

  public render = (): ReactElement => {
    const {
      oldValue,
      newValue,
      useDarkTheme,
      leftTitle,
      rightTitle,
      splitView,
      compareMethod,
      hideLineNumbers,
      nonce,
    } = this.props;

    if (
      typeof compareMethod === "string" &&
      compareMethod !== DiffMethod.JSON
    ) {
      if (typeof oldValue !== "string" || typeof newValue !== "string") {
        throw Error('"oldValue" and "newValue" should be strings');
      }
    }

    this.styles = this.computeStyles(this.props.styles ?? {}, useDarkTheme ?? false, nonce ?? "");
    const nodes = this.renderDiff();

    let colSpanOnSplitView = 3;
    let colSpanOnInlineView = 4;

    if (hideLineNumbers) {
      colSpanOnSplitView -= 1;
      colSpanOnInlineView -= 1;
    }

    if (this.props.renderGutter) {
      colSpanOnSplitView += 1;
      colSpanOnInlineView += 1;
    }

    let deletions = 0;
    let additions = 0;
    for (const l of nodes.lineInformation) {
      if (l.left.type === DiffType.ADDED) {
        additions++;
      }
      if (l.right.type === DiffType.ADDED) {
        additions++;
      }
      if (l.left.type === DiffType.REMOVED) {
        deletions++;
      }
      if (l.right.type === DiffType.REMOVED) {
        deletions++;
      }
    }
    const totalChanges = deletions + additions;

    const percentageAddition = Math.round((additions / totalChanges) * 100);
    const blocks: ReactElement[] = [];
    for (let i = 0; i < 5; i++) {
      if (percentageAddition > i * 20) {
        blocks.push(
          <span
            key={i}
            className={cn(this.styles.block, this.styles.blockAddition)}
          />,
        );
      } else {
        blocks.push(
          <span
            key={i}
            className={cn(this.styles.block, this.styles.blockDeletion)}
          />,
        );
      }
    }
    const allExpanded =
      this.state.expandedBlocks.length === nodes.blocks.length;

    const LoadingElement = this.props.loadingElement;
    const scrollDivStyle = this.props.infiniteLoading ? {
      overflowY: 'scroll',
      overflowX: 'hidden',
      height: this.props.infiniteLoading.containerHeight
    } as const : {}

    // Only apply noWrap when infiniteLoading is enabled but we don't have cumulative offsets yet
    // Once offsets are calculated, we enable pre-wrap for proper text wrapping
    const shouldNoWrap = !!this.props.infiniteLoading && !this.state.cumulativeOffsets;

    const tableElement = (
      <table
        className={cn(this.styles.diffContainer, {
          [this.styles.splitView]: splitView,
          [this.styles.noWrap]: shouldNoWrap,
        })}
        onMouseUp={() => {}}
      >
        <colgroup>
          {!this.props.hideLineNumbers && <col width={"50px"} />}
          {!splitView && !this.props.hideLineNumbers && <col width={"50px"} />}
          {this.props.renderGutter && <col width={"50px"} />}
          <col width={"28px"} />
          <col width={"auto"} />
          {splitView && (
            <>
              {!this.props.hideLineNumbers && <col width={"50px"} />}
              {this.props.renderGutter && <col width={"50px"} />}
              <col width={"28px"} />
              <col width={"auto"} />
            </>
          )}
        </colgroup>
        <tbody>
          {nodes.diffNodes}
        </tbody>
      </table>
    );

    const showLoadingOverlay = (this.state.isLoading || this.state.isScrolling) && !!LoadingElement;

    return (
      <div style={{ position: 'relative' }}>
      {showLoadingOverlay && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
        }}>
          <LoadingElement />
        </div>
      )}
      <div
        style={{ ...scrollDivStyle, position: 'relative' }}
        onScroll={this.onScroll}
        ref={this.state.scrollableContainerRef}
      >
        {(!this.props.hideSummary || leftTitle || rightTitle) && (
          <div ref={this.stickyHeaderRef} className={this.styles.stickyHeader}>
            {!this.props.hideSummary && (
              <div className={this.styles.summary} role={"banner"}>
                <button
                  type={"button"}
                  className={this.styles.allExpandButton}
                  onClick={() => {
                    this.setState(
                      {
                        expandedBlocks: allExpanded
                          ? []
                          : nodes.blocks.map((b) => b.index),
                      },
                      () => this.recalculateOffsets()
                    );
                  }}
                >
                  {allExpanded ? <Fold /> : <Expand />}
                </button>{" "}
                {totalChanges}
                <div style={{ display: "flex", gap: "1px" }}>{blocks}</div>
                {this.props.summary ? <span>{this.props.summary}</span> : null}
              </div>
            )}
            {(leftTitle || rightTitle) && (
              <div className={this.styles.columnHeaders}>
                <div className={this.styles.titleBlock}>
                  {leftTitle ? (
                    <pre className={this.styles.contentText}>{leftTitle}</pre>
                  ) : null}
                </div>
                {splitView && (
                  <div className={this.styles.titleBlock}>
                    {rightTitle ? (
                      <pre className={this.styles.contentText}>{rightTitle}</pre>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {this.props.infiniteLoading ? (
          <div style={{
            height: nodes.totalContentHeight,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: nodes.topPadding,
              left: 0,
              right: 0,
              visibility: this.state.isScrolling ? 'hidden' : 'visible',
            }}>
              {tableElement}
            </div>
          </div>
        ) : (
          tableElement
        )}
        {/* Hidden element for measuring character width */}
        <span
          ref={this.charMeasureRef}
          style={{
            position: 'absolute',
            top: 0,
            left: '-9999px',
            visibility: 'hidden',
            whiteSpace: 'pre',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
          aria-hidden="true"
        >M</span>
        {/* Debug overlay */}
        {this.props.infiniteLoading && this.props.showDebugInfo && (
          <div
            style={{
              position: 'fixed',
              top: 10,
              right: 10,
              background: 'rgba(0,0,0,0.85)',
              color: '#0f0',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '11px',
              zIndex: 9999,
              borderRadius: '4px',
              maxWidth: '300px',
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#fff' }}>Debug Info</div>
            <div>scrollTop: {nodes.debug.scrollTop}</div>
            <div>headerHeight: {nodes.debug.headerHeight}</div>
            <div>contentScrollTop: {nodes.debug.contentScrollTop}</div>
            <div>clientHeight: {nodes.debug.clientHeight}</div>
            <div style={{ marginTop: '5px', borderTop: '1px solid #444', paddingTop: '5px' }}>
              <div>visibleRowStart: {nodes.debug.visibleRowStart}</div>
              <div>visibleRowEnd: {nodes.debug.visibleRowEnd}</div>
            </div>
            <div style={{ marginTop: '5px', borderTop: '1px solid #444', paddingTop: '5px' }}>
              <div>totalRows: {nodes.debug.totalRows}</div>
              <div>offsetsLength: {nodes.debug.offsetsLength}</div>
              <div>renderedCount: {nodes.debug.renderedCount}</div>
            </div>
            <div style={{ marginTop: '5px', borderTop: '1px solid #444', paddingTop: '5px' }}>
              <div>topPadding: {nodes.topPadding.toFixed(0)}</div>
              <div>bottomPadding: {nodes.bottomPadding.toFixed(0)}</div>
              <div>totalContentHeight: {nodes.totalContentHeight.toFixed(0)}</div>
            </div>
            <div style={{ marginTop: '5px', borderTop: '1px solid #444', paddingTop: '5px', color: '#ff0' }}>
              <div>cumulativeOffsets: {this.state.cumulativeOffsets ? 'SET' : 'NULL'}</div>
              <div>columnWidth: {this.state.contentColumnWidth?.toFixed(0) ?? 'N/A'}px</div>
              <div>charWidth: {this.state.charWidth?.toFixed(2) ?? 'N/A'}px</div>
              <div>charsPerRow: {this.state.contentColumnWidth && this.state.charWidth ? Math.floor(this.state.contentColumnWidth / this.state.charWidth) : 'N/A'}</div>
            </div>
            {this.state.cumulativeOffsets && (
              <div style={{ marginTop: '5px', borderTop: '1px solid #444', paddingTop: '5px', color: '#0ff', fontSize: '10px' }}>
                <div>offsets[{nodes.debug.visibleRowEnd}]: {this.state.cumulativeOffsets[nodes.debug.visibleRowEnd]?.toFixed(0) ?? 'N/A'}</div>
                <div>offsets[{nodes.debug.totalRows - 1}]: {this.state.cumulativeOffsets[nodes.debug.totalRows - 1]?.toFixed(0) ?? 'N/A'}</div>
                <div>offsets[{nodes.debug.totalRows}]: {this.state.cumulativeOffsets[nodes.debug.totalRows]?.toFixed(0) ?? 'N/A'}</div>
                <div style={{ marginTop: '3px' }}>viewportEnd: {(nodes.debug.contentScrollTop + nodes.debug.clientHeight).toFixed(0)}</div>
                <div style={{ marginTop: '3px', color: '#f0f' }}>
                  scrollHeight: {this.state.scrollableContainerRef.current?.scrollHeight ?? 'N/A'}
                </div>
                <div>maxScrollTop: {(this.state.scrollableContainerRef.current?.scrollHeight ?? 0) - nodes.debug.clientHeight}</div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    );
  };
}

export default DiffViewer;
export { DiffMethod };
export { default as computeStyles } from "./styles.js";
export {
  defaultLightThemeVariables,
  defaultDarkThemeVariables,
} from "./styles.js";
export {
  defaultLightHighlightTheme,
  defaultDarkHighlightTheme,
} from "./highlight-theme.js";
export type { ReactDiffViewerStylesOverride, ReactDiffViewerStyles, ReactDiffViewerStylesVariables };
export type { HighlightTheme } from "./highlight-theme.js";

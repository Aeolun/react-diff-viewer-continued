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
} from "./styles.js";

import { Fold } from "./fold.js";

type IntrinsicElements = JSX.IntrinsicElements;

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
      ranges.push({ start: pos, end: pos + value.length, type: diff.type });
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
  containerHeight: string
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
    additionalLineNumber: number;
    additionalPrefix: LineNumberPrefix;
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
}

export interface ReactDiffViewerState {
  // Array holding the expanded code folding.
  expandedBlocks?: number[];
  noSelect?: "left" | "right";
  scrollableContainerRef: RefObject<HTMLDivElement>
  computedDiffResult: Record<string, ComputedDiffResult>
  isLoading: boolean
  // For virtualization: the first visible row index
  visibleStartRow: number
}

class DiffViewer extends React.Component<
  ReactDiffViewerProps,
  ReactDiffViewerState
> {
  private styles: ReactDiffViewerStyles;

  // Cache for on-demand word diff computation
  private wordDiffCache: Map<string, { left: DiffInformation[]; right: DiffInformation[] }> = new Map();

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
      visibleStartRow: 0
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
  ): { leftValue: string | DiffInformation[]; rightValue: string | DiffInformation[] } => {
    // Handle empty left/right
    if (!left || !right) {
      return { leftValue: left?.value, rightValue: right?.value };
    }

    // If no raw values, word diff was already computed or disabled
    // Use explicit undefined check since empty string is a valid raw value
    if (left.rawValue === undefined || right.rawValue === undefined) {
      return { leftValue: left.value, rightValue: right.value };
    }

    // Check cache
    const cacheKey = `${lineIndex}-${left.rawValue}-${right.rawValue}`;
    let cached = this.wordDiffCache.get(cacheKey);

    if (!cached) {
      // Compute word diff on-demand
      // Use CHARS method for on-demand computation since rawValue is always a string
      // (JSON/YAML methods only work with objects, not the string lines we have here)
      const compareMethod = (this.props.compareMethod === DiffMethod.JSON || this.props.compareMethod === DiffMethod.YAML)
        ? DiffMethod.CHARS
        : this.props.compareMethod;
      const computed = computeDiff(left.rawValue, right.rawValue, compareMethod);
      cached = { left: computed.left, right: computed.right };
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

    this.setState({
      expandedBlocks: prevState,
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
      return (e: any): void => this.props.onLineNumberClick(id, e);
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
    const { compareMethod } = this.props;
    // Don't apply syntax highlighting for JSON/YAML - their word diffs are computed
    // on-demand from raw strings and syntax highlighting creates messy fragmented tokens.
    const skipSyntaxHighlighting =
      compareMethod === DiffMethod.JSON || compareMethod === DiffMethod.YAML;

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

    // If we have a renderer and syntax highlighting is enabled, try to highlight
    // the full line first, then apply diff styling to preserve proper tokenization.
    if (renderer && !skipSyntaxHighlighting) {
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
      let content: string | JSX.Element;
      if (typeof wordDiff.value === "string") {
        content = wordDiff.value;
      } else {
        // If wordDiff.value is DiffInformation[], we don't handle it. See c0c99f5712.
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
    lineNumber: number,
    type: DiffType,
    prefix: LineNumberPrefix,
    value: string | DiffInformation[],
    additionalLineNumber?: number,
    additionalPrefix?: LineNumberPrefix,
  ): ReactElement => {
    const lineNumberTemplate = `${prefix}-${lineNumber}`;
    const additionalLineNumberTemplate = `${additionalPrefix}-${additionalLineNumber}`;
    const highlightLine =
      this.props.highlightLines.includes(lineNumberTemplate) ||
      this.props.highlightLines.includes(additionalLineNumberTemplate);
    const added = type === DiffType.ADDED;
    const removed = type === DiffType.REMOVED;
    const changed = type === DiffType.CHANGED;
    let content;
    const hasWordDiff = Array.isArray(value);
    if (hasWordDiff) {
      content = this.renderWordDiff(value, this.props.renderContent);
    } else if (this.props.renderContent) {
      content = this.props.renderContent(value);
    } else {
      content = value;
    }

    let ElementType: keyof IntrinsicElements = "div";
    if (added && !hasWordDiff) {
      ElementType = "ins";
    } else if (removed && !hasWordDiff) {
      ElementType = "del";
    }

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
              lineNumber,
              type,
              prefix,
              value,
              additionalLineNumber,
              additionalPrefix,
              styles: this.styles,
            })
          : null}
        <td
          className={cn(this.styles.marker, {
            [this.styles.emptyLine]: !content,
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
          className={cn(this.styles.content, {
            [this.styles.emptyLine]: !content,
            [this.styles.diffAdded]: added,
            [this.styles.diffRemoved]: removed,
            [this.styles.diffChanged]: changed,
            [this.styles.highlightedLine]: highlightLine,
            left: prefix === LineNumberPrefix.LEFT,
            right: prefix === LineNumberPrefix.RIGHT,
          })}
          onMouseDown={() => {
            const elements = document.getElementsByClassName(
              prefix === LineNumberPrefix.LEFT ? "right" : "left",
            );
            for (let i = 0; i < elements.length; i++) {
              const element = elements.item(i);
              element.classList.add(this.styles.noSelect);
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
          <ElementType className={this.styles.contentText}>
            {content}
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
    );

    const extraLines =
      this.props.extraLinesSurroundingDiff < 0
        ? 0
        : Math.round(this.props.extraLinesSurroundingDiff);

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
    }))
  }

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

    const newStartRow = Math.floor(container.scrollTop / DiffViewer.ESTIMATED_ROW_HEIGHT);

    // Only update state if the start row changed (avoid unnecessary re-renders)
    if (newStartRow !== this.state.visibleStartRow) {
      this.setState({ visibleStartRow: newStartRow });
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
  } => {
    const { splitView, infiniteLoading, showDiffOnly } = this.props;
    const { computedDiffResult, expandedBlocks, visibleStartRow, scrollableContainerRef } = this.state
    const cacheKey = this.getMemoisedKey()
    const { lineInformation = [], lineBlocks = [], blocks = [] } = computedDiffResult[cacheKey] ?? {}

    // Calculate visible range for virtualization
    let visibleRowStart = 0;
    let visibleRowEnd = Infinity;
    const buffer = 5; // render extra rows above/below viewport

    if (infiniteLoading && scrollableContainerRef.current) {
      const container = scrollableContainerRef.current;
      const viewportRows = Math.ceil(container.clientHeight / DiffViewer.ESTIMATED_ROW_HEIGHT);
      visibleRowStart = Math.max(0, visibleStartRow - buffer);
      visibleRowEnd = visibleStartRow + viewportRows + buffer;
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
        topPadding = rowIndex * DiffViewer.ESTIMATED_ROW_HEIGHT;
        firstVisibleFound = true;
      }

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
                  line.left.lineNumber,
                  line.right.lineNumber,
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

    return {
      diffNodes,
      blocks,
      lineInformation,
      totalRenderedRows,
      topPadding,
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
      this.setState((prev) => ({
        ...prev,
        isLoading: true,
        visibleStartRow: 0
      }))
      this.memoisedCompute();
    }
  }

  componentDidMount() {
    this.setState((prev) => ({
      ...prev,
      isLoading: true
    }))
    this.memoisedCompute();
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

    this.styles = this.computeStyles(this.props.styles, useDarkTheme, nonce);
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

    const totalContentHeight = nodes.totalRenderedRows * DiffViewer.ESTIMATED_ROW_HEIGHT;

    const tableElement = (
      <table
        className={cn(this.styles.diffContainer, {
          [this.styles.splitView]: splitView,
        })}
        onMouseUp={() => {
          const elements = document.getElementsByClassName("right");
          for (let i = 0; i < elements.length; i++) {
            const element = elements.item(i);
            element.classList.remove(this.styles.noSelect);
          }
          const elementsLeft = document.getElementsByClassName("left");
          for (let i = 0; i < elementsLeft.length; i++) {
            const element = elementsLeft.item(i);
            element.classList.remove(this.styles.noSelect);
          }
        }}
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

    return (
      <div
        style={{ ...scrollDivStyle, position: 'relative' }}
        onScroll={this.onScroll}
        ref={this.state.scrollableContainerRef}
      >
        {(!this.props.hideSummary || leftTitle || rightTitle) && (
          <div className={this.styles.stickyHeader}>
            {!this.props.hideSummary && (
              <div className={this.styles.summary} role={"banner"}>
                <button
                  type={"button"}
                  className={this.styles.allExpandButton}
                  onClick={() => {
                    this.setState({
                      expandedBlocks: allExpanded
                        ? []
                        : nodes.blocks.map((b) => b.index),
                    });
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
        {this.state.isLoading && LoadingElement && <LoadingElement />}
        {this.props.infiniteLoading ? (
          <div style={{ minHeight: totalContentHeight, paddingTop: nodes.topPadding }}>
            {tableElement}
          </div>
        ) : (
          tableElement
        )}
      </div>
    );
  };
}

export default DiffViewer;
export { DiffMethod };
export type { ReactDiffViewerStylesOverride };

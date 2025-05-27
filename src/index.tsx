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
} from "./compute-lines.js";
import { Expand } from "./expand.js";
import computeStyles, {
  type ReactDiffViewerStyles,
  type ReactDiffViewerStylesOverride,
} from "./styles.js";

import { Fold } from "./fold.js";

type IntrinsicElements = JSX.IntrinsicElements;

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
}

export interface ReactDiffViewerState {
  // Array holding the expanded code folding.
  expandedBlocks?: number[];
  noSelect?: "left" | "right";
  scrollableContainerRef: RefObject<HTMLDivElement>
  pageNumber: number
  computedDiffResult: Record<string, ComputedDiffResult>
  isLoading: boolean
}

class DiffViewer extends React.Component<
  ReactDiffViewerProps,
  ReactDiffViewerState
> {
  private styles: ReactDiffViewerStyles;

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
      pageNumber: 1,
      computedDiffResult: {},
      isLoading: false
    };
  }

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
   * Maps over the word diff and constructs the required React elements to show word diff.
   *
   * @param diffArray Word diff information derived from line information.
   * @param renderer Optional renderer to format diff words. Useful for syntax highlighting.
   */
  private renderWordDiff = (
    diffArray: DiffInformation[],
    renderer?: (chunk: string) => JSX.Element,
  ): ReactElement[] => {
    return diffArray.map((wordDiff, i): JSX.Element => {
      const content = renderer
        ? renderer(wordDiff.value as string)
        : (typeof wordDiff.value === 'string'
          ? wordDiff.value
          // If wordDiff.value is DiffInformation, we don't handle it, unclear why. See c0c99f5712.
          : undefined);

      return wordDiff.type === DiffType.ADDED ? (
        <ins
          key={i}
          className={cn(this.styles.wordDiff, {
            [this.styles.wordAdded]: wordDiff.type === DiffType.ADDED,
          })}
        >
          {content}
        </ins>
      ) : wordDiff.type === DiffType.REMOVED ? (
        <del
          key={i}
          className={cn(this.styles.wordDiff, {
            [this.styles.wordRemoved]: wordDiff.type === DiffType.REMOVED,
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
    return (
      <tr key={index} className={this.styles.line}>
        {this.renderLine(
          left.lineNumber,
          left.type,
          LineNumberPrefix.LEFT,
          left.value,
        )}
        {this.renderLine(
          right.lineNumber,
          right.type,
          LineNumberPrefix.RIGHT,
          right.value,
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
    let content;
    if (left.type === DiffType.REMOVED && right.type === DiffType.ADDED) {
      return (
        <React.Fragment key={index}>
          <tr className={this.styles.line}>
            {this.renderLine(
              left.lineNumber,
              left.type,
              LineNumberPrefix.LEFT,
              left.value,
              null,
            )}
          </tr>
          <tr className={this.styles.line}>
            {this.renderLine(
              null,
              right.type,
              LineNumberPrefix.RIGHT,
              right.value,
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
        left.value,
        null,
      );
    }
    if (left.type === DiffType.DEFAULT) {
      content = this.renderLine(
        left.lineNumber,
        left.type,
        LineNumberPrefix.LEFT,
        left.value,
        right.lineNumber,
        LineNumberPrefix.RIGHT,
      );
    }
    if (right.type === DiffType.ADDED) {
      content = this.renderLine(
        null,
        right.type,
        LineNumberPrefix.RIGHT,
        right.value,
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
        Expand {num} lines ...
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
    return (
      <tr
        key={`${leftBlockLineNumber}-${rightBlockLineNumber}`}
        className={this.styles.codeFold}
      >
        {!hideLineNumbers && <td className={this.styles.codeFoldGutter} />}
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

    const { lineInformation, diffLines } = await computeLineInformationWorker(
      oldValue,
      newValue,
      disableWordDiff,
      compareMethod,
      linesOffset,
      this.props.alwaysShowLines,
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
      pageNumber: 1
    }))
  }

  /**
   * Handles scroll events on the scrollable container.
   * 
   * When the user scrolls past 80% of the total scroll height,
   * it increments the `pageNumber` in the component's state.
   * This is used to implement infinite scroll.
   */
  private onScroll = () => {
    const container = this.state.scrollableContainerRef.current
    if (container && container.scrollTop + container.clientHeight >= (0.8 * container.scrollHeight)) {
      this.setState((prev) => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
    }
  }

  /**
   * Generates the entire diff view.
   */
  private renderDiff = (): {
    diffNodes: ReactElement[];
    lineInformation: LineInformation[];
    blocks: Block[];
  } => {
    const { splitView, infiniteLoading } = this.props;
    const { computedDiffResult, pageNumber } = this.state
    const cacheKey = this.getMemoisedKey()
    const { lineInformation = [], lineBlocks = [], blocks = [] } = computedDiffResult[cacheKey] ?? {}
    let finalLineInformation = [...lineInformation]

    if (infiniteLoading) {
      finalLineInformation = lineInformation.slice(
        0,
        Math.min(infiniteLoading.pageSize * pageNumber, lineInformation.length)
      )
    }

    const diffNodes = finalLineInformation.map(
      (line: LineInformation, lineIndex: number) => {
        if (this.props.showDiffOnly) {
          const blockIndex = lineBlocks[lineIndex];

          if (blockIndex !== undefined) {
            const lastLineOfBlock = blocks[blockIndex].endLine === lineIndex;
            if (
              !this.state.expandedBlocks.includes(blockIndex) &&
              lastLineOfBlock
            ) {
              return (
                <React.Fragment key={lineIndex}>
                  {this.renderSkippedLineIndicator(
                    blocks[blockIndex].lines,
                    blockIndex,
                    line.left.lineNumber,
                    line.right.lineNumber,
                  )}
                </React.Fragment>
              );
            }
            if (!this.state.expandedBlocks.includes(blockIndex)) {
              return null;
            }
          }
        }

        return splitView
          ? this.renderSplitView(line, lineIndex)
          : this.renderInlineView(line, lineIndex);
      },
    );
    return {
      diffNodes,
      blocks,
      lineInformation,
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
      this.setState((prev) => ({
        ...prev,
        isLoading: true,
        pageNumber: 1
      }))
      this.memoisedCompute();
    }
  }

  componentDidMount() {
    this.setState((prev) => ({
      ...prev,
      isLoading: true,
      pageNumber: 1
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
      overflow: 'scroll',
      height: this.props.infiniteLoading.containerHeight
    } : {}

    return (
      <div
        style={{ ...scrollDivStyle, position: 'relative' }}
        onScroll={this.onScroll}
        ref={this.state.scrollableContainerRef}
      >
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
        {this.state.isLoading && LoadingElement && <LoadingElement />}
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
          <tbody>
            <tr>
              {!this.props.hideLineNumbers ? <td width={"50px"} /> : null}
              {!splitView && !this.props.hideLineNumbers ? (
                <td width={"50px"} />
              ) : null}
              {this.props.renderGutter ? <td width={"50px"} /> : null}
              <td width={"28px"} />
              <td width={"100%"} />
              {splitView ? (
                <>
                  {!this.props.hideLineNumbers ? <td width={"50px"} /> : null}
                  {this.props.renderGutter ? <td width={"50px"} /> : null}
                  <td width={"28px"} />
                  <td width={"100%"} />
                </>
              ) : null}
            </tr>
            {leftTitle || rightTitle ? (
              <tr>
                <th
                  colSpan={splitView ? colSpanOnSplitView : colSpanOnInlineView}
                  className={cn(this.styles.titleBlock, this.styles.column)}
                >
                  {leftTitle ? (
                    <pre className={this.styles.contentText}>{leftTitle}</pre>
                  ) : null}
                </th>
                {splitView ? (
                  <th
                    colSpan={colSpanOnSplitView}
                    className={cn(this.styles.titleBlock, this.styles.column)}
                  >
                    {rightTitle ? (
                      <pre className={this.styles.contentText}>
                        {rightTitle}
                      </pre>
                    ) : null}
                  </th>
                ) : null}
              </tr>
            ) : null}
            {nodes.diffNodes}
          </tbody>
        </table>
      </div>
    );
  };
}

export default DiffViewer;
export { DiffMethod };
export type { ReactDiffViewerStylesOverride };

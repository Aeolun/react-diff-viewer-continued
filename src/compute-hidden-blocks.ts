import { ReactElement } from "react";
import { DiffType, type LineInformation } from "./compute-lines";

export interface Block {
  index: number;
  startLine: number;
  endLine: number;
  lines: number;
}
interface HiddenBlocks {
  lineBlocks: Record<number, number>;
  blocks: Block[];
}
export function computeHiddenBlocks(
  lineInformation: LineInformation[],
  diffLines: number[],
  extraLines: number,
): HiddenBlocks {
  let newBlockIndex = 0;
  let currentBlock: Block | undefined;
  const lineBlocks: Record<number, number> = {};
  const blocks: Block[] = [];
  lineInformation.forEach((line, lineIndex) => {
    const isDiffLine = diffLines.some(
      (diffLine) =>
        diffLine >= lineIndex - extraLines &&
        diffLine <= lineIndex + extraLines,
    );
    if (!isDiffLine && currentBlock === undefined) {
      // block begins
      currentBlock = {
        index: newBlockIndex,
        startLine: lineIndex,
        endLine: lineIndex,
        lines: 1,
      };
      blocks.push(currentBlock);
      lineBlocks[lineIndex] = currentBlock.index;
      newBlockIndex++;
    } else if (!isDiffLine && currentBlock) {
      // block continues
      currentBlock.endLine = lineIndex;
      currentBlock.lines++;
      lineBlocks[lineIndex] = currentBlock.index;
    } else {
      // not a block anymore
      currentBlock = undefined;
    }
  });

  return {
    lineBlocks,
    blocks: blocks,
  };
}

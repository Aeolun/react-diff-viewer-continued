import { computeLineInformation } from "./compute-lines";

/**
 * This sets up a message handler inside the Web Worker.
 * When the main thread sends a message to this worker (via postMessage), this function is triggered.
 */
self.onmessage = (e) => {
  const { oldString, newString, disableWordDiff, lineCompareMethod, linesOffset, showLines, deferWordDiff } = e.data;
  const result = computeLineInformation(oldString, newString, disableWordDiff, lineCompareMethod, linesOffset, showLines, deferWordDiff);
  self.postMessage(result);
};

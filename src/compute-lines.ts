import * as diff from "diff";
import * as yaml from "js-yaml";

const jsDiff: { [key: string]: any } = diff;

export enum DiffType {
  DEFAULT = 0,
  ADDED = 1,
  REMOVED = 2,
  CHANGED = 3,
}

// Local interface for Change objects - more flexible than diff.Change which requires all properties
interface Change {
  value: string;
  added?: boolean;
  removed?: boolean;
  count?: number;
}

type Formatter = 'json' | 'yaml';

/**
 * Stringify a value using the specified format.
 */
function stringify(val: unknown, format: Formatter): string {
  if (format === 'yaml') {
    return yaml.dump(val, { indent: 2, lineWidth: -1, noRefs: true }).trimEnd();
  }
  return JSON.stringify(val, null, 2);
}

/**
 * Performs a fast structural diff on objects.
 *
 * Strategy: Use structural comparison to identify which subtrees changed,
 * then use diffLines only on those changed subtrees. This avoids running
 * the expensive O(ND) Myers diff on the entire content, while still producing
 * proper line-by-line diffs for the parts that changed.
 */
function structuralDiff(
  oldObj: unknown,
  newObj: unknown,
  format: Formatter = 'json'
): Change[] {
  const oldStr = stringify(oldObj, format);
  const newStr = stringify(newObj, format);

  // Fast path: identical objects
  if (oldStr === newStr) {
    return [{ value: oldStr }];
  }

  // Use recursive structural diff that applies diffLines to changed subtrees
  return diffStructurally(oldObj, newObj, 0, format);
}

/**
 * JSON diff that preserves key order from each object.
 * Uses structural comparison for performance.
 */
function structuralJsonDiff(oldObj: unknown, newObj: unknown): Change[] {
  return structuralDiff(oldObj, newObj, 'json');
}

/**
 * Optimized diff for JSON strings that preserves original formatting and key order.
 * Uses parsing only to check for structural equality (fast path),
 * then falls back to diffLines on original strings to preserve formatting.
 */
function structuralJsonStringDiff(oldJson: string, newJson: string): Change[] {
  try {
    // Parse JSON to check for structural equality
    const oldObj = JSON.parse(oldJson);
    const newObj = JSON.parse(newJson);

    // Fast path: check if structurally identical by comparing serialized forms
    const oldNormalized = JSON.stringify(oldObj);
    const newNormalized = JSON.stringify(newObj);

    if (oldNormalized === newNormalized) {
      // Structurally identical - return original string to preserve formatting
      return [{ value: oldJson }];
    }

    // Files differ - use diffLines on ORIGINAL strings to preserve key order and formatting
    return diff.diffLines(oldJson, newJson, {
      newlineIsToken: false,
    });
  } catch (e) {
    // If JSON parsing fails, fall back to line diff
    return diff.diffLines(oldJson, newJson, {
      newlineIsToken: false,
    });
  }
}

/**
 * Optimized diff for YAML that preserves original line numbers.
 * Uses parsing only to check for structural equality (fast path),
 * then falls back to diffLines on original strings to preserve line numbers.
 */
function structuralYamlDiff(oldYaml: string, newYaml: string): Change[] {
  // Parse YAML to check for structural equality
  const oldObj = yaml.load(oldYaml);
  const newObj = yaml.load(newYaml);

  // Fast path: check if structurally identical by comparing serialized forms
  const oldNormalized = yaml.dump(oldObj, { indent: 2, lineWidth: -1, noRefs: true });
  const newNormalized = yaml.dump(newObj, { indent: 2, lineWidth: -1, noRefs: true });

  if (oldNormalized === newNormalized) {
    // Structurally identical - return original string to preserve formatting
    return [{ value: oldYaml }];
  }

  // Files differ - use diffLines on ORIGINAL strings to preserve line numbers
  return diff.diffLines(oldYaml, newYaml, {
    newlineIsToken: false,
  });
}

/**
 * Recursively diff two values structurally.
 * For unchanged parts, output as-is.
 * For changed parts, use diffLines to get proper line-by-line diff.
 */
function diffStructurally(
  oldVal: unknown,
  newVal: unknown,
  indent: number,
  format: Formatter = 'json'
): Change[] {
  const oldStr = stringify(oldVal, format);
  const newStr = stringify(newVal, format);

  // Fast path: identical
  if (oldStr === newStr) {
    return [{ value: reindent(oldStr, indent, format) }];
  }

  // Both are objects - compare key by key
  if (
    typeof oldVal === 'object' && oldVal !== null &&
    typeof newVal === 'object' && newVal !== null &&
    !Array.isArray(oldVal) && !Array.isArray(newVal)
  ) {
    return diffObjects(
      oldVal as Record<string, unknown>,
      newVal as Record<string, unknown>,
      indent,
      format
    );
  }

  // Both are arrays - compare element by element
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return diffArrays(oldVal, newVal, indent, format);
  }

  // Different types or primitives - use diffLines for proper diff
  return diffWithLines(oldStr, newStr, indent, format);
}

/**
 * Diff two objects key by key.
 * Iterates in NEW key order to preserve the new file's structure,
 * then appends any old-only keys as removed.
 */
function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  indent: number,
  format: Formatter = 'json'
): Change[] {
  const changes: Change[] = [];
  const indentStr = '  '.repeat(indent);
  const innerIndent = '  '.repeat(indent + 1);

  const oldKeySet = new Set(Object.keys(oldObj));
  const newKeys = Object.keys(newObj);

  // Build ordered key list: new keys in their order, then old-only keys
  const oldOnlyKeys = [...oldKeySet].filter(k => !(k in newObj));
  const allKeys = [...newKeys, ...oldOnlyKeys];

  changes.push({ value: '{\n' });

  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    const isLast = i === allKeys.length - 1;
    const comma = isLast ? '' : ',';
    const inOld = key in oldObj;
    const inNew = key in newObj;

    if (inOld && inNew) {
      // Key in both - recursively diff values
      const oldValStr = stringify(oldObj[key], format);
      const newValStr = stringify(newObj[key], format);

      if (oldValStr === newValStr) {
        // Values identical
        const valueStr = reindent(oldValStr, indent + 1);
        changes.push({ value: innerIndent + JSON.stringify(key) + ': ' + valueStr + comma + '\n' });
      } else {
        // Values differ - recursively diff them
        const keyPrefix = innerIndent + JSON.stringify(key) + ': ';
        const valueDiff = diffStructurally(oldObj[key], newObj[key], indent + 1, format);

        // Prepend key to first change so they're on the same line
        if (valueDiff.length > 0) {
          valueDiff[0].value = keyPrefix + valueDiff[0].value;
        }

        // Add comma to last change if needed
        if (comma && valueDiff.length > 0) {
          const last = valueDiff[valueDiff.length - 1];
          last.value = last.value.replace(/\n$/, comma + '\n');
        }
        changes.push(...valueDiff);
      }
    } else if (inOld) {
      // Key only in old - removed
      const valueStr = reindent(stringify(oldObj[key], format), indent + 1);
      changes.push({ removed: true, value: innerIndent + JSON.stringify(key) + ': ' + valueStr + comma + '\n' });
    } else {
      // Key only in new - added
      const valueStr = reindent(stringify(newObj[key], format), indent + 1);
      changes.push({ added: true, value: innerIndent + JSON.stringify(key) + ': ' + valueStr + comma + '\n' });
    }
  }

  changes.push({ value: indentStr + '}\n' });
  return changes;
}

/**
 * Diff two arrays element by element.
 */
function diffArrays(
  oldArr: unknown[],
  newArr: unknown[],
  indent: number,
  format: Formatter = 'json'
): Change[] {
  const changes: Change[] = [];
  const indentStr = '  '.repeat(indent);
  const innerIndent = '  '.repeat(indent + 1);

  changes.push({ value: '[\n' });

  const maxLen = Math.max(oldArr.length, newArr.length);

  for (let i = 0; i < maxLen; i++) {
    const isLast = i === maxLen - 1;
    const comma = isLast ? '' : ',';

    if (i >= oldArr.length) {
      // Element only in new - added
      const valueStr = reindent(stringify(newArr[i], format), indent + 1);
      changes.push({ added: true, value: innerIndent + valueStr + comma + '\n' });
    } else if (i >= newArr.length) {
      // Element only in old - removed
      const valueStr = reindent(stringify(oldArr[i], format), indent + 1);
      changes.push({ removed: true, value: innerIndent + valueStr + comma + '\n' });
    } else {
      // Element in both - recursively diff
      const oldElemStr = stringify(oldArr[i], format);
      const newElemStr = stringify(newArr[i], format);

      if (oldElemStr === newElemStr) {
        // Elements identical
        const valueStr = reindent(oldElemStr, indent + 1);
        changes.push({ value: innerIndent + valueStr + comma + '\n' });
      } else {
        // Elements differ - recursively diff them
        const elemDiff = diffStructurally(oldArr[i], newArr[i], indent + 1, format);

        // Prepend indent to first change so they're on the same line
        if (elemDiff.length > 0) {
          elemDiff[0].value = innerIndent + elemDiff[0].value;
        }

        // Add comma to last change if needed
        if (comma && elemDiff.length > 0) {
          const last = elemDiff[elemDiff.length - 1];
          last.value = last.value.replace(/\n$/, comma + '\n');
        }
        changes.push(...elemDiff);
      }
    }
  }

  changes.push({ value: indentStr + ']\n' });
  return changes;
}

/**
 * Use diffLines for proper line-by-line diff of two strings.
 * This is the fallback for when structural comparison finds different values.
 */
function diffWithLines(oldStr: string, newStr: string, indent: number, _format: Formatter = 'json'): Change[] {
  const oldIndented = reindent(oldStr, indent);
  const newIndented = reindent(newStr, indent);

  // Use diffLines for proper line-level comparison
  const lineDiff = diff.diffLines(oldIndented, newIndented);

  return lineDiff.map(change => ({
    value: change.value,
    added: change.added,
    removed: change.removed
  }));
}

/**
 * Re-indent a string to the specified level.
 */
function reindent(str: string, indent: number, _format: Formatter = 'json'): string {
  if (indent === 0) return str;
  const indentStr = '  '.repeat(indent);
  return str.split('\n').map((line, i) =>
    i === 0 ? line : indentStr + line
  ).join('\n');
}

// See https://github.com/kpdecker/jsdiff/tree/v4.0.1#api for more info on the below JsDiff methods
export enum DiffMethod {
  CHARS = "diffChars",
  WORDS = "diffWords",
  WORDS_WITH_SPACE = "diffWordsWithSpace",
  LINES = "diffLines",
  TRIMMED_LINES = "diffTrimmedLines",
  SENTENCES = "diffSentences",
  CSS = "diffCss",
  JSON = "diffJson",
  YAML = "diffYaml",
}

export interface DiffInformation {
  value?: string | DiffInformation[];
  lineNumber?: number;
  type?: DiffType;
  // For deferred word diff computation - stores raw strings
  rawValue?: string;
}

export interface LineInformation {
  left?: DiffInformation;
  right?: DiffInformation;
}

export interface ComputedLineInformation {
  lineInformation: LineInformation[];
  diffLines: number[];
}

export interface ComputedDiffInformation {
  left?: DiffInformation[];
  right?: DiffInformation[];
}

// See https://github.com/kpdecker/jsdiff/tree/v4.0.1#change-objects for more info on JsDiff
// Change Objects
export interface JsDiffChangeObject {
  added?: boolean;
  removed?: boolean;
  value?: string;
}

/**
 * Splits diff text by new line and computes final list of diff lines based on
 * conditions.
 *
 * @param value Diff text from the js diff module.
 */
const constructLines = (value: string): string[] => {
  if (value === "") return [];

  const lines = value.replace(/\n$/, "").split("\n");

  return lines;
};

/**
 * Computes word diff information in the line.
 * [TODO]: Consider adding options argument for JsDiff text block comparison
 *
 * @param oldValue Old word in the line.
 * @param newValue New word in the line.
 * @param compareMethod JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
 */
const computeDiff = (
  oldValue: string | Record<string, unknown>,
  newValue: string | Record<string, unknown>,
  compareMethod:
    | DiffMethod
    | ((oldStr: string, newStr: string) => diff.Change[]) = DiffMethod.CHARS,
): ComputedDiffInformation => {
  const compareFunc =
    typeof compareMethod === "string" ? jsDiff[compareMethod] : compareMethod;
  const diffArray: JsDiffChangeObject[] = compareFunc(oldValue, newValue);
  const computedDiff: ComputedDiffInformation = {
    left: [],
    right: [],
  };
  diffArray.forEach(({ added, removed, value }): DiffInformation => {
    const diffInformation: DiffInformation = {};
    if (added) {
      diffInformation.type = DiffType.ADDED;
      diffInformation.value = value;
      computedDiff.right.push(diffInformation);
    }
    if (removed) {
      diffInformation.type = DiffType.REMOVED;
      diffInformation.value = value;
      computedDiff.left.push(diffInformation);
    }
    if (!removed && !added) {
      diffInformation.type = DiffType.DEFAULT;
      diffInformation.value = value;
      computedDiff.right.push(diffInformation);
      computedDiff.left.push(diffInformation);
    }
    return diffInformation;
  });
  return computedDiff;
};

/**
 * [TODO]: Think about moving common left and right value assignment to a
 * common place. Better readability?
 *
 * Computes line wise information based in the js diff information passed. Each
 * line contains information about left and right section. Left side denotes
 * deletion and right side denotes addition.
 *
 * @param oldString Old string to compare.
 * @param newString New string to compare with old string.
 * @param disableWordDiff Flag to enable/disable word diff.
 * @param lineCompareMethod JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
 * @param linesOffset line number to start counting from
 * @param showLines lines that are always shown, regardless of diff
 */
const computeLineInformation = (
  oldString: string | Record<string, unknown>,
  newString: string | Record<string, unknown>,
  disableWordDiff = false,
  lineCompareMethod:
    | DiffMethod
    | ((oldStr: string, newStr: string) => diff.Change[]) = DiffMethod.CHARS,
  linesOffset = 0,
  showLines: string[] = [],
  deferWordDiff = false,
): ComputedLineInformation => {
  let diffArray: Change[] = [];

  // Handle different input types and compare methods
  if (typeof oldString === "string" && typeof newString === "string") {
    // Check if we should use structural diff for JSON or YAML
    if (lineCompareMethod === DiffMethod.JSON) {
      // Use JSON structural diff - preserves original formatting and key order
      diffArray = structuralJsonStringDiff(oldString, newString);
    } else if (lineCompareMethod === DiffMethod.YAML) {
      try {
        // Use YAML structural diff - parses, normalizes, and outputs as YAML
        diffArray = structuralYamlDiff(oldString, newString);
      } catch (e) {
        // If YAML parsing fails, fall back to line diff
        diffArray = diff.diffLines(oldString, newString, {
          newlineIsToken: false,
        });
      }
    } else {
      diffArray = diff.diffLines(oldString, newString, {
        newlineIsToken: false,
      });
    }
  } else {
    // Use our fast structural JSON diff instead of diff.diffJson
    // This is O(n) for structure comparison vs O(ND) for Myers on large strings
    diffArray = structuralJsonDiff(oldString, newString);
  }

  let rightLineNumber = linesOffset;
  let leftLineNumber = linesOffset;
  let lineInformation: LineInformation[] = [];
  let counter = 0;
  const diffLines: number[] = [];
  const ignoreDiffIndexes: string[] = [];
  const getLineInformation = (
    value: string,
    diffIndex: number,
    added?: boolean,
    removed?: boolean,
    evaluateOnlyFirstLine?: boolean,
  ): LineInformation[] => {
    const lines = constructLines(value);

    return lines
      .map((line: string, lineIndex): LineInformation => {
        const left: DiffInformation = {};
        const right: DiffInformation = {};
        if (
          ignoreDiffIndexes.includes(`${diffIndex}-${lineIndex}`) ||
          (evaluateOnlyFirstLine && lineIndex !== 0)
        ) {
          return undefined;
        }
        if (added || removed) {
          let countAsChange = true;
          if (removed) {
            leftLineNumber += 1;
            left.lineNumber = leftLineNumber;
            left.type = DiffType.REMOVED;
            left.value = line || " ";
            // When the current line is of type REMOVED, check the next item in
            // the diff array whether it is of type ADDED. If true, the current
            // diff will be marked as both REMOVED and ADDED. Meaning, the
            // current line is a modification.
            const nextDiff = diffArray[diffIndex + 1];
            if (nextDiff?.added) {
              const nextDiffLines = constructLines(nextDiff.value)[lineIndex];
              if (nextDiffLines) {
                const nextDiffLineInfo = getLineInformation(
                  nextDiffLines,
                  diffIndex,
                  true,
                  false,
                  true,
                );

                const {
                  value: rightValue,
                  lineNumber,
                  type,
                } = nextDiffLineInfo[0].right;

                // When identified as modification, push the next diff to ignore
                // list as the next value will be added in this line computation as
                // right and left values.
                ignoreDiffIndexes.push(`${diffIndex + 1}-${lineIndex}`);

                right.lineNumber = lineNumber;
                if (left.value === rightValue) {
                  // The new value is exactly the same as the old
                  countAsChange = false;
                  right.type = 0;
                  left.type = 0;
                  right.value = rightValue;
                } else {
                  right.type = type;
                  // Do char level diff and assign the corresponding values to the
                  // left and right diff information object.
                  // Skip word diff for very long lines (>500 chars) to avoid performance issues
                  const MAX_LINE_LENGTH_FOR_WORD_DIFF = 500;
                  const lineIsTooLong = line.length > MAX_LINE_LENGTH_FOR_WORD_DIFF ||
                    (rightValue as string).length > MAX_LINE_LENGTH_FOR_WORD_DIFF;

                  if (disableWordDiff || lineIsTooLong) {
                    right.value = rightValue;
                  } else if (deferWordDiff) {
                    // Store raw values for deferred word diff computation
                    left.rawValue = line;
                    left.value = line;
                    right.rawValue = rightValue as string;
                    right.value = rightValue;
                  } else {
                    const computedDiff = computeDiff(
                      line,
                      rightValue as string,
                      lineCompareMethod,
                    );
                    right.value = computedDiff.right;
                    left.value = computedDiff.left;
                  }
                }
              }
            }
          } else {
            rightLineNumber += 1;
            right.lineNumber = rightLineNumber;
            right.type = DiffType.ADDED;
            right.value = line;
          }
          if (countAsChange && !evaluateOnlyFirstLine) {
            if (!diffLines.includes(counter)) {
              diffLines.push(counter);
            }
          }
        } else {
          leftLineNumber += 1;
          rightLineNumber += 1;

          left.lineNumber = leftLineNumber;
          left.type = DiffType.DEFAULT;
          left.value = line;
          right.lineNumber = rightLineNumber;
          right.type = DiffType.DEFAULT;
          right.value = line;
        }

        if (
          showLines?.includes(`L-${left.lineNumber}`) ||
          (showLines?.includes(`R-${right.lineNumber}`) &&
            !diffLines.includes(counter))
        ) {
          diffLines.push(counter);
        }

        if (!evaluateOnlyFirstLine) {
          counter += 1;
        }
        return { right, left };
      })
      .filter(Boolean);
  };

  diffArray.forEach(({ added, removed, value }: diff.Change, index): void => {
    lineInformation = [
      ...lineInformation,
      ...getLineInformation(value, index, added, removed),
    ];
  });

  return {
    lineInformation,
    diffLines,
  };
};

/**
 * Computes line diff information using a Web Worker to avoid blocking the UI thread.
 * This offloads the expensive `computeLineInformation` logic to a separate thread.
 *
 * @param oldString Old string to compare.
 * @param newString New string to compare with old string.
 * @param disableWordDiff Flag to enable/disable word diff.
 * @param lineCompareMethod JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
 * @param linesOffset line number to start counting from
 * @param showLines lines that are always shown, regardless of diff
 * @returns Promise<ComputedLineInformation> - Resolves with line-by-line diff data from the worker.
 */
const computeLineInformationWorker = (
  oldString: string | Record<string, unknown>,
  newString: string | Record<string, unknown>,
  disableWordDiff = false,
  lineCompareMethod:
    | DiffMethod
    | ((oldStr: string, newStr: string) => diff.Change[]) = DiffMethod.CHARS,
  linesOffset = 0,
  showLines: string[] = [],
  deferWordDiff = false
): Promise<ComputedLineInformation> => {
  // Fall back to synchronous computation if Worker is not available (e.g., in Node.js/test environments)
  if (typeof Worker === 'undefined') {
    return Promise.resolve(
      computeLineInformation(oldString, newString, disableWordDiff, lineCompareMethod, linesOffset, showLines, deferWordDiff)
    );
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./computeWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    worker.postMessage({ oldString, newString, disableWordDiff, lineCompareMethod, linesOffset, showLines, deferWordDiff });
  });
};


export { computeLineInformation, computeLineInformationWorker, computeDiff };

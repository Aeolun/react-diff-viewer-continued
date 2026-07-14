/**
 * @vitest-environment happy-dom
 *
 * Regression repros for open GitHub issues.
 *
 * Each test encodes the CORRECT behaviour, so:
 *   - test passes  => the reported bug does NOT reproduce on current code (likely fixed)
 *   - test fails   => the bug is still present
 *
 * Issue links: https://github.com/Aeolun/react-diff-viewer-continued/issues/<n>
 */

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DiffViewer, { DiffMethod } from "../src/index";
import {
  computeLineInformation,
  DiffType,
} from "../src/compute-lines";

describe("#59 — empty lines show up as \"different\"", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/59
  it("identical text containing blank lines has zero diff lines", () => {
    const text = `
    Text1


    Text1
    `;
    const { diffLines, lineInformation } = computeLineInformation(text, text);

    expect(diffLines).toEqual([]);
    for (const line of lineInformation) {
      expect(line.left.type).toBe(DiffType.DEFAULT);
      expect(line.right.type).toBe(DiffType.DEFAULT);
    }
  });

  it("a blank line added between identical content is the only change", () => {
    const oldText = "a\nb";
    const newText = "a\n\nb";
    const { diffLines } = computeLineInformation(oldText, newText);
    // Exactly one added (blank) line, not a wholesale mismatch.
    expect(diffLines.length).toBe(1);
  });
});

describe("#18 — compareMethod not highlighting trailing whitespace", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/18
  it("WORDS_WITH_SPACE marks a removed trailing space", () => {
    const { lineInformation } = computeLineInformation(
      "foo bar ",
      "foo bar",
      false,
      DiffMethod.WORDS_WITH_SPACE,
    );

    const left = lineInformation[0].left;
    expect(Array.isArray(left.value)).toBe(true);
    const segments = left.value as { type: DiffType; value: string }[];
    const removedSpace = segments.find(
      (s) => s.type === DiffType.REMOVED && s.value === " ",
    );
    expect(removedSpace).toBeDefined();
  });
});

describe("#19 — JSON diff throws on unparseable input", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/19
  it("DiffMethod.JSON on malformed JSON does not throw and still diffs", () => {
    const oldJson = '{"a": 1, "b": 2}';
    const brokenJson = '{"a": 1 "b": 3}'; // missing comma

    let result: ReturnType<typeof computeLineInformation> | undefined;
    expect(() => {
      result = computeLineInformation(
        oldJson,
        brokenJson,
        false,
        DiffMethod.JSON,
      );
    }).not.toThrow();

    // Falls back to text diff and still reports a difference.
    expect(result?.diffLines.length).toBeGreaterThan(0);
  });
});

describe("#20 — XML difference not working", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/20
  it("produces a word-level diff on the changed XML element", () => {
    const oldXml = "<root>\n  <a>1</a>\n  <b>2</b>\n</root>";
    const newXml = "<root>\n  <a>1</a>\n  <b>3</b>\n</root>";
    const { diffLines, lineInformation } = computeLineInformation(
      oldXml,
      newXml,
    );

    // Only the <b> line differs.
    expect(diffLines).toEqual([2]);
    const changed = lineInformation.find(
      (l) => l.left.type === DiffType.REMOVED,
    );
    expect(changed).toBeDefined();
  });
});

describe("#72 — same function name confuses the diff algorithm", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/72
  // The issue only provides screenshots; this is a representative reconstruction:
  // an identical function is inserted above an existing one with the same name.
  it("aligns the shared function body instead of scrambling it", () => {
    const oldCode = "function foo() {\n  return 1;\n}\n";
    const newCode =
      "function foo() {\n  return 2;\n}\nfunction foo() {\n  return 1;\n}\n";

    const { diffLines, lineInformation } = computeLineInformation(
      oldCode,
      newCode,
    );

    // Optimal diff = 3 inserted lines (the new block), nothing removed.
    expect(diffLines).toEqual([1, 2, 3]);
    const anyRemoved = lineInformation.some(
      (l) => l.left.type === DiffType.REMOVED || l.left.type === DiffType.CHANGED,
    );
    expect(anyRemoved).toBe(false);
  });
});

describe("#44 — highlighter crashes on empty lines in split view", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/44
  const oldCode = "const a = 1;\n\n\nconst b = 2;";
  const newCode = "const a = 1;\n\n\nconst c = 3;";

  it("renders split view containing empty lines with a renderContent highlighter", async () => {
    // Simulates a Prism-style highlighter that receives every line, including "".
    const renderContent = (source: string) => <span>{source}</span>;

    expect(() => {
      render(
        <DiffViewer
          oldValue={oldCode}
          newValue={newCode}
          splitView={true}
          renderContent={renderContent}
        />,
      );
    }).not.toThrow();
  });

  it("empty-line handling does not blow up the built-in highlighter", async () => {
    const node = render(
      <DiffViewer
        oldValue={oldCode}
        newValue={newCode}
        splitView={true}
        highlightLanguage="javascript"
      />,
    );
    await waitFor(() => {
      // The async highlight pass has resolved and re-rendered without throwing.
      expect(node.getAllByRole("table").length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("#38 — large inputs are slow / crash", () => {
  // https://github.com/Aeolun/react-diff-viewer-continued/issues/38
  it("computes line information for a ~12k line input without crashing", () => {
    const lines = Array.from({ length: 12000 }, (_, i) => `line ${i}`);
    const oldText = lines.join("\n");
    // Change one line deep in the file.
    const changed = [...lines];
    changed[6000] = "line 6000 CHANGED";
    const newText = changed.join("\n");

    const start = Date.now();
    const { diffLines } = computeLineInformation(oldText, newText);
    const elapsed = Date.now() - start;

    expect(diffLines.length).toBeGreaterThan(0);
    // Not a hard perf assertion — just a canary that it terminates quickly.
    expect(elapsed).toBeLessThan(5000);
  });
});

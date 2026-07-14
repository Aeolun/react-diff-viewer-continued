/**
 * @vitest-environment happy-dom
 */

import { render, waitFor } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";

import DiffViewer, { DiffMethod } from "../src/index";

const oldCode = `
const a = 123
const b = 456
const c = 4556
const d = 4566
const e = () => {
  console.log('c')
}
`;

const newCode = `
const a = 123
const b = 456
const c = 4556
const d = 4566
const aa = 123
const bb = 456
`;

describe("Testing react diff viewer", (): void => {
  it("It should render a table", (): void => {
    const node = render(<DiffViewer oldValue={oldCode} newValue={newCode} />);

    expect(node.getAllByRole("table").length).toEqual(1);
  });

  it("It should render diff lines in diff view", async (): Promise<void> => {
    const node = render(<DiffViewer oldValue={oldCode} newValue={newCode} />);

    await waitFor(() => {
      // 12 rows: 6 context lines (3 before, 3 after each diff) + 6 diff lines
      // (fold indicators have role="button" and don't count as rows)
      expect(node.getAllByRole("row").length).toEqual(12);
    });
  });

  it("It should render diff lines in inline view", async (): Promise<void> => {
    const node = render(
      <DiffViewer oldValue={oldCode} newValue={newCode} splitView={false} />,
    );

    await waitFor(() => {
      // 20 rows in inline view (fold indicators have role="button")
      expect(node.getAllByRole("row").length).toEqual(20);
    });
  });

  it("Should handle very long noisy lines efficiently (>500 chars)", async (): Promise<void> => {
    // Generate 5000 character lines with completely different content
    const generateNoisyLine = (seed: number): string => {
      const chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
      let result = "";
      for (let i = 0; i < 5000; i++) {
        result += chars[(i * seed) % chars.length];
      }
      return result;
    };

    const oldLongLine = generateNoisyLine(7);
    const newLongLine = generateNoisyLine(13);

    // They should be completely different
    expect(oldLongLine).not.toEqual(newLongLine);
    expect(oldLongLine.length).toBe(5000);

    const start = performance.now();
    const node = render(
      <DiffViewer
        oldValue={oldLongLine}
        newValue={newLongLine}
        compareMethod={DiffMethod.CHARS}
      />,
    );

    await waitFor(() => {
      // Just verify it rendered something
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    const duration = performance.now() - start;

    // Should complete in under 2 seconds - the optimization skips word diff for long lines
    expect(duration).toBeLessThan(2000);
  });

  it("Should not render 'undefined' when renderContent returns HTML with &#x27; entities", async (): Promise<void> => {
    // Simulates highlight.js output which encodes apostrophes as &#x27;
    // This was the root cause of the "undefinedundefined..." suffix bug
    const oldValue = "const x = 'hello'";
    const newValue = "const x = 'world'";

    // Simulate a syntax highlighter (like highlight.js) that encodes
    // apostrophes as &#x27; instead of &#39;
    const renderContent = (str: string): React.ReactElement => {
      const html = str.replace(/'/g, "&#x27;");
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        renderContent={renderContent}
      />,
    );

    await waitFor(() => {
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    const allContent = node.container.textContent || "";
    expect(allContent).not.toContain("undefined");
  });

  it("Should not render 'undefined' with multiple apostrophes in renderContent HTML", async (): Promise<void> => {
    const oldValue = "it's a 'test' isn't it";
    const newValue = "it's a 'change' isn't it";

    const renderContent = (str: string): React.ReactElement => {
      const html = str.replace(/'/g, "&#x27;");
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        renderContent={renderContent}
      />,
    );

    await waitFor(() => {
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    const allContent = node.container.textContent || "";
    expect(allContent).not.toContain("undefined");
  });

  it("Peels a line's leading whitespace into a separate indent element", async (): Promise<void> => {
    // A changed line that shares its indentation: only the tail differs.
    const oldValue = "        <p>hello</p>";
    const newValue = "        <p>world</p>";

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
      />,
    );

    await waitFor(() => {
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    const indents = node.container.querySelectorAll('[class*="line-indent"]');
    // Both panes render the indented line, so we expect at least one indent column.
    expect(indents.length).toBeGreaterThan(0);
    for (const el of indents) {
      // The indent column carries only whitespace — never content.
      expect(el.textContent).toMatch(/^[ \t]+$/);
    }

    const bodies = node.container.querySelectorAll('[class*="line-body"]');
    for (const el of bodies) {
      // The body never starts with the peeled leading whitespace.
      expect(el.textContent ?? "").not.toMatch(/^[ \t]/);
    }

    // The full line text is still intact (indent + body reassemble losslessly).
    expect(node.container.textContent).toContain("        <p>world</p>");
    expect(node.container.textContent).not.toContain("undefined");
  });

  it("Trims leading whitespace before handing content to renderContent", async (): Promise<void> => {
    // Identical inputs render as context lines through the string + renderContent path.
    const value = "    keepme";
    const seen: string[] = [];
    const renderContent = (str: string): React.ReactElement => {
      seen.push(str);
      return <span>{str}</span>;
    };

    const node = render(
      <DiffViewer
        oldValue={value}
        newValue={value}
        showDiffOnly={false}
        renderContent={renderContent}
      />,
    );

    await waitFor(() => {
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    // Peeling happens before highlighting, so the renderer sees trimmed content...
    expect(seen).toContain("keepme");
    // ...and is never handed leading whitespace.
    expect(seen.every((str) => !/^[ \t]/.test(str))).toBe(true);
  });

  it("Should render JSON diff with keys preserved", async (): Promise<void> => {
    const oldObj = {
      data: {
        key1: "value1",
        key2: "value2",
      },
    };

    const newObj = {
      data: {
        newkey: "newvalue",
        key1: "value2",
        key2: "value2",
      },
    };

    const node = render(
      <DiffViewer
        oldValue={oldObj}
        newValue={newObj}
        compareMethod={DiffMethod.JSON}
      />,
    );

    await waitFor(() => {
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    // Get all the rendered content
    const allContent = node.container.textContent || "";

    // Check that we don't have orphan values without keys
    // The content should NOT have "value2" appearing without "key1:" before it
    const lines = allContent.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      // Check for orphan values - a line that's just "value2" or "value2," without a key
      expect(trimmed).not.toMatch(/^"value\d+"[,]?$/);
    }
  });
});

describe("First-party syntax highlighting (highlightLanguage)", (): void => {
  // A style attribute is only emitted on token spans/ins/del that carry a colour,
  // so this is a reliable "highlighting is active" probe.
  const coloured = (container: HTMLElement): Element[] =>
    Array.from(container.querySelectorAll('[style*="color"]'));

  it("merges highlight colour with word-diff marks on a changed line", async (): Promise<void> => {
    const oldValue = '<a class="primary">link</a>';
    const newValue = '<a class="secondary">link</a>';

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        highlightLanguage="markup"
      />,
    );

    // Wait until the grammar has loaded and colours have been applied.
    await waitFor(() => {
      expect(coloured(node.container).length).toBeGreaterThan(0);
    });

    // The changed word ("primary" -> "secondary") still carries a word-diff mark...
    const wordMarks = node.container.querySelectorAll(
      '[class*="word-added"], [class*="word-removed"]',
    );
    expect(wordMarks.length).toBeGreaterThan(0);
    // ...and at least one of those marks is itself coloured (colour + diff together).
    const colouredMark = Array.from(wordMarks).some((el) =>
      (el.getAttribute("style") ?? "").includes("color"),
    );
    expect(colouredMark).toBe(true);

    // Text is intact and nothing leaked as "undefined".
    expect(node.container.textContent).toContain("secondary");
    expect(node.container.textContent).not.toContain("undefined");
  });

  it("highlights lines around a multi-line construct (whole-side state)", async (): Promise<void> => {
    // A template literal spans two physical lines; per-line highlighting would
    // mis-tokenise the continuation line. Whole-side highlighting keeps it a string.
    const oldValue = "const s = `line one\nline two`\nconst n = 1\n";
    const newValue = "const s = `line one\nline two`\nconst n = 2\n";

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        showDiffOnly={false}
        highlightLanguage="javascript"
      />,
    );

    await waitFor(() => {
      expect(coloured(node.container).length).toBeGreaterThan(0);
    });

    // The continuation line ("line two`") is a context line, not the changed one;
    // it is coloured only if the whole side was tokenised in one pass.
    const continuation = coloured(node.container).some((el) =>
      (el.textContent ?? "").includes("line two"),
    );
    expect(continuation).toBe(true);
    expect(node.container.textContent).not.toContain("undefined");
  });

  it("takes precedence over renderContent", async (): Promise<void> => {
    const oldValue = '<a class="primary">link</a>';
    const newValue = '<a class="secondary">link</a>';

    const renderContent = (str: string): React.ReactElement => (
      <span className="rc-marker">{str}</span>
    );

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        highlightLanguage="markup"
        renderContent={renderContent}
      />,
    );

    // Once highlighting is active, content comes from the internal path...
    await waitFor(() => {
      expect(coloured(node.container).length).toBeGreaterThan(0);
    });
    // ...and renderContent's output is gone from the final render.
    expect(node.container.querySelector(".rc-marker")).toBeNull();
  });

  it("with disableWordDiff: colours the line but adds no word-diff marks", async (): Promise<void> => {
    const oldValue = '<a class="primary">link</a>';
    const newValue = '<a class="secondary">link</a>';

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        disableWordDiff
        highlightLanguage="markup"
      />,
    );

    await waitFor(() => {
      expect(coloured(node.container).length).toBeGreaterThan(0);
    });

    // No word-level add/remove marks when word diff is disabled.
    expect(
      node.container.querySelectorAll(
        '[class*="word-added"], [class*="word-removed"]',
      ).length,
    ).toBe(0);
    expect(node.container.textContent).toContain("secondary");
  });

  it("falls back gracefully for an unknown language", async (): Promise<void> => {
    const oldValue = "const a = 1";
    const newValue = "const a = 2";

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        highlightLanguage="totally-not-a-language"
      />,
    );

    await waitFor(() => {
      expect(node.container.querySelector("table")).toBeTruthy();
    });

    // No crash, content intact, and no highlight colours were applied.
    expect(node.container.textContent).toContain("const a =");
    expect(node.container.textContent).not.toContain("undefined");
    // Give any (unexpected) async highlight a tick; there should still be none.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(coloured(node.container).length).toBe(0);
  });

  it("keeps the indent peel while highlighting the body", async (): Promise<void> => {
    const oldValue = '        <p class="a">hi</p>';
    const newValue = '        <p class="b">hi</p>';

    const node = render(
      <DiffViewer
        oldValue={oldValue}
        newValue={newValue}
        compareMethod={DiffMethod.WORDS_WITH_SPACE}
        highlightLanguage="markup"
      />,
    );

    await waitFor(() => {
      expect(coloured(node.container).length).toBeGreaterThan(0);
    });

    // The indent column still carries only whitespace.
    const indents = node.container.querySelectorAll('[class*="line-indent"]');
    expect(indents.length).toBeGreaterThan(0);
    for (const el of indents) {
      expect(el.textContent).toMatch(/^[ \t]+$/);
    }

    // The body is coloured and never begins with the peeled whitespace.
    const bodies = node.container.querySelectorAll('[class*="line-body"]');
    for (const el of bodies) {
      expect(el.textContent ?? "").not.toMatch(/^[ \t]/);
    }
    const bodyColoured = Array.from(bodies).some((body) =>
      body.querySelector('[style*="color"]'),
    );
    expect(bodyColoured).toBe(true);
  });
});

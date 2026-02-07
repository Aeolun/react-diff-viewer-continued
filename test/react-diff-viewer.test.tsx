/**
 * @vitest-environment happy-dom
 */

import { render, waitFor } from "@testing-library/react";
import * as React from "react";
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
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
      let result = '';
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
    console.log(`Long noisy line diff (5000 chars, completely different): ${duration.toFixed(2)}ms`);

    // Should complete in under 2 seconds - the optimization skips word diff for long lines
    expect(duration).toBeLessThan(2000);
  });

  it("Should render JSON diff with keys preserved", async (): Promise<void> => {
    const oldObj = {
      data: {
        key1: "value1",
        key2: "value2"
      }
    };

    const newObj = {
      data: {
        newkey: "newvalue",
        key1: "value2",
        key2: "value2"
      }
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
    const allContent = node.container.textContent || '';
    console.log("=== Rendered JSON Diff Content ===");
    console.log(allContent);

    // Check that we don't have orphan values without keys
    // The content should NOT have "value2" appearing without "key1:" before it
    const lines = allContent.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      // Check for orphan values - a line that's just "value2" or "value2," without a key
      if (trimmed.match(/^"value\d+"[,]?$/)) {
        console.error(`ORPHAN VALUE IN RENDERED OUTPUT: ${trimmed}`);
        expect(trimmed).not.toMatch(/^"value\d+"[,]?$/);
      }
    }
  });
});

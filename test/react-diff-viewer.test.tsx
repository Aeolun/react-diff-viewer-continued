/**
 * @vitest-environment happy-dom
 */

import { render, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import DiffViewer from "../src/index";

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
      // 14 rows: 1 fold indicator + 6 context lines (3 before, 3 after each diff) + 7 diff lines
      expect(node.getAllByRole("row").length).toEqual(14);
    });
  });

  it("It should render diff lines in inline view", async (): Promise<void> => {
    const node = render(
      <DiffViewer oldValue={oldCode} newValue={newCode} splitView={false} />,
    );

    await waitFor(() => {
      // 23 rows in inline view with code folding
      expect(node.getAllByRole("row").length).toEqual(23);
    });
  });
});

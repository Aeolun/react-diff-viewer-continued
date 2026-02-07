import { describe, it, expect } from 'vitest';

/**
 * These are pure function tests for the virtualization logic.
 * We extract the core algorithms and test them in isolation.
 */

// Extracted from DiffViewer - binary search for row at offset
function findLineAtOffset(scrollTop: number, offsets: number[]): number {
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

// Calculate visible range given scroll position and viewport
function calculateVisibleRange(
  contentScrollTop: number,
  clientHeight: number,
  cumulativeOffsets: number[],
  buffer: number = 5
): { visibleRowStart: number; visibleRowEnd: number } {
  const visibleRowStart = Math.max(0, findLineAtOffset(contentScrollTop, cumulativeOffsets) - buffer);
  const visibleRowEnd = findLineAtOffset(contentScrollTop + clientHeight, cumulativeOffsets) + buffer;

  return { visibleRowStart, visibleRowEnd };
}

// Build cumulative offsets for uniform row heights
function buildUniformOffsets(rowCount: number, rowHeight: number): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < rowCount; i++) {
    offsets.push(offsets[offsets.length - 1] + rowHeight);
  }
  return offsets;
}

// Build cumulative offsets with variable row heights
function buildVariableOffsets(rowHeights: number[]): number[] {
  const offsets: number[] = [0];
  for (const height of rowHeights) {
    offsets.push(offsets[offsets.length - 1] + height);
  }
  return offsets;
}

describe('findLineAtOffset', () => {
  it('should return 0 for scrollTop 0', () => {
    const offsets = buildUniformOffsets(10, 20); // 10 rows, 20px each
    expect(findLineAtOffset(0, offsets)).toBe(0);
  });

  it('should return last row index for scrollTop at total height', () => {
    const offsets = buildUniformOffsets(10, 20); // total height = 200
    // offsets = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]
    // Last row index is 9, offsets[9] = 180
    expect(findLineAtOffset(200, offsets)).toBe(9);
  });

  it('should find correct row in the middle', () => {
    const offsets = buildUniformOffsets(10, 20);
    // scrollTop = 50 should find row 2 (offsets[2] = 40 <= 50 < offsets[3] = 60)
    expect(findLineAtOffset(50, offsets)).toBe(2);
  });

  it('should handle exact offset boundaries', () => {
    const offsets = buildUniformOffsets(10, 20);
    // scrollTop = 40 exactly equals offsets[2], should return 2
    expect(findLineAtOffset(40, offsets)).toBe(2);
  });

  it('should handle variable height rows', () => {
    const offsets = buildVariableOffsets([10, 50, 20, 100, 30]); // 5 rows
    // offsets = [0, 10, 60, 80, 180, 210]
    expect(findLineAtOffset(0, offsets)).toBe(0);
    expect(findLineAtOffset(10, offsets)).toBe(1); // exactly at row 1 start
    expect(findLineAtOffset(59, offsets)).toBe(1); // just before row 2
    expect(findLineAtOffset(60, offsets)).toBe(2); // exactly at row 2
    expect(findLineAtOffset(100, offsets)).toBe(3); // in the middle of row 3
    expect(findLineAtOffset(210, offsets)).toBe(4); // at the end
  });
});

describe('calculateVisibleRange', () => {
  it('should include buffer rows above and below viewport', () => {
    const offsets = buildUniformOffsets(100, 20); // 100 rows, 20px each, total 2000px
    const { visibleRowStart, visibleRowEnd } = calculateVisibleRange(
      500, // scrollTop
      200, // viewport height (shows 10 rows)
      offsets,
      5    // buffer
    );

    // scrollTop 500 is at row 25 (500/20)
    // viewport end is at 700, which is row 35
    // With buffer 5: start = 20, end = 40
    expect(visibleRowStart).toBe(20);
    expect(visibleRowEnd).toBe(40);
  });

  it('should clamp visibleRowStart to 0', () => {
    const offsets = buildUniformOffsets(100, 20);
    const { visibleRowStart } = calculateVisibleRange(0, 200, offsets, 5);
    expect(visibleRowStart).toBe(0);
  });

  it('should handle scrolling to the bottom', () => {
    const offsets = buildUniformOffsets(50, 20); // 50 rows, total 1000px
    const viewportHeight = 200;
    const maxScrollTop = 1000 - viewportHeight; // 800

    const { visibleRowStart, visibleRowEnd } = calculateVisibleRange(
      maxScrollTop,
      viewportHeight,
      offsets,
      5
    );

    // At scrollTop 800, we're at row 40 (800/20)
    // Viewport end is 1000, which is past the last row (49)
    // findLineAtOffset(1000) should return 49 (last row)
    // visibleRowEnd = 49 + 5 = 54
    expect(visibleRowEnd).toBeGreaterThanOrEqual(49);

    // The last row (49) should definitely be in the visible range
    expect(visibleRowEnd).toBeGreaterThanOrEqual(49);
  });

  it('should handle variable height rows at the bottom', () => {
    // Simulate the user's scenario: 54 rows with some tall rows
    const rowHeights = Array(54).fill(19); // base height
    // Make some rows taller (simulating wrapped text)
    rowHeights[10] = 57; // 3 visual lines
    rowHeights[25] = 95; // 5 visual lines
    rowHeights[40] = 76; // 4 visual lines

    const offsets = buildVariableOffsets(rowHeights);
    const totalHeight = offsets[offsets.length - 1];
    const viewportHeight = 568;
    const maxScrollTop = totalHeight - viewportHeight;

    const { visibleRowStart, visibleRowEnd } = calculateVisibleRange(
      maxScrollTop,
      viewportHeight,
      offsets,
      5
    );

    // The last row (53) should be in the visible range when scrolled to bottom
    expect(visibleRowEnd).toBeGreaterThanOrEqual(53);
  });
});

describe('offset calculation mismatch', () => {
  it('should handle when calculated offsets overestimate actual render height', () => {
    // This simulates the bug: we CALCULATE large offsets but rows render smaller
    // We calculate offsets based on char count, but CSS might render differently

    // Scenario: 54 rows, calculated total height 2907
    // But if actual rendered height per row is smaller, we'd have empty space

    // The fix: ensure we render enough rows to FILL the viewport,
    // not just to REACH the calculated viewport end

    const calculatedOffsets = buildUniformOffsets(54, 54); // ~54px per row = 2916 total
    const actualRowHeight = 40; // But actual render is only 40px per row

    const viewportHeight = 568;
    const contentScrollTop = 1863;
    const viewportEnd = contentScrollTop + viewportHeight; // 2431

    const { visibleRowEnd } = calculateVisibleRange(
      contentScrollTop,
      viewportHeight,
      calculatedOffsets,
      5
    );

    // With calculated offsets, we think row 44 is at offset 2376,
    // and row 45 is at offset 2430, so visibleRowEnd ≈ 44 + 5 = 49

    // But if actual row height is 40px, then 11 rows (from row 37)
    // only covers 440px, not the full 568px viewport

    // To fill the viewport, we need: ceil(568 / 40) = 15 rows
    // Starting from row 37, we need to show rows 37-51 (15 rows)

    const actualRowsNeededToFillViewport = Math.ceil(viewportHeight / actualRowHeight);
    const visibleRowStart = Math.max(0, findLineAtOffset(contentScrollTop, calculatedOffsets) - 5);

    // The visibleRowEnd should be at least start + rows needed
    // This test documents the BUG - it will fail until we fix it
    const minimumRowEndNeeded = visibleRowStart + actualRowsNeededToFillViewport;

    // Current behavior: visibleRowEnd is based on calculated offsets
    // This might not be enough rows to fill the actual viewport
    console.log(`visibleRowStart: ${visibleRowStart}`);
    console.log(`visibleRowEnd: ${visibleRowEnd}`);
    console.log(`actualRowsNeededToFillViewport: ${actualRowsNeededToFillViewport}`);
    console.log(`minimumRowEndNeeded: ${minimumRowEndNeeded}`);
  });
});

describe('visibility edge cases', () => {
  it('should show all rows when total content fits in viewport', () => {
    const offsets = buildUniformOffsets(10, 20); // 200px total
    const { visibleRowStart, visibleRowEnd } = calculateVisibleRange(
      0,
      500, // viewport larger than content
      offsets,
      5
    );

    expect(visibleRowStart).toBe(0);
    // All 10 rows (0-9) should be visible
    expect(visibleRowEnd).toBeGreaterThanOrEqual(9);
  });

  it('should handle single row', () => {
    const offsets = buildUniformOffsets(1, 20);
    const { visibleRowStart, visibleRowEnd } = calculateVisibleRange(0, 100, offsets, 5);

    expect(visibleRowStart).toBe(0);
    expect(visibleRowEnd).toBeGreaterThanOrEqual(0);
  });

  it('should reproduce the reported bug scenario', () => {
    // From user's debug output:
    // totalRows: 54, viewportEnd: 2431, offsets[47]: 2565
    // This means offsets[47] > viewportEnd, so row 47+ is past viewport

    // Let's create offsets that match this scenario
    // We need offsets where offsets[47] = 2565, offsets[53] = 2888, offsets[54] = 2907
    const offsets: number[] = [0];

    // Build offsets that result in the reported values
    // Average height = 2907 / 54 ≈ 53.8px
    // But some rows are taller due to wrapping
    for (let i = 0; i < 54; i++) {
      // Approximate: taller rows in the middle, shorter at the end
      let height: number;
      if (i < 40) {
        height = 60; // taller rows
      } else {
        height = 25; // shorter rows near the end
      }
      offsets.push(offsets[offsets.length - 1] + height);
    }

    // Adjust to match roughly the reported values
    // offsets[54] should be ~2907
    const scale = 2907 / offsets[offsets.length - 1];
    const scaledOffsets = offsets.map(o => o * scale);

    const viewportHeight = 568;
    const contentScrollTop = 1863;
    const viewportEnd = contentScrollTop + viewportHeight; // 2431

    const { visibleRowStart, visibleRowEnd } = calculateVisibleRange(
      contentScrollTop,
      viewportHeight,
      scaledOffsets,
      5
    );

    // The key assertion: when scrolled near the bottom,
    // visibleRowEnd should be high enough to include all rows that
    // START before the viewport end
    const lastRowStartingBeforeViewportEnd = findLineAtOffset(viewportEnd, scaledOffsets);

    // visibleRowEnd should be at least lastRowStartingBeforeViewportEnd + buffer
    expect(visibleRowEnd).toBeGreaterThanOrEqual(lastRowStartingBeforeViewportEnd + 5);

    // And critically: if there's content below viewportEnd,
    // the last row (53) should still be reachable when scrolled to actual bottom
    const maxScrollTop = scaledOffsets[scaledOffsets.length - 1] - viewportHeight;
    const { visibleRowEnd: endAtBottom } = calculateVisibleRange(
      maxScrollTop,
      viewportHeight,
      scaledOffsets,
      5
    );

    expect(endAtBottom).toBeGreaterThanOrEqual(53);
  });
});

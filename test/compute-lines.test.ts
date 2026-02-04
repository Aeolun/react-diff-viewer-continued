import { describe, expect, it, beforeAll } from "vitest";
import { DiffMethod, computeLineInformation } from "../src/compute-lines";

// Generate large test data for performance testing
function generateLargeJson(size: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < size; i++) {
    result[`key_${i}`] = {
      id: i,
      name: `Item ${i}`,
      description: `This is a description for item ${i} with some additional text`,
      nested: {
        value: i * 100,
        tags: [`tag_${i}_a`, `tag_${i}_b`, `tag_${i}_c`],
      },
    };
  }
  return result;
}

function generateLargeString(lines: number): string {
  const result: string[] = [];
  for (let i = 0; i < lines; i++) {
    result.push(`Line ${i}: This is some content for line number ${i} with padding text`);
  }
  return result.join('\n');
}

describe("Testing compute lines utils", (): void => {
  it("It should not avoid trailing spaces", (): void => {
    const oldCode = `test


    `;
    const newCode = `test

    `;

    expect(computeLineInformation(oldCode, newCode)).toMatchObject({
      lineInformation: [
        {
          left: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
          right: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
        },
        {
          left: {
            lineNumber: 2,
            type: 0,
            value: "",
          },
          right: {
            lineNumber: 2,
            type: 0,
            value: "",
          },
        },
        {
          left: {
            lineNumber: 3,
            type: 2,
            value: " ",
          },
          right: {},
        },
        {
          left: {
            lineNumber: 4,
            type: 0,
            value: "    ",
          },
          right: {
            lineNumber: 3,
            type: 0,
            value: "    ",
          },
        },
      ],
      diffLines: [2],
    });
  });

  it("Should identify line addition", (): void => {
    const oldCode = "test";
    const newCode = `test
    newLine`;

    expect(computeLineInformation(oldCode, newCode, true)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: "    newLine",
          },
          left: {},
        },
      ],
      diffLines: [1],
    });
  });

  it("Should identify line deletion", (): void => {
    const oldCode = `test
    oldLine`;
    const newCode = "test";

    expect(computeLineInformation(oldCode, newCode)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
        },
        {
          right: {},
          left: {
            lineNumber: 2,
            type: 2,
            value: "    oldLine",
          },
        },
      ],
      diffLines: [1],
    });
  });

  it("Should identify line modification", (): void => {
    const oldCode = `test
    oldLine`;
    const newCode = `test
    newLine`;

    expect(computeLineInformation(oldCode, newCode, true)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: "    newLine",
          },
          left: {
            lineNumber: 2,
            type: 2,
            value: "    oldLine",
          },
        },
      ],
      diffLines: [1],
    });
  });

  it("Should identify word diff", (): void => {
    const oldCode = `test
    oldLine`;
    const newCode = `test
    newLine`;

    expect(computeLineInformation(oldCode, newCode)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: "test",
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: [
              {
                type: 0,
                value: "    ",
              },
              {
                type: 1,
                value: "new",
              },
              {
                type: 0,
                value: "Line",
              },
            ],
          },
          left: {
            lineNumber: 2,
            type: 2,
            value: [
              {
                type: 0,
                value: "    ",
              },
              {
                type: 2,
                value: "old",
              },
              {
                type: 0,
                value: "Line",
              },
            ],
          },
        },
      ],
      diffLines: [1],
    });
  });

  it('Should call "diffChars" jsDiff method when compareMethod is not provided', (): void => {
    const oldCode = "Hello World";
    const newCode = `My Updated Name
Also this info`;

    expect(computeLineInformation(oldCode, newCode)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 1,
            value: [
              {
                type: 1,
                value: "My Updat",
              },
              {
                type: 0,
                value: "e",
              },
              {
                type: 1,
                value: "d",
              },
              {
                type: 0,
                value: " ",
              },
              {
                type: 1,
                value: "Name",
              },
            ],
          },
          left: {
            lineNumber: 1,
            type: 2,
            value: [
              {
                type: 2,
                value: "H",
              },
              {
                type: 0,
                value: "e",
              },
              {
                type: 2,
                value: "llo",
              },
              {
                type: 0,
                value: " ",
              },
              {
                type: 2,
                value: "World",
              },
            ],
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: "Also this info",
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });

  it('Should call "diffWords" jsDiff method when a compareMethod IS provided', (): void => {
    const oldCode = "Hello World";
    const newCode = `My Updated Name
Also this info`;

    expect(
      computeLineInformation(oldCode, newCode, false, DiffMethod.WORDS),
    ).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 1,
            value: [
              {
                type: 1,
                value: "My",
              },
              {
                type: 0,
                value: " ",
              },
              {
                type: 1,
                value: "Updated Name",
              },
            ],
          },
          left: {
            lineNumber: 1,
            type: 2,
            value: [
              {
                type: 2,
                value: "Hello",
              },
              {
                type: 0,
                value: " ",
              },
              {
                type: 2,
                value: "World",
              },
            ],
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: "Also this info",
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });

  it("Should not call jsDiff method and not diff text when disableWordDiff is true", (): void => {
    const oldCode = "Hello World";
    const newCode = `My Updated Name
Also this info`;

    expect(computeLineInformation(oldCode, newCode, true)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 1,
            value: "My Updated Name",
          },
          left: {
            lineNumber: 1,
            type: 2,
            value: "Hello World",
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: "Also this info",
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });

  it("Should start line counting from offset", (): void => {
    const oldCode = "Hello World";
    const newCode = `My Updated Name
Also this info`;

    expect(
      computeLineInformation(oldCode, newCode, true, DiffMethod.WORDS, 5),
    ).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 6,
            type: 1,
            value: "My Updated Name",
          },
          left: {
            lineNumber: 6,
            type: 2,
            value: "Hello World",
          },
        },
        {
          right: {
            lineNumber: 7,
            type: 1,
            value: "Also this info",
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });
});

import * as diff from 'diff';
import oldJson from '../examples/src/diff/json/old.json';
import newJson from '../examples/src/diff/json/new.json';
import oldYaml from '../examples/src/diff/massive/old.yaml?raw';
import newYaml from '../examples/src/diff/massive/new.yaml?raw';

describe("Performance tests", (): void => {
  it("Should handle example JSON files efficiently (structural diff)", (): void => {
    const start = performance.now();
    const result = computeLineInformation(oldJson, newJson, true, DiffMethod.JSON);
    const duration = performance.now() - start;

    console.log(`Example JSON diff (6004 lines each, structural): ${duration.toFixed(2)}ms`);
    expect(result.lineInformation.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  it("JSON optimized diff should identify same changes as naive diffJson", (): void => {
    // Use smaller test data since naive diffJson is slow on large files
    const smallOld = generateLargeJson(50);
    const smallNew = { ...generateLargeJson(50), extra_key: "new value" };
    (smallNew as any).key_10.name = "Modified Item 10";
    (smallNew as any).key_25.description = "Changed description";

    // Get optimized structural diff result
    const optimizedResult = computeLineInformation(smallOld, smallNew, true, DiffMethod.JSON);

    // Get naive diffJson result
    const naiveDiff = diff.diffJson(smallOld, smallNew);

    // Both should identify that there are changes
    const optimizedHasChanges = optimizedResult.diffLines.length > 0;
    const naiveHasChanges = naiveDiff.some(c => c.added || c.removed);
    expect(optimizedHasChanges).toBe(naiveHasChanges);

    // Extract the actual changed values from both to verify they identify the same modifications
    // Optimized: look for lines containing our changed values
    const optimizedText = optimizedResult.lineInformation
      .map(l => {
        const leftVal = typeof l.left?.value === 'string' ? l.left.value : '';
        const rightVal = typeof l.right?.value === 'string' ? l.right.value : '';
        return leftVal + rightVal;
      })
      .join('\n');

    const naiveText = naiveDiff.map(c => c.value).join('');

    // Both should contain the key changes we made
    expect(optimizedText).toContain('extra_key');
    expect(naiveText).toContain('extra_key');

    expect(optimizedText).toContain('Modified Item 10');
    expect(naiveText).toContain('Modified Item 10');

    expect(optimizedText).toContain('Changed description');
    expect(naiveText).toContain('Changed description');

    // Both should contain the original values too (for context)
    expect(optimizedText).toContain('Item 10');
    expect(naiveText).toContain('Item 10');

    // Count changes - optimized works line-by-line, naive works chunk-by-chunk
    const optimizedChangedLines = optimizedResult.diffLines.length;
    const naiveChangedChunks = naiveDiff.filter(c => c.added || c.removed).length;

    console.log(`JSON diff consistency: optimized found ${optimizedChangedLines} changed line indices`);
    console.log(`JSON diff consistency: naive found ${naiveChangedChunks} changed chunks`);
    console.log(`JSON diff consistency: both contain the expected modifications`);

    // Both should have found changes
    expect(optimizedChangedLines).toBeGreaterThan(0);
    expect(naiveChangedChunks).toBeGreaterThan(0);
  });

  it("Should handle YAML files efficiently (structural diff)", (): void => {
    const oldLines = oldYaml.split('\n').length;
    const newLines = newYaml.split('\n').length;

    const start = performance.now();
    const result = computeLineInformation(oldYaml, newYaml, true, DiffMethod.YAML);
    const duration = performance.now() - start;

    console.log(`YAML diff (${oldLines}/${newLines} lines, structural): ${duration.toFixed(2)}ms`);
    expect(result.lineInformation.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  it("YAML optimized diff should produce same content as naive diffLines", (): void => {
    // Get optimized YAML diff result
    const optimizedResult = computeLineInformation(oldYaml, newYaml, true, DiffMethod.YAML);

    // Get naive diffLines result (what we'd get without optimization)
    const naiveResult = computeLineInformation(oldYaml, newYaml, true, DiffMethod.LINES);

    // Extract all text content from both results
    const getTextContent = (result: typeof optimizedResult) => {
      const lines: string[] = [];
      for (const line of result.lineInformation) {
        if (line.left?.value) {
          const val = line.left.value;
          lines.push(typeof val === 'string' ? val : JSON.stringify(val));
        }
        if (line.right?.value) {
          const val = line.right.value;
          lines.push(typeof val === 'string' ? val : JSON.stringify(val));
        }
      }
      return lines.join('\n');
    };

    const optimizedText = getTextContent(optimizedResult);
    const naiveText = getTextContent(naiveResult);

    // The text content should be identical
    expect(optimizedText).toBe(naiveText);

    // Line counts should match
    expect(optimizedResult.lineInformation.length).toBe(naiveResult.lineInformation.length);

    // Diff line indices should match
    expect(optimizedResult.diffLines).toEqual(naiveResult.diffLines);

    console.log(`YAML diff consistency check passed: ${optimizedResult.lineInformation.length} lines, ${optimizedResult.diffLines.length} changes`);
  });

  it("Compare: highly different JSON (worst case for Myers)", (): void => {
    // Generate completely different JSON (worst case for Myers diff)
    function generateDifferentJson(size: number, prefix: string): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < size; i++) {
        result[`key_${i}`] = {
          id: prefix === 'old' ? i : i + 1000,
          name: `${prefix} Item ${i}`,
          description: `${prefix} description for item ${i}`,
        };
      }
      return result;
    }

    for (const size of [50, 100, 200]) {
      const oldData = generateDifferentJson(size, 'old');
      const newData = generateDifferentJson(size, 'new');

      // Structural diff (our implementation)
      const startStructural = performance.now();
      computeLineInformation(oldData, newData, true, DiffMethod.JSON);
      const structuralDuration = performance.now() - startStructural;

      // Original diffJson from jsdiff library
      const startOriginal = performance.now();
      diff.diffJson(oldData, newData);
      const originalDuration = performance.now() - startOriginal;

      console.log(`${size} keys (all different) - Structural: ${structuralDuration.toFixed(2)}ms, Original: ${originalDuration.toFixed(2)}ms, Speedup: ${(originalDuration / structuralDuration).toFixed(1)}x`);
    }
  });

  it("Should handle large string diffs efficiently", (): void => {
    const oldString = generateLargeString(5000);
    // Modify every 10th line
    const newLines = oldString.split('\n').map((line, i) =>
      i % 10 === 0 ? line + ' MODIFIED' : line
    );
    const newString = newLines.join('\n');

    const start = performance.now();
    const result = computeLineInformation(oldString, newString, true, DiffMethod.LINES);
    const duration = performance.now() - start;

    console.log(`Large string diff (5000 lines): ${duration.toFixed(2)}ms`);
    expect(result.lineInformation.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  it("Should handle large JSON diffs efficiently", (): void => {
    const oldJson = generateLargeJson(500);
    const newJson = { ...generateLargeJson(500), extra_key: "new value" };
    // Modify some values
    (newJson as any).key_10.name = "Modified Item 10";
    (newJson as any).key_50.description = "Modified description";

    const start = performance.now();
    const result = computeLineInformation(oldJson, newJson, true, DiffMethod.JSON);
    const duration = performance.now() - start;

    console.log(`Large JSON diff (500 keys): ${duration.toFixed(2)}ms`);
    expect(result.lineInformation.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });
});

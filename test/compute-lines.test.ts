import { describe, it, expect } from 'vitest'
import { computeLineInformation, DiffMethod } from '../src/compute-lines';

describe('Testing compute lines utils', (): void => {
  it('It should not avoid trailing spaces', (): void => {
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
            value: 'test',
          },
          right: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
        },
        {
          left: {
            lineNumber: 2,
            type: 0,
            value: '',
          },
          right: {
            lineNumber: 2,
            type: 0,
            value: '',
          },
        },
        {
          left: {
            lineNumber: 3,
            type: 2,
            value: ' ',
          },
          right: {},
        },
        {
          left: {
            lineNumber: 4,
            type: 0,
            value: '    ',
          },
          right: {
            lineNumber: 3,
            type: 0,
            value: '    ',
          },
        }
      ],
      diffLines: [2],
    });
  });

  it('Should identify line addition', (): void => {
    const oldCode = 'test';
    const newCode = `test
    newLine`;

    expect(computeLineInformation(oldCode, newCode, true)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: '    newLine',
          },
          left: {},
        },
      ],
      diffLines: [1],
    });
  });

  it('Should identify line deletion', (): void => {
    const oldCode = `test
    oldLine`;
    const newCode = 'test';

    expect(computeLineInformation(oldCode, newCode)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
        },
        {
          right: {},
          left: {
            lineNumber: 2,
            type: 2,
            value: '    oldLine',
          },
        },
      ],
      diffLines: [1],
    });
  });

  it('Should identify line modification', (): void => {
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
            value: 'test',
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: '    newLine',
          },
          left: {
            lineNumber: 2,
            type: 2,
            value: '    oldLine',
          },
        },
      ],
      diffLines: [1],
    });
  });

  it('Should identify word diff', (): void => {
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
            value: 'test',
          },
          left: {
            lineNumber: 1,
            type: 0,
            value: 'test',
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: [
              {
                type: 0,
                value: '    ',
              },
              {
                type: 1,
                value: 'new',
              },
              {
                type: 0,
                value: 'Line',
              },
            ],
          },
          left: {
            lineNumber: 2,
            type: 2,
            value: [
              {
                type: 0,
                value: '    ',
              },
              {
                type: 2,
                value: 'old',
              },
              {
                type: 0,
                value: 'Line',
              },
            ],
          },
        },
      ],
      diffLines: [1],
    });
  });

  it('Should call "diffChars" jsDiff method when compareMethod is not provided', (): void => {
    const oldCode = 'Hello World';
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
                value: 'My Updat',
              },
              {
                type: 0,
                value: 'e',
              },
              {
                type: 1,
                value: 'd',
              },
              {
                type: 0,
                value: ' ',
              },
              {
                type: 1,
                value: 'Name',
              },
            ],
          },
          left: {
            lineNumber: 1,
            type: 2,
            value: [
              {
                type: 2,
                value: 'H',
              },
              {
                type: 0,
                value: 'e',
              },
              {
                type: 2,
                value: 'llo',
              },
              {
                type: 0,
                value: ' ',
              },
              {
                type: 2,
                value: 'World',
              },
            ],
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: 'Also this info',
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });

  it('Should call "diffWords" jsDiff method when a compareMethod IS provided', (): void => {
    const oldCode = 'Hello World';
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
                value: 'My',
              },
              {
                type: 0,
                value: ' ',
              },
              {
                type: 1,
                value: 'Updated Name',
              },
            ],
          },
          left: {
            lineNumber: 1,
            type: 2,
            value: [
              {
                type: 2,
                value: 'Hello',
              },
              {
                type: 0,
                value: ' ',
              },
              {
                type: 2,
                value: 'World',
              },
            ],
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: 'Also this info',
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });

  it('Should not call jsDiff method and not diff text when disableWordDiff is true', (): void => {
    const oldCode = 'Hello World';
    const newCode = `My Updated Name
Also this info`;

    expect(computeLineInformation(oldCode, newCode, true)).toMatchObject({
      lineInformation: [
        {
          right: {
            lineNumber: 1,
            type: 1,
            value: 'My Updated Name',
          },
          left: {
            lineNumber: 1,
            type: 2,
            value: 'Hello World',
          },
        },
        {
          right: {
            lineNumber: 2,
            type: 1,
            value: 'Also this info',
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });

  it('Should start line counting from offset', (): void => {
    const oldCode = 'Hello World';
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
            value: 'My Updated Name',
          },
          left: {
            lineNumber: 6,
            type: 2,
            value: 'Hello World',
          },
        },
        {
          right: {
            lineNumber: 7,
            type: 1,
            value: 'Also this info',
          },
          left: {},
        },
      ],
      diffLines: [0, 1],
    });
  });
});

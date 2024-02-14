/**
 * @vitest-environment happy-dom
 */

import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect } from 'vitest'

import DiffViewer from '../src/index';

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

describe('Testing react diff viewer', (): void => {
  it('It should render a table', (): void => {
    const node = render(<DiffViewer oldValue={oldCode} newValue={newCode} />);

    expect(node.getAllByRole('table').length).toEqual(1);
  });

  it('It should render diff lines in diff view', (): void => {
    const node = render(<DiffViewer oldValue={oldCode} newValue={newCode} />);

    expect(node.getAllByRole('row').length).toEqual(16);
  });

  it('It should render diff lines in inline view', (): void => {
    const node = render(
      <DiffViewer oldValue={oldCode} newValue={newCode} splitView={false} />,
    );

    expect(node.getAllByRole('row').length).toEqual(26);
  });
});

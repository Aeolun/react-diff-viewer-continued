# Visual Regression Testing

This directory contains visual regression tests for the React Diff Viewer component using Playwright.

## Overview

Visual tests capture screenshots of the diff viewer component in various configurations and compare them against baseline images. This ensures that visual changes are intentional and helps catch unintended UI regressions.

## Test Structure

### Main Test Suite (`diff-viewer.spec.ts`)
- Tests different themes (light/dark)
- Tests different view modes (split/unified)
- Tests different content types (JavaScript, JSON, YAML)
- Tests feature toggles (syntax highlighting, line numbers, etc.)
- Tests responsive design

### Component-Focused Tests (`component-focused.spec.ts`)
- Isolated component screenshots without page UI
- Focused testing of specific component states
- Performance testing with large files

## Running Tests

```bash
# Run all visual tests
pnpm test:visual

# Run with UI mode for interactive debugging
pnpm test:visual:ui

# Update screenshots (after intentional changes)
pnpm test:visual:update

# Run in headed mode (see browser)
pnpm test:visual:headed

# Debug specific test
pnpm test:visual:debug
```

## Test Coverage

The visual tests cover:

1. **Themes**: Light and dark themes
2. **View Modes**: Split view and unified view
3. **Content Types**: JavaScript, JSON, and YAML diffs
4. **Features**: All toggleable features (syntax highlighting, line numbers, column headers, etc.)
5. **Interactions**: Line highlighting and selection
6. **Responsive**: Mobile and desktop viewports
7. **Performance**: Large file handling with infinite loading

## Managing Screenshots

### Initial Setup
When first running the tests, baseline screenshots will be generated automatically.

### Updating Screenshots
When you make intentional visual changes:
```bash
pnpm test:visual:update
```

### Reviewing Changes
When tests fail due to visual differences:
1. Run `pnpm test:visual:ui` to see the differences
2. Review each change to determine if it's intentional
3. If intentional, update the screenshots
4. If unintentional, fix the code

## Screenshot Storage

Screenshots are stored in:
- `tests/visual/diff-viewer.spec.ts-snapshots/` - Main test screenshots
- `tests/visual/component-focused.spec.ts-snapshots/` - Component-focused screenshots

Screenshots are organized by browser (chromium, firefox, webkit) and include both expected baselines and actual results when tests fail.

## Best Practices

1. **Wait for stability**: Tests include appropriate waits for animations and async loading
2. **Consistent state**: Tests reset to known states before capturing screenshots
3. **Browser coverage**: Tests run across Chromium, Firefox, and WebKit
4. **Focused testing**: Component-focused tests isolate the diff viewer from page UI
5. **Real scenarios**: Tests use actual diff content from the examples

## CI Integration

Visual tests are configured to:
- Run automatically on pull requests
- Generate artifacts for failed test comparisons
- Prevent flaky tests with appropriate retries and waits

## Troubleshooting

### Tests are flaky
- Increase wait times in test files
- Check for animations or async operations
- Ensure consistent browser state

### Screenshots don't match
- Check for system-specific rendering differences
- Review font rendering and system settings
- Consider increasing screenshot comparison thresholds

### Large diffs in screenshots
- Review recent changes to styling or layout
- Check for dependency updates that affect rendering
- Verify theme consistency
import { test, expect } from '@playwright/test';

test.describe('React Diff Viewer Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the component to be fully loaded
    await page.waitForSelector('.diff-viewer');
    // Wait for controls to be visible
    await page.waitForSelector('.options input[type="checkbox"]');
    // Wait a bit for any animations or async loading to complete
    await page.waitForTimeout(1000);
  });

  test('baseline - default dark theme with javascript diff', async ({ page }) => {
    // Ensure default state: dark theme, split view, line numbers
    await expect(page.locator('.diff-viewer')).toHaveScreenshot('baseline-dark-javascript.png');
  });

  test('light theme with javascript diff', async ({ page }) => {
    // Switch to light theme - use more specific selector
    await page.click('.options input[type="checkbox"]:first-of-type');
    await page.waitForTimeout(500); // Wait for theme transition

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('light-theme-javascript.png');
  });

  test('unified view mode', async ({ page }) => {
    // Switch to unified view (uncheck split pane)
    await page.click('.options input[type="checkbox"]:nth-of-type(2)');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('unified-view-javascript.png');
  });

  test('without syntax highlighting', async ({ page }) => {
    // Disable syntax highlighting
    await page.click('.options input[type="checkbox"]:nth-of-type(3)');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('no-syntax-highlighting.png');
  });

  test('without column headers', async ({ page }) => {
    // Disable column headers
    await page.click('.options input[type="checkbox"]:nth-of-type(4)');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('no-column-headers.png');
  });

  test('without custom gutter', async ({ page }) => {
    // Disable custom gutter
    await page.click('.options input[type="checkbox"]:nth-of-type(5)');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('no-custom-gutter.png');
  });

  test('without line numbers', async ({ page }) => {
    // Disable line numbers
    await page.click('.options input[type="checkbox"]:nth-of-type(6)');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('no-line-numbers.png');
  });

  test('JSON diff format', async ({ page }) => {
    // Switch to JSON data type
    await page.selectOption('.options select', 'json');
    await page.waitForTimeout(1000); // Wait for content to load

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('json-diff.png');
  });

  test('YAML diff format', async ({ page }) => {
    // Switch to YAML data type (massive file)
    await page.selectOption('.options select', 'yaml');
    await page.waitForTimeout(2000); // Wait longer for large file to load

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('yaml-diff.png');
  });

  test('light theme unified view JSON', async ({ page }) => {
    // Combination test: light theme + unified view + JSON
    await page.click('.options input[type="checkbox"]:first-of-type'); // Light theme
    await page.click('.options input[type="checkbox"]:nth-of-type(2)'); // Unified view
    await page.selectOption('.options select', 'json'); // JSON data
    await page.waitForTimeout(1000);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('light-unified-json.png');
  });

  test('minimal configuration', async ({ page }) => {
    // Disable most features to test minimal view
    await page.click('.options input[type="checkbox"]:nth-of-type(3)'); // No syntax highlighting
    await page.click('.options input[type="checkbox"]:nth-of-type(4)'); // No column headers
    await page.click('.options input[type="checkbox"]:nth-of-type(5)'); // No custom gutter
    await page.click('.options input[type="checkbox"]:nth-of-type(6)'); // No line numbers
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('minimal-config.png');
  });

  test('line highlighting interaction', async ({ page }) => {
    // Click on a line number to highlight it
    await page.click('.diff-viewer table tbody tr:nth-child(5) td:first-child');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('line-highlighted.png');
  });

  test('full page layout', async ({ page }) => {
    // Test the entire page layout including controls
    await expect(page).toHaveScreenshot('full-page-layout.png');
  });

  test('infinite loading mode with YAML', async ({ page }) => {
    // Test infinite loading with large YAML file
    await page.selectOption('.options select', 'yaml');
    // Infinite loading should be enabled by default
    await page.waitForTimeout(2000);

    // Scroll to trigger loading if needed
    await page.locator('.diff-viewer').scrollIntoViewIfNeeded();

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('infinite-loading-yaml.png');
  });

  test('responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('mobile-viewport.png');
  });
});
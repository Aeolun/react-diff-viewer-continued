import { test, expect } from '@playwright/test';

test.describe('Component-Focused Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.diff-viewer');
    await page.waitForSelector('.options input[type="checkbox"]');
    await page.waitForTimeout(1000);
  });

  test('component only - dark theme split view', async ({ page }) => {
    // Hide everything except the diff viewer for focused component testing
    await page.addStyleTag({
      content: `
        .banner, footer { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-dark-split.png');
  });

  test('component only - light theme unified view', async ({ page }) => {
    // Hide everything except the diff viewer
    await page.addStyleTag({
      content: `
        .banner, footer { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    // Switch to light theme and unified view
    await page.click('.options input[type="checkbox"]:first-of-type'); // Light theme
    await page.click('.options input[type="checkbox"]:nth-of-type(2)'); // Unified view
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-light-unified.png');
  });

  test('component only - JSON diff with headers', async ({ page }) => {
    await page.addStyleTag({
      content: `
        .banner, footer { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    // Switch to JSON
    await page.selectOption('.options select', 'json');
    await page.waitForTimeout(1000);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-json-headers.png');
  });

  test('component only - minimal configuration', async ({ page }) => {
    await page.addStyleTag({
      content: `
        .banner, footer { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    // Disable all optional features
    await page.click('.options input[type="checkbox"]:nth-of-type(3)'); // No syntax highlighting
    await page.click('.options input[type="checkbox"]:nth-of-type(4)'); // No column headers
    await page.click('.options input[type="checkbox"]:nth-of-type(5)'); // No custom gutter
    await page.click('.options input[type="checkbox"]:nth-of-type(6)'); // No line numbers
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-minimal.png');
  });

  test('component only - large YAML diff performance', async ({ page }) => {
    await page.addStyleTag({
      content: `
        .banner, footer { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    // Switch to large YAML file
    await page.selectOption('.options select', 'yaml');
    await page.waitForTimeout(3000); // Wait for large file to render

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-yaml-large.png');
  });

  test('component only - highlighted lines state', async ({ page }) => {
    await page.addStyleTag({
      content: `
        .banner, footer { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    // Click on a line to highlight it
    await page.click('.diff-viewer table tbody tr:nth-child(10) td:first-child');
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-highlighted-line.png');
  });
});
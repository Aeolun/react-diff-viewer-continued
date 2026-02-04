import { test, expect } from '@playwright/test';

test.describe('Basic Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the component to be fully loaded
    await page.waitForSelector('.diff-viewer');
    await page.waitForTimeout(1000);
  });

  test('baseline - default state', async ({ page }) => {
    // Test the basic default state
    await expect(page.locator('.diff-viewer')).toHaveScreenshot('baseline-default.png');
  });

  test('full page layout', async ({ page }) => {
    // Test the entire page layout including controls
    await expect(page).toHaveScreenshot('full-page-layout.png');
  });

  test('component only - isolated view', async ({ page }) => {
    // Hide everything except the diff viewer for focused component testing
    await page.addStyleTag({
      content: `
        .banner, footer, .options { display: none !important; }
        .react-diff-viewer-example { padding: 20px; }
        body { margin: 0; padding: 0; }
      `
    });

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('component-isolated.png');
  });

  test('line highlighting interaction', async ({ page }) => {
    // Click on a line number to highlight it - use a safer selector
    const firstLineNumber = page.locator('.diff-viewer table tbody tr').first().locator('td').first();
    await firstLineNumber.click();
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('line-highlighted.png');
  });

  test('mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await expect(page.locator('.diff-viewer')).toHaveScreenshot('mobile-viewport.png');
  });
});
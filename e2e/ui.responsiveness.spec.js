// e2e/ui.responsiveness.spec.js
// Failing tests that document current UI issues (no production code).
// Run with: npx playwright test -c e2e/playwright.config.js
import { test, expect } from '@playwright/test';

test.describe('UI Responsiveness & Layout', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('Index: no horizontal overflow at mobile width (header/nav + content)', async ({ page }) => {
    await page.goto('/');
    // Assert no horizontal scroll (responsive layout should prevent this)
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement?.scrollWidth || document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    // Expectation: no horizontal overflow at 375px
    expect(scrollWidth, 'Horizontal overflow detected on index at 375px width').toBeLessThanOrEqual(innerWidth);
  });

  test('Index: Start/Stop controls stack vertically at mobile width', async ({ page }) => {
    await page.goto('/');

    const controls = page.locator('#secretaryPanel .control-buttons');
    await expect(controls).toBeVisible();

    // Desired behavior: on small screens, Start/Stop should stack (single column)
    const gridCols = await controls.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // Check that it's a single column (will be a pixel value, not "1fr 1fr")
    expect(gridCols).not.toContain('1fr 1fr');
    // Should be a single value (like "301px"), not multiple columns
    expect(gridCols.split(' ').length).toBe(1);
  });

  test('Viewer: no horizontal overflow at mobile width (toolbar and cards)', async ({ page }) => {
    await page.goto('/viewer.html');
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement?.scrollWidth || document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    // Expectation: no horizontal overflow at 375px
    expect(scrollWidth, 'Horizontal overflow detected on viewer at 375px width').toBeLessThanOrEqual(innerWidth);
  });
});

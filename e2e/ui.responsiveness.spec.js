// e2e/ui.responsiveness.spec.js
// Failing tests that document current UI issues (no production code).
// Run with: npx playwright test -c e2e/playwright.config.js
import { test, expect } from '@playwright/test';

test.describe('UI Responsiveness & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 }); // simulate small screen
  });

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

  test('Index: topbar content does not overlap at mobile width', async ({ page }) => {
    await page.goto('/');

    const brand = page.locator('.topbar__inner .brand');
    const nav = page.locator('.topbar__inner .nav-links');
    const status = page.locator('.topbar__inner .row');

    await expect(brand).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(status).toBeVisible();

    const [b, n, s] = await Promise.all([
      brand.boundingBox(),
      nav.boundingBox(),
      status.boundingBox(),
    ]);

    // If any group fails measurement, treat as failure
    expect(b, 'Brand bbox not found').not.toBeNull();
    expect(n, 'Nav bbox not found').not.toBeNull();
    expect(s, 'Status bbox not found').not.toBeNull();

    const overlap = (r1, r2) => !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);

    // Expect no overlap between header groups at small widths
    expect(overlap(b, n), 'Brand and Nav overlap at 375px').toBe(false);
    expect(overlap(n, s), 'Nav and Status overlap at 375px').toBe(false);
    expect(overlap(b, s), 'Brand and Status overlap at 375px').toBe(false);
  });

  test('Index: Start/Stop controls stack vertically at mobile width', async ({ page }) => {
    await page.goto('/');

    const controls = page.locator('#secretaryPanel .control-buttons');
    await expect(controls).toBeVisible();

    // Desired behavior: on small screens, Start/Stop should stack (single column)
    const gridCols = await controls.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // Current code uses `grid-template-columns: 1fr 1fr;` with no media override, so this test is expected to FAIL.
    expect(gridCols.replace(/\s+/g, '')).toMatch(/^1fr$/); // expect a single column grid
  });

  test('Index: Start/Stop buttons stay within card bounds at mobile width', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('#secretaryPanel.card');
    const startBtn = page.locator('#startBtn');
    const stopBtn = page.locator('#stopBtn');

    await expect(card).toBeVisible();
    await expect(startBtn).toBeVisible();
    await expect(stopBtn).toBeVisible();

    const [cb, sb, tb] = await Promise.all([
      card.boundingBox(),
      startBtn.boundingBox(),
      stopBtn.boundingBox(),
    ]);

    expect(cb, 'Card bbox not found').not.toBeNull();
    expect(sb, 'Start button bbox not found').not.toBeNull();
    expect(tb, 'Stop button bbox not found').not.toBeNull();

    const minLeft = Math.min(sb.left, tb.left);
    const maxRight = Math.max(sb.right, tb.right);
    const minTop = Math.min(sb.top, tb.top);
    const maxBottom = Math.max(sb.bottom, tb.bottom);

    // Expect the union of both buttons to be fully inside the card
    expect(minLeft).toBeGreaterThanOrEqual(cb.left);
    expect(maxRight).toBeLessThanOrEqual(cb.right);
    expect(minTop).toBeGreaterThanOrEqual(cb.top);
    expect(maxBottom).toBeLessThanOrEqual(cb.bottom);
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

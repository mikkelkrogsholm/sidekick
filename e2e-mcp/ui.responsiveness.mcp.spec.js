// e2e-mcp/ui.responsiveness.mcp.spec.js
// MCP-only checks: these rely on visual geometry and are not run in CI.
import { test, expect } from '@playwright/test';

test.describe('UI MCP Checks (geometry sensitive)', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('Index: topbar groups do not overlap at mobile width', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const brand = page.locator('.topbar__inner .brand');
    const nav = page.locator('.topbar__inner .nav-links');
    const status = page.locator('.topbar__inner .row');

    await expect(brand).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(status).toBeVisible();

    // Sanity: topbar is column on small width
    const dir = await page.locator('.topbar__inner').evaluate(el => getComputedStyle(el).flexDirection);
    expect(dir).toBe('column');

    const [b, n, s] = await Promise.all([
      brand.boundingBox(),
      nav.boundingBox(),
      status.boundingBox(),
    ]);

    expect(b).not.toBeNull();
    expect(n).not.toBeNull();
    expect(s).not.toBeNull();

    const overlap = (r1, r2) => !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);
    expect(overlap(b, n), 'Brand and Nav overlap at 375px').toBe(false);
    expect(overlap(n, s), 'Nav and Status overlap at 375px').toBe(false);
    expect(overlap(b, s), 'Brand and Status overlap at 375px').toBe(false);
  });

  test('Index: Start/Stop buttons remain within Secretary card bounds at mobile width', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

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

    expect(cb).not.toBeNull();
    expect(sb).not.toBeNull();
    expect(tb).not.toBeNull();

    const minLeft = Math.min(sb.left, tb.left);
    const maxRight = Math.max(sb.right, tb.right);
    const minTop = Math.min(sb.top, tb.top);
    const maxBottom = Math.max(sb.bottom, tb.bottom);

    expect(minLeft).toBeGreaterThanOrEqual(cb.left);
    expect(maxRight).toBeLessThanOrEqual(cb.right);
    expect(minTop).toBeGreaterThanOrEqual(cb.top);
    expect(maxBottom).toBeLessThanOrEqual(cb.bottom);
  });
});


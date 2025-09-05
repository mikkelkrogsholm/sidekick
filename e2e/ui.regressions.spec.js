// e2e/ui.regressions.spec.js
// Failing tests capturing regressions observed manually:
// - Overlapping header content below ~1050px width
// - Start/Stop buttons overflowing card at widths >= 1200px
import { test, expect } from '@playwright/test';

test.describe('UI Layout Regressions', () => {
  test('Topbar wraps or stacks at 1024px to avoid overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');

    const styles = await page.evaluate(() => {
      const el = document.querySelector('.topbar__inner');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { wrap: cs.flexWrap, dir: cs.flexDirection };
    });

    expect(styles, 'Topbar element not found').not.toBeNull();
    // Expectation: at ~1024 width, header either wraps (flex-wrap: wrap)
    // or stacks vertically (flex-direction: column) to prevent overlap.
    const ok = styles.wrap === 'wrap' || styles.dir === 'column';
    expect(ok, 'Topbar does not wrap or stack at 1024px (risk of text overlap)').toBe(true);
  });

  test('Secretary Start/Stop buttons remain within card bounds at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const metrics = await page.evaluate(() => {
      const card = document.querySelector('#secretaryPanel.card');
      const startBtn = document.querySelector('#startBtn');
      const stopBtn = document.querySelector('#stopBtn');
      if (!card || !startBtn || !stopBtn) return null;
      const cb = card.getBoundingClientRect();
      const sb = startBtn.getBoundingClientRect();
      const tb = stopBtn.getBoundingClientRect();
      return {
        card: { left: cb.left, right: cb.right, top: cb.top, bottom: cb.bottom },
        minLeft: Math.min(sb.left, tb.left),
        maxRight: Math.max(sb.right, tb.right),
        minTop: Math.min(sb.top, tb.top),
        maxBottom: Math.max(sb.bottom, tb.bottom),
      };
    });

    expect(metrics, 'Required elements not found').not.toBeNull();

    // Expect the union of both buttons to be fully inside the card area at large widths
    expect(metrics.minLeft).toBeGreaterThanOrEqual(metrics.card.left);
    expect(metrics.maxRight).toBeLessThanOrEqual(metrics.card.right);
    expect(metrics.minTop).toBeGreaterThanOrEqual(metrics.card.top);
    expect(metrics.maxBottom).toBeLessThanOrEqual(metrics.card.bottom);
  });
});


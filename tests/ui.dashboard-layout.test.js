/**
 * Tailwind v4 Layout Spec — Dashboard page specifics
 *
 * Focus: KPI grid and sessions list rely on utility classes (no inline styles)
 * and the grid adapts responsively without inline CSS.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function load() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf8');
  return new JSDOM(html, { url: 'http://localhost/dashboard.html' });
}

function classes(el) {
  return (el?.getAttribute('class') || '').toString();
}

describe('Dashboard page (dashboard.html) — layout spec', () => {
  test('Stats (KPI) grid uses utilities; no inline style on container or cards', () => {
    const { document } = load().window;
    const stats = document.querySelector('.stats');
    expect(stats).toBeTruthy();
    expect(stats.hasAttribute('style')).toBe(false);
    const cls = classes(stats);
    // Expect some grid/flex utility
    expect(/\bgrid\b|\bflex\b/.test(cls)).toBe(true);

    const cards = Array.from(stats.querySelectorAll('.card'));
    expect(cards.length).toBeGreaterThan(0);
    const offenders = cards.filter((c) => c.hasAttribute('style'));
    expect(offenders.length).toBe(0);
  });

  test('Sessions list container section has no inline style', () => {
    const { document } = load().window;
    const sections = Array.from(document.querySelectorAll('main .card'));
    expect(sections.length).toBeGreaterThan(0);
    const offenders = sections.filter((s) => s.hasAttribute('style'));
    expect(offenders.length).toBe(0);
  });
});


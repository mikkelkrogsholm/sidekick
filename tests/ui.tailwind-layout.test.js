/**
 * Tailwind v4 Layout Spec (App-wide)
 *
 * Purpose: Define Step-1 (layout-only) contract for rebuilding the UI with
 * Tailwind v4. These tests intentionally fail against the current markup to
 * act as the specification for the implementation PR.
 *
 * Scope covered here (generic across all pages):
 * - App shell uses dynamic viewport height + grid rows [auto, 1fr]
 * - At least one @container wrapper exists per page
 * - Main content applies min-w-0 to avoid overflow in grid/flex cells
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function load(page) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
  return new JSDOM(html, { url: `http://localhost/${page}` });
}

function hasClass(el, token) {
  if (!el) return false;
  const cls = (el.getAttribute('class') || '').toString();
  return cls.split(/\s+/).includes(token);
}

describe('Tailwind layout spec — app shell & core invariants', () => {
  const pages = ['index.html', 'viewer.html', 'dashboard.html'];

  test.each(pages)('%s: .app uses min-h-dvh grid and grid-rows-[auto_1fr]', (page) => {
    const { document } = load(page).window;
    const app = document.querySelector('div.app');
    expect(app).toBeTruthy();
    // Spec: Tailwind classes present on the app shell container
    expect(hasClass(app, 'min-h-dvh')).toBe(true);
    expect(hasClass(app, 'grid')).toBe(true);
    expect(hasClass(app, 'grid-rows-[auto_1fr]')).toBe(true);
  });

  test.each(pages)('%s: at least one @container wrapper exists', (page) => {
    const { document } = load(page).window;
    const anyContainer = Array.from(document.querySelectorAll('[class]')).some((el) =>
      (el.getAttribute('class') || '').includes('@container')
    );
    expect(anyContainer).toBe(true);
  });

  test.each(pages)('%s: main content applies min-w-0 to prevent overflow', (page) => {
    const { document } = load(page).window;
    const main = document.querySelector('main');
    expect(main).toBeTruthy();
    expect(hasClass(main, 'min-w-0')).toBe(true);
  });
});


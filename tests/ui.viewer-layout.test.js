/**
 * Tailwind v4 Layout Spec — Viewer page specifics
 *
 * Focus: toolbar and cards use utility classes (no inline styles),
 * and the toolbar adapts with container queries.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function load() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'viewer.html'), 'utf8');
  return new JSDOM(html, { url: 'http://localhost/viewer.html' });
}

function classes(el) {
  return (el?.getAttribute('class') || '').toString();
}

describe('Viewer page (viewer.html) — layout spec', () => {
  test('Toolbar uses class-based layout (no inline style attribute)', () => {
    const { document } = load().window;
    const toolbar = document.querySelector('.toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar.hasAttribute('style')).toBe(false);
    // Spec: toolbar should be a grid/flex via Tailwind
    const cls = classes(toolbar);
    expect(/\bgrid\b|\bflex\b/.test(cls)).toBe(true);
  });

  test('Cards/sections do not rely on inline styles for padding/layout', () => {
    const { document } = load().window;
    const sections = Array.from(document.querySelectorAll('section.card'));
    expect(sections.length).toBeGreaterThan(0);
    const offenders = sections.filter((s) => s.hasAttribute('style'));
    expect(offenders.length).toBe(0);
  });

  test('A @container wrapper exists and child uses a container variant', () => {
    const { document } = load().window;
    const hasContainer = Array.from(document.querySelectorAll('[class]')).some((el) =>
      classes(el).includes('@container')
    );
    expect(hasContainer).toBe(true);

    const hasVariant = Array.from(document.querySelectorAll('[class]')).some((el) =>
      /@sm:|@md:|@lg:/g.test(classes(el))
    );
    expect(hasVariant).toBe(true);
  });
});


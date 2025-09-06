/**
 * Tailwind v4 Layout Spec — Transcribe page specifics
 *
 * Focus: two-pane layout defined via container queries and a proper
 * panel header with a non-wrapping actions container.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function load() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  return new JSDOM(html, { url: 'http://localhost/' });
}

function classes(el) {
  return (el?.getAttribute('class') || '').toString();
}

describe('Transcribe page (index.html) — layout spec', () => {
  test('Two-pane layout is container-driven', () => {
    const { document } = load().window;
    const main = document.querySelector('main');
    expect(main).toBeTruthy();

    // Spec: a wrapper inside main marks a container context
    const hasContainer = Array.from(main.querySelectorAll('[class]')).some((el) =>
      classes(el).includes('@container')
    );
    expect(hasContainer).toBe(true);

    // Spec: within that container, children use container variants (e.g., @md:)
    const hasContainerVariant = Array.from(main.querySelectorAll('[class]')).some((el) =>
      /@sm:|@md:|@lg:/g.test(classes(el))
    );
    expect(hasContainerVariant).toBe(true);
  });

  test('Panel headers use a .panel-actions container (no inline spacing)', () => {
    const { document } = load().window;
    const headers = Array.from(document.querySelectorAll('.panel-header'));
    expect(headers.length).toBeGreaterThan(0);

    headers.forEach((header) => {
      const actions = header.querySelector('.panel-actions');
      expect(actions).toBeTruthy();
      expect(actions.hasAttribute('style')).toBe(false);
    });
  });
});


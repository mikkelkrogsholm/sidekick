/**
 * UI behavior spec: Stop button default state
 *
 * Smallest next step: ensure the Stop button is disabled by default
 * on the Transcribe page until recording actually starts.
 *
 * This test intentionally fails today to drive the change.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Transcribe page — Stop button default state', () => {
  test('Stop button is disabled by default on load', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const dom = new JSDOM(html, {
      url: 'http://localhost:3000/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    const { document } = dom.window;
    const stopBtn = document.getElementById('stopBtn');

    // Sanity check: button exists
    expect(stopBtn).toBeTruthy();

    // Spec: Stop must be disabled before any recording starts
    // This will fail until the UI marks Stop as disabled on initial load.
    expect(stopBtn.disabled).toBe(true);
  });
});


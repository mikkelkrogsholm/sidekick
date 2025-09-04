### Summary

Sidekick header action buttons are wrapping/misaligned: on the Sidekick panel, the primary `Connect` button drops to a second row while `Clear` and `Settings` sit above it. This makes the header cramped and visually uneven (see attached screenshot in PR/issue if available).

### Impact

- Confusing visual hierarchy; the primary action (`Connect`/`Disconnect`) is not aligned with the other actions.
- Layout shift when the button text toggles between `Connect` and `Disconnect`.

### Where

- `public/index.html` — the action container inside `.panel-header` is a plain `<div>` rather than the intended `.panel-actions` container.
- `public/styles/app.css` — styles for `.panel-actions` exist (around the "Panel header and actions" section) but aren’t applied because the class is missing in the markup.
- `public/sidekick.js` — a `Clear` button is injected at runtime into `#sidekickPanel .panel-header > div` with an inline left margin, which bypasses the CSS gap used by `.panel-actions`.

### Steps to Reproduce

1. Start the app: `npm start` and open `/` in a browser.
2. Look at the Sidekick panel header.
3. At common widths (e.g., ~320–700px column), `Clear` and `Settings` render on one line and `Connect` wraps to the line below.

### Expected

- All header actions (`Clear`, `Settings`, `Connect/Disconnect`) sit on one row, right-aligned, with even spacing.
- `Connect/Disconnect` remains the primary (filled) action and does not wrap on medium widths.
- No layout shift or overlap with the panel content.

### Actual

- Buttons wrap within the header action container; `Connect` drops to a second line.
- Spacing is inconsistent due to an inline `margin-left` on the injected `Clear` button.

### Likely Root Cause

- The action container is a generic `<div>` that participates in flex shrinking inside `.panel-header` (`justify-content: space-between`). Its content wraps, and the primary button gets pushed to a new line.
- The CSS defines `.panel-actions` (inline-flex + gap) but the markup doesn’t apply it.
- Inline spacing on `Clear` (`sidekick.js`) sidesteps the `gap` rule and contributes to uneven spacing.

### Proposed Fix

1. Markup: Change the header action containers in `public/index.html` to `<div class="panel-actions">` for both panels (Secretary and Sidekick).
2. JS: When injecting the `Clear` button in `public/sidekick.js`, remove the inline style and rely on the container’s gap. Optionally assign `id="skClearBtn"`.
3. CSS: Ensure `.panel-actions` prevents shrinking to avoid wraps at typical widths:
   - `.panel-actions { display: inline-flex; gap: var(--space-2); flex: 0 0 auto; }` (confirm current rules include `inline-flex` + `gap`; add `flex: 0 0 auto` if needed).
4. Responsive check: If truly needed for very narrow viewports, allow a deliberate wrap with a small row gap, but keep default as single-line.

### Acceptance Criteria

- On widths >= 320px within the current layout, all three actions stay on a single line and align vertically with the `Sidekick` title.
- Toggling to `Disconnect` does not force wrapping.
- No inline styles used for spacing; spacing comes from CSS (`gap`).
- Focus states and hover styles remain consistent with design tokens.

### References

- `public/styles/app.css` around the "Panel header and actions" section.
- `public/index.html` Sidekick and Secretary `.panel-header` blocks.
- `public/sidekick.js` injection of the `Clear` button near the `DOMContentLoaded` handler.


# UI Layout Regressions at Specific Breakpoints (Failing Tests)

## Context

Manual inspection reveals two remaining UI issues despite general responsiveness improvements:
- Overlapping header text for widths below ~1050px.
- Start/Stop buttons overflowing the Secretary card on widths ≥ 1200px.

This PR adds failing Playwright tests that formalize these regressions so they can be fixed.

## Acceptance Criteria (CI)

- [ ] At width 1024px, the topbar wraps or stacks (no overlap risk): `.topbar__inner` uses `flex-wrap: wrap` or `flex-direction: column`.
- [ ] At width 1280px, the Start/Stop buttons remain fully within the `#secretaryPanel.card` bounds.

## Out of Scope

- Additional visual polish or unrelated layout changes.
- Navigation redesign (hamburger) or advanced responsive patterns.

## Notes for Implementer

- Consider adding a breakpoint around 1050px to wrap or stack `.topbar__inner` and/or `.nav-links`.
- Ensure `.control-buttons` (and its parent field) preserve adequate padding/margins at ≥ 1200px so buttons are inside the card box.
- Avoid absolute positioning in the control area that could break containment.

## How to Run

```
npx playwright test -c e2e/playwright.config.js
```

The config starts the local server with a dummy `OPENAI_API_KEY` and an isolated SQLite DB file.

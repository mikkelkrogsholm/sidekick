# UI Responsiveness: Prevent Overflow/Overlap (Failing Tests Only)

## Context

Screenshots show layout issues:
- Buttons falling out of the card.
- Text overlapping on smaller screens.
- General lack of responsiveness at mobile widths.

This PR adds Playwright e2e tests that currently FAIL, documenting the expected responsive behavior to be implemented. No production code is included.

## Acceptance Criteria (CI)

- [ ] Index at 375px width has no horizontal overflow (no x-scroll).
- [ ] Secretary Start/Stop controls stack vertically at ≤ 400px.
- [ ] Viewer page at 375px width has no horizontal overflow.

## Out of Scope

- Navigation hamburger/menus or complex reflows beyond what is necessary to remove overflow/overlap.
- Any functional changes to server or API endpoints.

## Risks / Unknowns

- Pixel rounding differences across environments may require minor threshold adjustments.
- Icon rendering could affect measured widths slightly (tests avoid brittle exact pixel checks).

## Notes for Implementer

- Likely fixes involve media queries and layout adjustments in `public/styles/app.css` and/or `public/styles/base.css`:
  - Allow `.topbar__inner` content to wrap/stack at small widths, or reduce items/spacing.
  - Ensure `.nav-links` can wrap or change layout at small widths.
  - Change `.control-buttons` grid to single column at small widths.
  - Ensure `.viewer` toolbar grid either wraps or stacks at small widths.

## How to Run (locally)

```
npx playwright test -c e2e/playwright.config.js
```

The config starts the local server with a dummy `OPENAI_API_KEY` and an isolated SQLite DB file.

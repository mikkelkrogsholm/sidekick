# Title

Tailwind v4 layout-only spec across all pages (failing tests)

## Context

We plan a full UI rebuild using Tailwind CSS v4 with container queries and modern utilities. This PR encodes the Step‑1, layout-only contract as failing tests (no production code), defining the app shell, container-query usage, and removal of inline styles on key layout elements across all pages.

## Acceptance criteria (must be testable)

- [ ] App shell on every page: `div.app` has `min-h-dvh grid grid-rows-[auto_1fr]` classes.
- [ ] Main content applies `min-w-0` to prevent grid/flex overflow.
- [ ] Each page contains at least one `@container` wrapper and uses container variants (e.g., `@sm:`, `@md:`) on child elements.
- [ ] Viewer: `.toolbar` and all `section.card` elements have no inline `style` attributes; toolbar uses grid/flex utilities.
- [ ] Dashboard: KPI grid `.stats` and session list sections have no inline `style` attributes and use grid/flex utilities.
- [ ] Transcribe (index): panel headers include a `.panel-actions` container with no inline spacing; two‑pane layout is container-driven (`@container` + container variants).

## Out of scope

- JavaScript functionality (WebRTC, Sidekick connect/disconnect, ingestion, uploads) and behavioral changes.
- Visual polish details and Tailwind theme token mapping (added in implementation PR).

## Risks / unknowns

- Browser compatibility: assumes Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+). If older browsers are required, we will gate features or use v3.4.
- JS selectors may need light adjustments if markup changes. We will preserve critical `id`s and add `data-testid` where appropriate in Step‑2.

## Notes for Implementer

- Implement Tailwind v4 with container queries; map existing tokens to `@theme` for colors, spacing, radii, and typography.
- Replace inline styles with utilities. Introduce small `@layer components` for primitives (btn, input, card, toolbar, panel-header/actions).
- Ensure no horizontal overflow; add `min-w-0` on main content columns.
- Validate reflow in narrow containers (not just viewport breakpoints).

## Implementation checklist

- App shell (all pages)
  - [ ] `div.app` has `min-h-dvh grid grid-rows-[auto_1fr]`
  - [ ] `main` has `min-w-0`
  - [ ] At least one `@container` wrapper within main content
- Transcribe (`public/index.html`)
  - [ ] Two-pane layout driven by container queries (`@container` on wrapper; children use `@sm:`/`@md:` variants)
  - [ ] `.panel-header` includes `.panel-actions` and no inline spacing
- Viewer (`public/viewer.html`)
  - [ ] `.toolbar` uses Tailwind utilities (no `style=`)
  - [ ] All `section.card` elements have no `style=`; spacing via utilities
  - [ ] At least one `@container` + child container variants present
- Dashboard (`public/dashboard.html`)
  - [ ] KPI grid uses Tailwind utilities (grid/flex), no `style=`
  - [ ] Session list sections have no `style=`; layout via utilities


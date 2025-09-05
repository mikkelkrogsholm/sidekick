# Title

Disable Stop button by default on Transcribe page

## Context

Users can click Stop before any recording has started, which is a no‑op and confusing. The Stop control should be disabled until a recording session begins, then re‑enabled only while recording is active.

## Acceptance criteria (must be testable)

- [ ] On initial page load, `#stopBtn` is disabled (`disabled` attribute true).
- [ ] After recording starts (out of scope for this PR), Stop becomes enabled; after stopping, it is disabled again.

## Out of scope

- Wiring actual Start/Stop behavior or microphone permissions.
- Styling changes beyond the disabled state.

## Risks / unknowns

- Some environments may rely on custom runtime logic to toggle state. Ensure the initial disabled state does not break existing flows.

## Notes for Implementer

- Likely minimal change in `public/index.html` (add `disabled` to `#stopBtn`) and/or initialize via script if needed.
- Keep behavior consistent when session state initializes from storage.


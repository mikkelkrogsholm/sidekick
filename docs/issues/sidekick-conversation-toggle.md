### Title
Sidekick Conversations: Add “Record conversation” toggle, pair user+assistant, label clearly, and prevent partial/duplicate entries

### Summary
When I use Push‑to‑Talk with Sidekick, the Secretary mic is paused during PTT so my voice isn’t captured in the Transcript, but Sidekick’s reply often shows up (either because the mic resumes before the reply ends or because Sidekick posts assistant‑only lines to `/ingest`). This yields inconsistent notes: assistant‑only entries or partial pairs.

Add a user‑facing toggle to govern whether Sidekick conversations are recorded into the Transcript/embeddings at all. When enabled, record them as clearly labeled paired entries containing both “You:” and “Sidekick:” lines. When disabled, record neither and prevent Secretary from capturing Sidekick’s reply.

### Goals
- Deterministic control over whether Sidekick conversations appear in the Transcript/embeddings.
- If recorded, ensure both user and assistant parts are present, grouped, and clearly labeled (no one‑sided entries).
- Eliminate duplicates and accidental capture of Sidekick’s reply by the Secretary mic.

### Scope of Change (no backend changes needed)
- UI/Settings: new checkbox in the Settings drawer under “Sidekick”.
- Frontend logic: update Sidekick flow to stage user text, wait for assistant completion, then append/ingest exactly once (or skip entirely), and coordinate Secretary pause/resume semantics to avoid duplicates.

### Proposed UX
- New setting: `Record Sidekick conversations` (id: `sk_record_conversations`, default: Off).
  - OFF: No Sidekick conversation is added to Transcript or `/ingest`. Secretary remains the single source of transcripts.
  - ON: Each Sidekick exchange is appended as a labeled, paired block and ingested as a single combined note.
- Clarify/align existing setting semantics: `Auto-pause Secretary while Sidekick talks` should keep the mic paused from PTT start until Sidekick finishes speaking (resume on `response.done`).

### Markup + Styling Notes
- Transcript labeling
  - Header line: `[Sidekick conversation]` (small, muted/tinted style)
  - Two lines below: `You: …` and `Sidekick: …`
  - Optional: add a subtle background or left border to make these blocks visually scannable.

### Technical Design

Files touched (frontend only):
- `public/settings.js`
  - Add default `sk_record_conversations: false` to settings map and localStorage load/save path.
- `public/index.html`
  - In Settings drawer, add a checkbox under Sidekick: `<input type="checkbox" id="sk_record_conversations"> Record Sidekick conversations`.
  - Optional: rename the label text for `sk_autopause` to make the timing explicit: “Auto‑pause Secretary mic during the entire Sidekick conversation”.
  - Provide (or expose) an append helper so Sidekick can add a conversation block to the Transcript (see “Append helper” below).
- `public/sidekick.js`
  - Pairing logic already exists via `pendingUserUtterance` and the various `response.*.done` events. Extend it to:
    - Gate on `window.Settings.get('sk_record_conversations', false)`.
    - Only append/ingest when both user and assistant are present; otherwise skip entirely.
    - When recording is ON: after assistant completes, build a single combined string and call `/ingest` once. Also append a grouped block to Transcript via the new append helper.
  - Autopause semantics: keep Secretary paused from PTT start until Sidekick response completes (resume on `response.done`). Currently we resume on PTT release, which lets Sidekick audio leak into the Transcript.
  - Prevent assistant‑only ingestion: today we call `ingestPair(pendingUserUtterance, msg.text)` or for audio transcripts in `response.audio_transcript.done`. Ensure we only call ingest when both sides are non‑empty AND the toggle is ON.

Append helper (expose from Index):
- In `public/index.html`, the inline script defines `addTranscriptLine`. Add a wrapper exposed on `window`, for example:
  - `window.Transcript = { addLine(text), addConversation({ user, assistant }) }`.
  - `addConversation` should:
    - Remove placeholder if present
    - Append a small header `[Sidekick conversation]`
    - Append two lines: `You: …` and `Sidekick: …`
    - Auto‑scroll
  - Sidekick calls `window.Transcript?.addConversation({ user, assistant })` when the toggle is ON and pairing is complete.

Event Flow (recording ON):
1) PTT down → Sidekick: set `isRecording` and call `Secretary.pause()`.
2) Sidekick receives `conversation.item.input_audio_transcription.completed` (or typed input) → set `pendingUserUtterance`.
3) Assistant speaks or generates text → accumulate until `response.text.done` or `response.audio_transcript.done`.
4) On completion:
   - Build `{ user: pendingUserUtterance, assistant: finalAssistantText }`.
   - Append via `window.Transcript.addConversation`.
   - `await ingestText("[Sidekick conversation]\nYou: …\nSidekick: …")` (single call).
   - Clear `pendingUserUtterance` and reset local buffers.
5) On `response.done` → call `Secretary.resume()`.

Event Flow (recording OFF):
1) Same PTT start → `Secretary.pause()`.
2) Ignore pairing/append/ingest logic entirely.
3) On `response.done` → `Secretary.resume()`.
4) Result: no conversation content appears in Transcript or `/ingest`.

Important Guards
- Only append/ingest when BOTH `pendingUserUtterance` and final assistant text exist.
- Clear staged state on errors/disconnect to avoid stale pairs.
- Do not rely on mic capture for Sidekick’s reply; treat Sidekick events as the source of truth for the paired block.

Open Questions / Decisions
- Default for `sk_record_conversations`: propose default OFF to keep the current behavior and avoid unintended mixing of interaction logs with passive transcripts.
- Visual treatment: simple text labels vs. subtle block styling. Minimal text labels are enough; styling can be added later.

Acceptance Criteria
- Setting toggle appears in Settings drawer and persists via `public/settings.js`.
- With `sk_record_conversations` OFF:
  - Sidekick exchanges add nothing to Transcript.
  - No `/ingest` calls originate from `sidekick.js` for conversations.
  - Secretary remains paused for the entire Sidekick exchange and resumes after `response.done`; Sidekick’s reply is not captured by Secretary.
- With `sk_record_conversations` ON:
  - After an exchange completes, Transcript shows a single grouped block:
    - `[Sidekick conversation]`
    - `You: …`
    - `Sidekick: …`
  - The pair is ingested exactly once as a single payload; no partial or duplicate entries.
  - Works for both typed and spoken user input.
  - Sidekick reply never appears as an extra Secretary‑captured line.
- No regressions to normal Secretary transcription when Sidekick is idle.

Testing Notes
- Unit/integration (Jest + jsdom):
  - Mock settings to toggle ON/OFF.
  - Simulate event sequence: user transcript event → assistant done → ensure addConversation called and `/ingest` called once (ON), or neither called (OFF).
  - Simulate typed input path (Enter key) and spoken path (PTT events).
  - Verify `Secretary.pause()` called on PTT start and `Secretary.resume()` only after `response.done`.
- Manual:
  - Toggle OFF: perform PTT; confirm Transcript unchanged and buffers don’t contain “You:”/“Sidekick:”.
  - Toggle ON: perform PTT; confirm paired, labeled block in Transcript and a single combined note in embeddings view (after flush).

Risks & Edge Cases
- If assistant produces multiple messages per turn, collect until `response.done` (already handled) and use the final compiled text.
- Network errors on `/ingest`: fail gracefully without duplicating UI lines; optionally retry.

Estimation
- Small/Medium; localized to frontend. Expected 1–2 working sessions including tests and polish.

Related
- UI header alignment issue for Sidekick actions: #10


# Project Scope

## Goals

- Provide real‑time transcription via OpenAI Realtime API (browser ↔ server with ephemeral tokens).
- Store and semantically search transcripts and uploaded knowledge using SQLite + `sqlite-vec`.
- Enable Sidekick assistant interactions that cooperate with the Secretary (PTT pause/resume).

## Non‑Goals

- No long‑term background jobs or distributed workers.
- No client‑side exposure of server API keys.
- No complex multi‑tenant auth beyond minimal rate‑limit and session scoping.

## Supported Stack

- Node.js 18+
- Modern browsers with WebRTC support
- SQLite (local file, overridable via `SQLITE_DB_PATH`)

## Constraints

- Ephemeral tokens must be generated server‑side (`/ephemeral-token`).
- Embedding model default: `text-embedding-3-large`.
- Embedding interval default: 3 minutes; manual flush supported.
- Keep UI minimal, responsive, and performant; avoid heavy client frameworks.

## Quality Targets (pragmatic)

- Tests cover critical paths (Secretary ↔ Sidekick interaction, transcript ingestion, search).
- CI runs lint, format check, and tests on every PR.
- Squash‑merge only; short‑lived branches.

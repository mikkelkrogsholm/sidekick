# Secretary + Sidekick: Realtime Transcription, PTT Assistant, and Semantic Search

A browser‑based Secretary (live transcription) and a Sidekick assistant with push‑to‑talk (PTT). Transcripts and uploaded knowledge are embedded into SQLite (`sqlite-vec`) for fast semantic search. All OpenAI access happens server‑side with ephemeral tokens.

## Features

- Realtime transcription via OpenAI Realtime API (WebRTC)
- Sidekick assistant with PTT that auto‑pauses/resumes Secretary
- Session management with transcript history
- Buffered transcript ingestion with auto‑flush (interval) and manual flush
- Semantic search across transcripts and uploaded knowledge
- Knowledge uploads: `.txt`, `.md`, `.pdf` (chunked + embedded)
- Clean, minimal UI: `index.html` (Secretary), `dashboard.html` (sessions + knowledge), `viewer.html` (transcripts)

## Prerequisites

- Node.js 18+
- OpenAI API key with access to Realtime + Embeddings APIs

## Setup

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Set the required key (server‑side only):
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```
4. Start the server:
   ```bash
   npm start
   ```
   Or for development with auto‑reload:
   ```bash
   npm run dev
   ```
5. Open your browser: `http://localhost:3000`

Data is stored locally under `./data/` (including `./data/uploads/` for knowledge files). Override DB path via `SQLITE_DB_PATH`.

## How to Use

- Secretary only
  - Open `/` and click Start; allow microphone; speak; see live transcript
- Sidekick PTT
  - Use the Sidekick panel to press and hold PTT; Secretary auto‑pauses; on release, Secretary resumes
- Knowledge
  - In Dashboard, upload `.txt/.md/.pdf`; files are chunked and embedded for search
- Search
  - Query recent transcripts and/or knowledge; results are nearest matches from `sqlite-vec`

## Architecture

- Backend (`server.js`): Express API, ingestion buffer, embedding, session/knowledge/search endpoints
- Database (`db.js`): SQLite with `sqlite-vec` for vector similarity search
- Frontend (`public/`):
  - `index.html`: Secretary UI + Realtime connection
  - `sidekick.js`: PTT assistant coordination with Secretary
  - `dashboard.html`, `viewer.html`: session management and viewing
- OpenAI:
  - Realtime sessions created server‑side via `/ephemeral-token` (model `gpt-4o-realtime-preview-2024-12-17`, transcription `whisper-1`)
  - Embeddings via `text-embedding-3-large` (configurable)

High‑level flow: Browser streams audio over WebRTC → server mints ephemeral session → partial transcripts are buffered and periodically embedded → search combines transcripts and uploaded knowledge.

## API Overview (selected)

- `GET /ephemeral-token` — Create short‑lived Realtime session (accepts `?language=`)
- `POST /ingest` — Append transcript text to a session buffer
- `POST /api/sessions` — Create a session; `GET /api/sessions` list; `GET /api/sessions/:id` fetch
- `GET /api/sessions/:id/transcripts` — List embedded transcript chunks
- `POST /api/sessions/:id/flush` — Force embed buffered text now
- `POST /api/sessions/:id/knowledge` — Upload `.txt/.md/.pdf` or raw text+filename
- `GET /api/sessions/:id/last-chunk` — Last content chunk (buffer or DB)
- `POST /api/search` — Semantic search over transcripts/knowledge
- `DELETE /api/sessions/:id` — Delete a session (+ its embeddings)
- `DELETE /api/embeddings/:rowid` — Delete a single embedding row

## Configuration

- Required: `OPENAI_API_KEY`
- Optional:
  - `SQLITE_DB_PATH` — SQLite file path (default `./data/transcripts.db`)
  - `EMBEDDING_MODEL` — Defaults to `text-embedding-3-large`
  - `EMBED_STRATEGY` — `minutely` (default)
  - `EMBED_INTERVAL_MINUTES` — Default `3`
  - `MAX_UPLOAD_SIZE` — Bytes (default 10MB)

## Tests

- Run all tests: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

Tests live under `tests/**/*.test.js` (jsdom + Babel). Coverage is collected for `public/**/*.js`, `server.js`, and `db.js` (excluding `public/settings.js`).

## Security

- Never expose `OPENAI_API_KEY` in client code
- Ephemeral tokens are minted server‑side at `/ephemeral-token`
- CORS enabled for browser access; basic rate limiting applied server‑side

## Troubleshooting

- "Failed to create session": verify `OPENAI_API_KEY` and Realtime API access
- No transcript: ensure mic permissions; try a supported browser
- Search empty: ensure transcripts/knowledge are embedded (wait for interval or use flush)

For scope and constraints, see `docs/PROJECT_SCOPE.md`. For contribution rules and CI, see `CONTRIBUTING.md`.

# Repository Guidelines

## Project Structure & Module Organization
- `server.js`: Express API (ephemeral token, `/ingest`, session CRUD, embedding flush/auto‑flush).
- `db.js`: SQLite accessors (sessions, vector storage via `sqlite-vec`).
- `public/`: Client app (Secretary + Sidekick UI)
  - `index.html`, `dashboard.html`, `viewer.html`
  - `sidekick.js`, `settings.js`, `styles/`
- `tests/`: Jest + jsdom tests (integration around Secretary/Sidekick/WebRTC).
- `data/`: Default SQLite location (configurable via `SQLITE_DB_PATH`).

## Build, Test, and Development Commands
- `npm start`: Run the server on `http://localhost:3000`.
- `npm run dev`: Watch mode for local development.
- `npm test`: Run Jest tests.
- `npm run test:watch`: Re-run tests on change.
- `npm run test:coverage`: Produce coverage reports.

Before running: `cp .env.example .env` and set `OPENAI_API_KEY`. Node 18+ required.

## Coding Style & Naming Conventions
- JavaScript (ES modules in backend; vanilla modules in `public/`).
- Indentation: 2 spaces; line width ~100–120.
- Naming: `camelCase` for vars/functions, `PascalCase` for classes, `kebab-case` filenames.
- Keep server routes cohesive in `server.js`; co-locate small helpers near use.

## Testing Guidelines
- Framework: Jest with `jsdom` environment and Babel (see `package.json`).
- Location: `tests/**/*.test.js` (e.g., `tests/secretary-sidekick.test.js`).
- Coverage: Collected for `public/**/*.js`, `server.js`, `db.js` (excluding `public/settings.js`).
- Run specific tests: `jest path/to/file.test.js`.

## Commit & Pull Request Guidelines
- Commits: Use concise, imperative subjects (e.g., "Add Sidekick PTT swap"). Link issues: `Fixes #4`.
- PRs: Include description, testing steps, screenshots for UI changes, and linked issues. Ensure `npm test` passes.
- Scope PRs narrowly; avoid unrelated formatting. Do not commit `.env` or secrets.

## Security & Configuration Tips
- Required: `OPENAI_API_KEY` (server-side only). Optional: `SQLITE_DB_PATH`, `EMBEDDING_MODEL`, `EMBED_STRATEGY`, `EMBED_INTERVAL_MINUTES`.
- Ephemeral tokens are minted server-side at `/ephemeral-token`; never expose your server key to the client.
- Caution with logs: avoid printing sensitive values in production.

# Contributing

This repo uses a dual‑agent workflow: Planner (CodeX) proposes failing tests as the contract; Implementer (Claude) writes the minimal code to make them pass. Squash‑merge to keep history tidy.

## Branching & PR Process

- Trunk‑based development on `main` (protected).
- Short‑lived branches: `feat/<slug>` for features, `fix/<slug>` for fixes, `chore/<slug>` for chores.
- Planner opens the PR with failing tests only and a clear spec (use the PR template).
- Implementer pushes commits to the same branch until CI is green.
- Merge via squash‑merge only once CI passes.
- If the spec is wrong/unsafe: comment on the PR with `CHANGE_REQUEST: <reason + proposed fix>`.

## Code Quality Tools

- Formatter: Prettier
  - Check: `npm run format:check`
  - Write: `npm run format`
- Linter: ESLint (`eslint:recommended` for Node18/Browser/Jest)
  - Run: `npm run lint`
- Type checking: none enforced. Feel free to use JSDoc where helpful.

## Tests

- Framework: Jest with `jsdom` and Babel (Node 18).
- Location: `tests/**/*.test.js` (e.g. `tests/secretary-sidekick.test.js`).
- Coverage: collected for `public/**/*.js`, `server.js`, `db.js` (excluding `public/settings.js`).
- Commands:
  - `npm test` (all tests)
  - `npm run test:watch`
  - `npm run test:coverage`

## Secrets & Security

- Required: `OPENAI_API_KEY` (server‑side only). Never commit or expose in client code.
- Optional env: `SQLITE_DB_PATH`, `EMBEDDING_MODEL`, `EMBED_STRATEGY`, `EMBED_INTERVAL_MINUTES`.
- Ephemeral tokens are minted server‑side at `/ephemeral-token`; never expose the server key to the client.
- Be cautious with logs in production environments; avoid printing sensitive values.

## CI Policy

- CI runs on pushes to `feat/**`, `fix/**`, `chore/**` and PRs to `main`.
- Jobs: lint, format check, tests. All must pass before merge.

## Project Structure

- `server.js`: Express API (ephemeral token, `/ingest`, session CRUD, embedding flush/auto‑flush).
- `db.js`: SQLite accessors (sessions, vector storage via `sqlite-vec`).
- `public/`: Client app (Secretary + Sidekick UI)
  - `index.html`, `dashboard.html`, `viewer.html`
  - `sidekick.js`, `settings.js`, `styles/`
- `tests/`: Jest + jsdom tests (integration around Secretary/Sidekick/WebRTC).
- `data/`: Default SQLite location (configurable via `SQLITE_DB_PATH`).

## Commit Hygiene

- Keep changes focused; avoid unrelated formatting in feature PRs.
- Use concise, imperative subjects (e.g., "Add Sidekick PTT swap").
- Link issues with `Fixes #<id>` when applicable.

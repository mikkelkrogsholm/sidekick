### Title
Clean Design: Session Knowledge Uploads (dedicated tables + RAG integration)

### Summary
Enable users to attach external knowledge (reports/files) to a session and have Sidekick use it for retrieval‑augmented responses. Implement a clean, dedicated knowledge store separate from live transcripts for clarity, scalability, and metadata richness.

### Goals
- Upload, process, embed, and search session‑scoped knowledge.
- Keep knowledge separate from transcripts (no schema mixing) while allowing combined retrieval.
- Provide clear source attribution and basic CRUD for knowledge items.

### Non‑Goals (this issue)
- Cross‑session/global knowledge sharing.
- OCR, images, or non‑text extraction beyond basic PDFs/Docx/TXT/MD.
- Large async job orchestration beyond a simple in‑process queue.

### Architecture

Database (new tables)
```
knowledge_sources (
  id              TEXT PRIMARY KEY,         -- uuid
  session_id      TEXT NOT NULL,            -- FK → sessions.id (soft FK)
  name            TEXT NOT NULL,            -- display name (filename)
  type            TEXT NOT NULL,            -- 'pdf' | 'txt' | 'md' | 'docx'
  file_path       TEXT NOT NULL,            -- ./data/uploads/<uuid>.<ext>
  status          TEXT NOT NULL,            -- 'queued' | 'processing' | 'ready' | 'error'
  error           TEXT,                     -- optional last error
  metadata_json   TEXT,                     -- pages, size, content hash, etc.
  created_at      TEXT NOT NULL
);

knowledge_chunks (
  id              TEXT PRIMARY KEY,
  source_id       TEXT NOT NULL,            -- FK → knowledge_sources.id
  session_id      TEXT NOT NULL,            -- index for session‑scoped search
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  embedding       FLOAT[3072] NOT NULL,     -- text‑embedding‑3‑large
  content_hash    TEXT,                     -- for dedup
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_knowledge_chunks_session ON knowledge_chunks(session_id);
CREATE INDEX idx_knowledge_chunks_source ON knowledge_chunks(source_id);
```

API (new)
- `POST /api/sessions/:id/knowledge` — multipart or JSON upload (MVP: text payload + filename)
  - Returns: `{ sourceId }` and immediate `status: queued|processing|ready`.
- `GET /api/sessions/:id/knowledge` — list sources with status and counts
- `DELETE /api/sessions/:id/knowledge/:sourceId` — delete source and its chunks
- `GET /api/sessions/:id/knowledge/:sourceId` — detail with chunk counts, metadata

API (existing, extend)
- `POST /api/search`
  - Add option: `include: "transcripts" | "knowledge" | "both"` (default: `both`).
  - Option: `k_transcripts` and `k_knowledge` for mixed retrieval.
  - Response: include `source: 'transcript' | 'knowledge'` and `attribution` for knowledge items (source name + chunk_index).

Processing Pipeline
1) Upload → save file under `./data/uploads/` (UUID name). Enforce size/MIME limits.
2) Extract text (support TXT, MD, PDF; DOCX optional). Fail with `status=error` and `error` message on parse errors.
3) Token‑aware chunking (~1000 tokens, ~200 overlap). Persist `chunk_index`.
4) Deduplicate by `content_hash` (SHA‑256 of normalized text) within the same `source_id`.
5) Embed with `text-embedding-3-large` and insert into `knowledge_chunks`.
6) Mark source `status=ready`.

Security & Limits
- Max upload size: 10 MB (configurable env).
- Accept only whitelisted types; sniff MIME and extension; sanitize display names.
- Store under `./data/uploads/`; never serve raw files directly without auth.

Sidekick Context Integration
- Default mixed retrieval: last transcript chunk + top‑k from transcripts and knowledge (e.g., k=3 each).
- Provide a Settings toggle for which sources to include when building context (optional, separate PR).

UI
- Session page: “Knowledge” panel with upload (drag/drop), list, delete.
- In viewer/search results, display source attribution for knowledge hits.

Acceptance Criteria
- Upload a small TXT/PDF → source shows as `ready` with chunk count.
- `POST /api/search` with `include=knowledge` returns relevant knowledge chunks with attribution.
- `include=both` returns a merged list; Sidekick context builder can consume both.
- Deleting a source removes its chunks; subsequent search excludes them.
- No changes to `vec_transcripts` schema; transcripts remain separate.

Testing
- Unit: chunking, hashing, file gating.
- Integration: upload → chunks in DB → searchable → context assembly mixes sources correctly.
- Error paths: bad file type, large file, extraction failure, embed failure (retry/backoff), deletion cascades.

Implementation Notes
- Avoid altering sqlite‑vec virtual tables (no `ALTER TABLE`).
- Use a small in‑process queue for embedding; for large files, add simple progress (status polling).
- Keep functions co‑located in `server.js` with small helpers; expand to modules if needed later.

Rollout
1) DB migrations (create new tables + indexes).
2) Minimal upload endpoint (TXT/MD only), then add PDF.
3) Chunking + embedding + search integration.
4) UI panel for upload/list/delete.
5) Sidekick context toggle (optional).


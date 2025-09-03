// db.js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const DB_PATH = process.env.SQLITE_DB_PATH || "./data/transcripts.db";

// ensure ./data exists
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch (err) {
  console.error("Failed to create data directory:", err);
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH);
  console.log("SQLite database initialized at:", DB_PATH);
} catch (err) {
  console.error("Failed to initialize SQLite database:", err);
  process.exit(1);
}

// Load sqlite-vec into this connection (works with better-sqlite3)
try {
  sqliteVec.load(db); // exposes vec0 virtual table + vector funcs
  console.log("sqlite-vec extension loaded successfully");
} catch (err) {
  console.error("Warning: Failed to load sqlite-vec extension. Vector search will be unavailable:", err);
  // Continue without vector support - basic functionality still works
}

try {
  db.exec(`
    create virtual table if not exists vec_transcripts using vec0(
      session_id text partition key,
      started_at text,
      ended_at   text,
      language   text,
      embedding  float[3072] distance_metric=cosine,
      +content   text
    );
    
    create table if not exists sessions (
      id text primary key,
      name text not null,
      created_at text not null,
      updated_at text not null,
      total_transcripts integer default 0
    );
  `);
} catch (err) {
  console.error("Error creating database tables:", err);
  // Try creating just the sessions table if vec_transcripts fails
  try {
    db.exec(`
      create table if not exists sessions (
        id text primary key,
        name text not null,
        created_at text not null,
        updated_at text not null,
        total_transcripts integer default 0
      );
    `);
    console.log("Created sessions table (vector support disabled)");
  } catch (fallbackErr) {
    console.error("Failed to create database tables:", fallbackErr);
    process.exit(1);
  }
}

export function insertEmbedding({ sessionId, startedAt, endedAt, language, content, embedding }) {
  try {
    // sqlite-vec expects a float vector; pass as Float32Array (better-sqlite3 binds it correctly)
    const vector = new Float32Array(embedding);
    const stmt = db.prepare(`
      insert into vec_transcripts (session_id, started_at, ended_at, language, embedding, content)
      values (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(sessionId, startedAt, endedAt, language, vector, content);
  } catch (err) {
    console.error("Error inserting embedding:", err);
    throw err; // Re-throw to trigger retry logic
  }
}

// Optional: Add a search function for later use
export function searchSimilar(queryEmbedding, limit = 5, sessionId = null) {
  try {
    const vector = new Float32Array(queryEmbedding);
    
    if (sessionId) {
      const stmt = db.prepare(`
        select rowid, session_id, content, distance
        from vec_transcripts
        where session_id = ? and embedding match ? and k = ?
        order by distance
      `);
      return stmt.all(sessionId, vector, limit);
    } else {
      const stmt = db.prepare(`
        select rowid, session_id, content, distance
        from vec_transcripts
        where embedding match ? and k = ?
        order by distance
      `);
      return stmt.all(vector, limit);
    }
  } catch (err) {
    console.error("Vector search not available (sqlite-vec may not be loaded):", err);
    // Return empty results if vector search fails
    return [];
  }
}

// Session management functions
export function createSession(name) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    insert into sessions (id, name, created_at, updated_at, total_transcripts)
    values (?, ?, ?, ?, 0)
  `);
  stmt.run(id, name, now, now);
  return { id, name, created_at: now, updated_at: now, total_transcripts: 0 };
}

export function getSessions() {
  const stmt = db.prepare(`
    select * from sessions
    order by updated_at desc
  `);
  return stmt.all();
}

export function getSession(id) {
  const stmt = db.prepare(`
    select * from sessions where id = ?
  `);
  return stmt.get(id);
}

export function updateSessionTranscriptCount(sessionId) {
  const stmt = db.prepare(`
    update sessions 
    set total_transcripts = total_transcripts + 1,
        updated_at = ?
    where id = ?
  `);
  stmt.run(new Date().toISOString(), sessionId);
}

export function getSessionTranscripts(sessionId) {
  const stmt = db.prepare(`
    select rowid, started_at, ended_at, language, content
    from vec_transcripts
    where session_id = ?
    order by started_at desc
  `);
  return stmt.all(sessionId);
}

export default db;
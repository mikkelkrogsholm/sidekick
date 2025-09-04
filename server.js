import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import db, { insertEmbedding, createSession, getSessions, getSession, updateSessionTranscriptCount, getSessionTranscripts, searchSimilar, deleteSession, deleteEmbedding, recalculateTranscriptCount } from "./db.js";
import { getIcon, formatMessage } from "./icons-console.js";

dotenv.config();

// Startup validation
if (!process.env.OPENAI_API_KEY) {
  console.error(formatMessage('error', 'OPENAI_API_KEY is not set in environment variables'));
  console.error("Please create a .env file with your OpenAI API key");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
  console.error(formatMessage('warning', "OPENAI_API_KEY doesn't look valid (should start with 'sk-')"));
}

const app = express();

// Simple rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const limit = rateLimitMap.get(ip);
  
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: "Too many requests, please try again later" });
  }
  
  limit.count++;
  next();
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Enable CORS for browser access
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBED_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-large";
const STRATEGY = (process.env.EMBED_STRATEGY || "minutely").toLowerCase();
const INTERVAL_MIN = Number(process.env.EMBED_INTERVAL_MINUTES || 3);

// --- transcript buffer (per session) ---
/**
 * buffers: Map<sessionId, {
 *   language: string,
 *   startedAt: string, // ISO for first line
 *   lastAt: string,    // ISO for most recent line
 *   lines: string[]
 * }>
 */
const buffers = new Map();

// Client sends transcript snippets here as they arrive
app.post("/ingest", rateLimit, (req, res) => {
  const { sessionId, language = "en", text } = req.body || {};
  if (!sessionId || !text || !text.trim()) {
    return res.status(400).json({ ok: false, error: "missing sessionId or text" });
  }
  
  // Validate session exists
  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const now = new Date().toISOString();
  const buf = buffers.get(sessionId) || { language, startedAt: now, lastAt: now, lines: [] };
  buf.language = language || buf.language;
  buf.lastAt = now;
  buf.lines.push(text.trim());
  if (!buf.startedAt) buf.startedAt = now;
  buffers.set(sessionId, buf);
  res.json({ ok: true });
});

// Silence detection - check every 10 seconds for inactive sessions
setInterval(async () => {
  const now = Date.now();
  const SILENCE_THRESHOLD = 15 * 1000; // 15 seconds of silence triggers flush
  
  for (const [sessionId, buf] of buffers.entries()) {
    if (!buf.lines.length) continue;
    
    // Check if session has been silent for threshold period
    const lastActivityTime = new Date(buf.lastAt).getTime();
    const silenceDuration = now - lastActivityTime;
    
    if (silenceDuration >= SILENCE_THRESHOLD) {
      console.log(`Silence detected for session ${sessionId} (${Math.round(silenceDuration/1000)}s) - auto-flushing`);
      
      // Grab and clear atomically
      const lines = buf.lines.splice(0, buf.lines.length);
      const content = lines.join(" ").trim();
      if (!content) continue;
      
      try {
        const resp = await openai.embeddings.create({
          model: EMBED_MODEL,
          input: content
        });
        const vector = resp.data[0].embedding;
        
        insertEmbedding({
          sessionId,
          startedAt: buf.startedAt,
          endedAt: buf.lastAt,
          language: buf.language,
          content,
          embedding: vector
        });
        
        updateSessionTranscriptCount(sessionId);
        console.log(`Auto-flushed ${content.length} chars for session ${sessionId} due to silence`);
        
        // Reset for next chunk
        buf.startedAt = new Date().toISOString();
      } catch (err) {
        console.error(`Error auto-flushing session ${sessionId}:`, err);
        // Put lines back on error
        buf.lines.unshift(...lines);
      }
    }
  }
}, 10 * 1000); // Check every 10 seconds

// periodic flush — chosen strategy: every N minutes (as fallback)
setInterval(async () => {
  if (STRATEGY !== "minutely") return; // (keeping room for a tokens-based variant later)

  for (const [sessionId, buf] of buffers.entries()) {
    if (!buf.lines.length) continue;

    // Grab and clear atomically
    const lines = buf.lines.splice(0, buf.lines.length);
    const content = lines.join(" ").trim();
    if (!content) continue;

    // embed the 3-minute chunk with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    let embedded = false;
    
    while (!embedded && retryCount < maxRetries) {
      try {
        const resp = await openai.embeddings.create({
          model: EMBED_MODEL,
          input: content
        });
        const vector = resp.data[0].embedding; // array<number>

        insertEmbedding({
          sessionId,
          startedAt: buf.startedAt,
          endedAt: buf.lastAt,
          language: buf.language,
          content,
          embedding: vector
        });
        
        // Update session transcript count
        updateSessionTranscriptCount(sessionId);

        console.log(`Interval flush: Embedded ${content.length} chars for session ${sessionId} (3-min interval)`);
        embedded = true;

        // next chunk will have a fresh window start time
        buf.startedAt = new Date().toISOString();
      } catch (err) {
        retryCount++;
        console.error(`Embedding error (attempt ${retryCount}/${maxRetries}):`, err?.response?.data || err);
        
        if (retryCount >= maxRetries) {
          // After max retries, keep content in buffer for next interval
          console.error(`Failed to embed after ${maxRetries} attempts. Keeping content in buffer.`);
          // Put the lines back at the beginning of the buffer
          buf.lines.unshift(...lines);
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    }
  }
}, Math.max(1, INTERVAL_MIN) * 60 * 1000);

// Cleanup old buffers every hour to prevent memory leaks
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let cleanedCount = 0;
  
  for (const [sessionId, buf] of buffers.entries()) {
    // Remove buffers that haven't been updated in over an hour and have no pending lines
    if (buf.lastAt < oneHourAgo && buf.lines.length === 0) {
      buffers.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} idle session buffers`);
  }
}, 60 * 60 * 1000); // Run every hour

// Session management endpoints
app.post("/api/sessions", rateLimit, (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Session name is required" });
  }
  
  // Validate session name length
  if (name.length > 100) {
    return res.status(400).json({ error: "Session name too long (max 100 characters)" });
  }
  
  try {
    const session = createSession(name.trim());
    res.json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.get("/api/sessions", (req, res) => {
  try {
    const sessions = getSessions();
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

app.get("/api/sessions/:id", (req, res) => {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

app.get("/api/sessions/:id/transcripts", (req, res) => {
  try {
    const transcripts = getSessionTranscripts(req.params.id);
    res.json(transcripts);
  } catch (error) {
    console.error("Error fetching transcripts:", error);
    res.status(500).json({ error: "Failed to fetch transcripts" });
  }
});

// Flush session buffer - immediately embed any pending transcripts
app.post("/api/sessions/:id/flush", rateLimit, async (req, res) => {
  const sessionId = req.params.id;
  
  try {
    // Check if session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Get the buffer for this session
    const buf = buffers.get(sessionId);
    if (!buf || !buf.lines.length) {
      return res.json({ 
        message: "No pending transcripts to flush",
        flushed: false,
        sessionId 
      });
    }
    
    // Grab and clear the buffer atomically
    const lines = buf.lines.splice(0, buf.lines.length);
    const content = lines.join(" ").trim();
    
    if (!content) {
      return res.json({ 
        message: "Buffer was empty",
        flushed: false,
        sessionId 
      });
    }
    
    console.log(`Manual flush triggered for session ${sessionId}: ${content.length} chars`);
    
    // Embed the content
    try {
      const resp = await openai.embeddings.create({
        model: EMBED_MODEL,
        input: content
      });
      const vector = resp.data[0].embedding;
      
      insertEmbedding({
        sessionId,
        startedAt: buf.startedAt,
        endedAt: buf.lastAt,
        language: buf.language,
        content,
        embedding: vector
      });
      
      // Update session transcript count
      updateSessionTranscriptCount(sessionId);
      
      console.log(`Successfully flushed and embedded ${content.length} chars for session ${sessionId}`);
      
      // Reset the buffer's start time for next chunk
      buf.startedAt = new Date().toISOString();
      
      res.json({ 
        message: "Transcripts flushed and embedded successfully",
        flushed: true,
        contentLength: content.length,
        sessionId 
      });
    } catch (embedError) {
      console.error("Error embedding during flush:", embedError);
      // Put the lines back if embedding failed
      buf.lines.unshift(...lines);
      res.status(500).json({ 
        error: "Failed to embed transcripts",
        details: embedError.message 
      });
    }
  } catch (error) {
    console.error("Error in flush endpoint:", error);
    res.status(500).json({ error: "Failed to flush session" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  try {
    // Check database connection
    const dbCheck = db.prepare("SELECT 1 as test").get();
    
    // Check OpenAI API key exists
    const apiKeyExists = !!process.env.OPENAI_API_KEY;
    
    // Count sessions
    const sessionCount = db.prepare("SELECT COUNT(*) as count FROM sessions").get().count;
    
    // Try to count transcripts, but handle if vec_transcripts doesn't exist
    let transcriptCount = 0;
    try {
      transcriptCount = db.prepare("SELECT COUNT(*) as count FROM vec_transcripts").get().count;
    } catch (err) {
      // vec_transcripts table might not exist if sqlite-vec failed to load
      console.log("vec_transcripts table not available");
    }
    
    res.json({
      status: "healthy",
      database: dbCheck ? "connected" : "disconnected",
      apiKey: apiKeyExists ? "configured" : "missing",
      stats: {
        sessions: sessionCount,
        transcripts: transcriptCount,
        activeBuffers: buffers.size
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all embedded chunks (for debugging/viewing)
app.get("/api/embeddings", (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 100;
    // Cap limit to prevent DoS
    limit = Math.min(Math.max(1, limit), 1000);
    const sessionId = req.query.sessionId;
    
    let query;
    if (sessionId) {
      query = db.prepare(`
        SELECT rowid, session_id, started_at, ended_at, language, content, 
               length(content) as content_length
        FROM vec_transcripts
        WHERE session_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `);
      const embeddings = query.all(sessionId, limit);
      res.json(embeddings);
    } else {
      query = db.prepare(`
        SELECT rowid, session_id, started_at, ended_at, language, content,
               length(content) as content_length
        FROM vec_transcripts
        ORDER BY started_at DESC
        LIMIT ?
      `);
      const embeddings = query.all(limit);
      res.json(embeddings);
    }
  } catch (error) {
    console.error("Error fetching embeddings:", error);
    res.status(500).json({ error: "Failed to fetch embeddings" });
  }
});

// Search similar embeddings
app.post("/api/search", rateLimit, async (req, res) => {
  try {
    let { query, limit = 5, sessionId } = req.body;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    // Validate search parameters
    if (query.length > 1000) {
      return res.status(400).json({ error: "Search query too long (max 1000 characters)" });
    }
    
    // Cap limit to prevent DoS
    limit = Math.min(Math.max(1, limit), 100);
    
    // Generate embedding for search query
    const resp = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query
    });
    const queryEmbedding = resp.data[0].embedding;
    
    // Search for similar embeddings
    const results = searchSimilar(queryEmbedding, limit, sessionId);
    res.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Delete a session and all its embeddings
app.delete("/api/sessions/:id", rateLimit, (req, res) => {
  const sessionId = req.params.id;
  
  try {
    // Check if session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Clear buffer if it exists for this session
    if (buffers.has(sessionId)) {
      buffers.delete(sessionId);
      console.log(`Cleared buffer for session ${sessionId}`);
    }
    
    // Delete session and embeddings
    const result = deleteSession(sessionId);
    
    console.log(`Deleted session ${sessionId}: ${result.transcriptsDeleted} transcripts removed`);
    
    res.json({
      message: "Session deleted successfully",
      sessionId,
      sessionName: session.name,
      transcriptsDeleted: result.transcriptsDeleted
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// Delete an individual embedding
app.delete("/api/embeddings/:rowid", rateLimit, (req, res) => {
  const rowid = req.params.rowid;
  const { sessionId } = req.body || {};
  
  try {
    // Validate rowid is a number
    const rowidNum = parseInt(rowid);
    if (isNaN(rowidNum)) {
      return res.status(400).json({ error: "Invalid embedding ID" });
    }
    
    // Delete the embedding
    const deleted = deleteEmbedding(rowidNum);
    
    if (!deleted) {
      return res.status(404).json({ error: "Embedding not found" });
    }
    
    // Recalculate transcript count if session ID provided
    let newCount = null;
    if (sessionId) {
      newCount = recalculateTranscriptCount(sessionId);
      console.log(`Recalculated transcript count for session ${sessionId}: ${newCount}`);
    }
    
    console.log(`Deleted embedding ${rowid}`);
    
    res.json({
      message: "Embedding deleted successfully",
      rowid: rowidNum,
      newTranscriptCount: newCount
    });
  } catch (error) {
    console.error("Error deleting embedding:", error);
    res.status(500).json({ error: "Failed to delete embedding" });
  }
});

// Optional debug endpoint to check database entries
app.get("/debug/count", (req, res) => {
  const row = db.prepare("select count(*) as n from vec_transcripts").get();
  res.json(row);
});

// Get last chunk endpoint for Sidekick context
app.get("/api/sessions/:id/last-chunk", rateLimit, (req, res) => {
  const { id } = req.params;
  try {
    // 1) buffer first
    const buf = buffers.get(id); // this exists in your server.js
    if (buf && buf.lines && buf.lines.length) {
      return res.json({
        source: "buffer",
        content: buf.lines.join(" ").trim(),
        started_at: buf.startedAt || null,
        ended_at:   buf.lastAt   || null,
        language:   buf.language || null
      });
    }

    // 2) fallback to DB
    const row = db.prepare(`
      select content, started_at, ended_at, language
      from vec_transcripts
      where session_id = ?
      order by ended_at desc
      limit 1
    `).get(id);

    if (!row) return res.json({ source: "none", content: "" });
    res.json({ source: "db", ...row });
  } catch (err) {
    console.error("last-chunk error", err);
    res.status(500).json({ error: "Failed to read last chunk" });
  }
});

app.get("/ephemeral-token", rateLimit, async (req, res) => {
  try {
    // Get language from query parameter, default to English
    const language = req.query.language || "en";
    
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "marin",                     // Use marin voice
        turn_detection: { type: "server_vad" }, // Enable server VAD for automatic speech detection
        input_audio_transcription: {       // Enable transcription
          model: "whisper-1",
          language: language               // Force specific language for better accuracy
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return res.status(response.status).json({ error: "Failed to create session" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║        Voice Transcription Server Started       ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║ ${getIcon('server')} Server:    http://localhost:${PORT}${' '.repeat(13 - PORT.toString().length)}║`);
  console.log(`║ ${getIcon('viewer')} Viewer:    http://localhost:${PORT}/viewer.html${' '.repeat(3 - PORT.toString().length)}║`);
  console.log(`║ ${getIcon('database')} Database:  ${process.env.SQLITE_DB_PATH ? 'OK Custom path' : 'OK Default path'}            ║`);
  console.log(`║ ${getIcon('robot')} AI Model:  ${EMBED_MODEL.substring(0, 20).padEnd(20)}         ║`);
  console.log(`║ ${getIcon('time')} Interval:  ${INTERVAL_MIN} minutes                         ║`);
  console.log("╚════════════════════════════════════════════════╝");
});

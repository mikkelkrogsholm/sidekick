import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import multer from "multer";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import db, { 
  insertEmbedding, createSession, getSessions, getSession, 
  updateSessionTranscriptCount, getSessionTranscripts, searchSimilar, 
  deleteSession, deleteEmbedding, recalculateTranscriptCount,
  createKnowledgeSource, getKnowledgeSources, getKnowledgeSource,
  updateKnowledgeSourceStatus, deleteKnowledgeSource, insertKnowledgeChunk,
  getKnowledgeChunks, getKnowledgeChunkCount, searchSimilarKnowledge
} from "./db.js";
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
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || "10485760"); // 10MB default

// Ensure uploads directory exists for knowledge files
try {
  fsSync.mkdirSync('./data/uploads', { recursive: true });
} catch (e) {
  console.error('Failed to ensure uploads directory exists', e);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './data/uploads/')
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const id = crypto.randomUUID();
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const extOk = /\.(txt|md|pdf)$/.test(ext);
    if (!extOk) {
      return cb(new Error('Invalid file extension. Only TXT, MD, and PDF files are allowed.'));
    }

    const mimeRaw = (file.mimetype || '').toLowerCase();
    const mime = mimeRaw.split(';')[0].trim();
    const isOctet = ['application/octet-stream', 'binary/octet-stream', ''].includes(mime);

    let mimeOk = false;
    if (ext === '.md' || ext === '.txt') {
      const allowedTextMimes = [
        'text/plain',
        'text/markdown',
        'text/x-markdown',
        'application/markdown',
        'application/x-markdown'
      ];
      mimeOk = allowedTextMimes.includes(mime) || isOctet || mime.startsWith('text/');
    } else if (ext === '.pdf') {
      mimeOk = mime === 'application/pdf' || isOctet;
    }

    if (!mimeOk) {
      return cb(new Error(`Invalid MIME type for ${ext} file: ${mime || 'unknown'}.`));
    }

    return cb(null, true);
  }
});

// Wrap multer to return JSON on validation errors
function uploadSingleMiddleware(req, res, next) {
  upload.single('file')(req, res, function (err) {
    if (err) {
      const status = /file too large/i.test(err.message) ? 413 : 400;
      return res.status(status).json({ error: err.message });
    }
    next();
  });
}

// Text extraction functions
async function extractTextFromFile(filePath, type) {
  try {
    switch (type.toLowerCase()) {
      case 'txt':
      case 'md':
        return await fs.readFile(filePath, 'utf-8');
        
      case 'pdf':
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;
        
      case 'docx':
      case 'doc':
        // For now, we'll skip DOCX support and add it later if needed
        throw new Error('DOCX support coming soon');
        
      default:
        throw new Error(`Unsupported file type: ${type}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    throw error;
  }
}

// Chunking function - token-aware splitting
function chunkText(text, maxTokens = 1000, overlapTokens = 200) {
  // Simple word-based approximation (1 token ≈ 0.75 words on average)
  const wordsPerToken = 0.75;
  const maxWords = Math.floor(maxTokens * wordsPerToken);
  const overlapWords = Math.floor(overlapTokens * wordsPerToken);
  
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += (maxWords - overlapWords)) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
    
    // Stop if we've reached the end
    if (i + maxWords >= words.length) break;
  }
  
  return chunks;
}

// Content hash function for deduplication
function hashContent(content) {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

// Process knowledge source - extract, chunk, embed
async function processKnowledgeSource(sourceId) {
  const source = getKnowledgeSource(sourceId);
  if (!source) {
    throw new Error('Knowledge source not found');
  }
  
  try {
    // Update status to processing
    updateKnowledgeSourceStatus(sourceId, 'processing');
    
    // Extract text
    const text = await extractTextFromFile(source.file_path, source.type);
    
    // Chunk the text
    const chunks = chunkText(text);
    
    // Track metadata
    const metadata = {
      totalChunks: chunks.length,
      fileSize: (await fs.stat(source.file_path)).size,
      processedAt: new Date().toISOString()
    };
    
    // Process each chunk
    let processedChunks = 0;
    const seenHashes = new Set();
    
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const contentHash = hashContent(content);
      
      // Skip duplicate chunks within the same source
      if (seenHashes.has(contentHash)) {
        console.log(`Skipping duplicate chunk ${i} in source ${sourceId}`);
        continue;
      }
      seenHashes.add(contentHash);
      
      // Generate embedding
      const resp = await openai.embeddings.create({
        model: EMBED_MODEL,
        input: content
      });
      const embedding = resp.data[0].embedding;
      
      // Store chunk (ensure chunkIndex is an integer)
      insertKnowledgeChunk({
        sourceId,
        sessionId: source.session_id,
        chunkIndex: Math.floor(i),
        content,
        contentHash,
        embedding
      });
      
      processedChunks++;
    }
    
    metadata.uniqueChunks = processedChunks;
    
    // Update status to ready
    updateKnowledgeSourceStatus(sourceId, 'ready', null, metadata);
    
    console.log(`Successfully processed knowledge source ${sourceId}: ${processedChunks} unique chunks from ${chunks.length} total`);
    
    return { success: true, chunks: processedChunks };
  } catch (error) {
    console.error(`Error processing knowledge source ${sourceId}:`, error);
    updateKnowledgeSourceStatus(sourceId, 'error', error.message);
    throw error;
  }
}

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

// Knowledge management endpoints

// Upload knowledge source
app.post("/api/sessions/:id/knowledge", rateLimit, uploadSingleMiddleware, async (req, res) => {
  const sessionId = req.params.id;
  
  try {
    // Validate session exists
    const session = getSession(sessionId);
    if (!session) {
      // Clean up uploaded file if session doesn't exist
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Handle both file upload and text payload
    let filePath, fileName, fileType;
    
    if (req.file) {
      // File upload
      filePath = req.file.path;
      fileName = req.file.originalname;
      fileType = path.extname(req.file.originalname).slice(1).toLowerCase();
    } else if (req.body.content && req.body.filename) {
      // Text payload (for MVP)
      const ext = path.extname(req.body.filename).slice(1).toLowerCase();
      if (!['txt', 'md'].includes(ext)) {
        return res.status(400).json({ error: "Text payload only supports .txt and .md files" });
      }
      
      const id = crypto.randomUUID();
      filePath = path.join('./data/uploads/', `${id}.${ext}`);
      await fs.writeFile(filePath, req.body.content, 'utf-8');
      fileName = req.body.filename;
      fileType = ext;
    } else {
      return res.status(400).json({ error: "No file or content provided" });
    }
    
    // Create knowledge source record
    const source = createKnowledgeSource({
      sessionId,
      name: fileName,
      type: fileType,
      filePath
    });
    
    // Process asynchronously
    processKnowledgeSource(source.id).catch(err => {
      console.error(`Failed to process knowledge source ${source.id}:`, err);
    });
    
    res.json({
      sourceId: source.id,
      status: source.status,
      message: "Knowledge source uploaded and queued for processing"
    });
  } catch (error) {
    console.error("Error uploading knowledge source:", error);
    
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ error: "Failed to upload knowledge source" });
  }
});

// List knowledge sources for a session
app.get("/api/sessions/:id/knowledge", rateLimit, (req, res) => {
  const sessionId = req.params.id;
  
  try {
    // Validate session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const sources = getKnowledgeSources(sessionId);
    
    // Add chunk counts to each source
    const sourcesWithCounts = sources.map(source => {
      const chunkCount = source.status === 'ready' ? getKnowledgeChunkCount(source.id) : 0;
      return {
        ...source,
        chunkCount,
        metadata: source.metadata_json ? JSON.parse(source.metadata_json) : null
      };
    });
    
    res.json(sourcesWithCounts);
  } catch (error) {
    console.error("Error fetching knowledge sources:", error);
    res.status(500).json({ error: "Failed to fetch knowledge sources" });
  }
});

// Get knowledge source details
app.get("/api/sessions/:id/knowledge/:sourceId", rateLimit, (req, res) => {
  const { id: sessionId, sourceId } = req.params;
  
  try {
    // Validate session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const source = getKnowledgeSource(sourceId);
    if (!source || source.session_id !== sessionId) {
      return res.status(404).json({ error: "Knowledge source not found" });
    }
    
    const chunkCount = source.status === 'ready' ? getKnowledgeChunkCount(source.id) : 0;
    
    res.json({
      ...source,
      chunkCount,
      metadata: source.metadata_json ? JSON.parse(source.metadata_json) : null
    });
  } catch (error) {
    console.error("Error fetching knowledge source:", error);
    res.status(500).json({ error: "Failed to fetch knowledge source" });
  }
});

// Get knowledge source chunks
app.get("/api/sessions/:id/knowledge/:sourceId/chunks", rateLimit, (req, res) => {
  const { id: sessionId, sourceId } = req.params;
  
  try {
    // Validate session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const source = getKnowledgeSource(sourceId);
    if (!source || source.session_id !== sessionId) {
      return res.status(404).json({ error: "Knowledge source not found" });
    }
    
    if (source.status !== 'ready') {
      return res.json({ 
        chunks: [], 
        status: source.status,
        message: source.status === 'processing' ? 'Content is still being processed' : 'Content not available'
      });
    }
    
    const chunks = getKnowledgeChunks(source.id);
    res.json({ 
      chunks,
      sourceName: source.name,
      sourceType: source.type,
      totalChunks: chunks.length
    });
  } catch (error) {
    console.error("Error fetching knowledge chunks:", error);
    res.status(500).json({ error: "Failed to fetch chunks" });
  }
});

// Delete knowledge source
app.delete("/api/sessions/:id/knowledge/:sourceId", rateLimit, async (req, res) => {
  const { id: sessionId, sourceId } = req.params;
  
  try {
    // Validate session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Get source before deletion
    const source = getKnowledgeSource(sourceId);
    if (!source || source.session_id !== sessionId) {
      return res.status(404).json({ error: "Knowledge source not found" });
    }
    
    // Delete from database
    const result = deleteKnowledgeSource(sourceId);
    
    // Delete file from disk
    try {
      await fs.unlink(source.file_path);
    } catch (err) {
      console.error(`Failed to delete file ${source.file_path}:`, err);
      // Continue even if file deletion fails
    }
    
    console.log(`Deleted knowledge source ${sourceId}: ${result.chunksDeleted} chunks removed`);
    
    res.json({
      message: "Knowledge source deleted successfully",
      sourceId,
      sourceName: source.name,
      chunksDeleted: result.chunksDeleted
    });
  } catch (error) {
    console.error("Error deleting knowledge source:", error);
    res.status(500).json({ error: "Failed to delete knowledge source" });
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

// Search similar embeddings with mixed retrieval support
app.post("/api/search", rateLimit, async (req, res) => {
  try {
    let { 
      query, 
      limit = 5, 
      sessionId,
      include = 'both',  // 'transcripts' | 'knowledge' | 'both'
      k_transcripts = null,  // optional separate limits
      k_knowledge = null
    } = req.body;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    // Validate search parameters
    if (query.length > 1000) {
      return res.status(400).json({ error: "Search query too long (max 1000 characters)" });
    }
    
    // Cap limits to prevent DoS
    limit = Math.min(Math.max(1, limit), 100);
    k_transcripts = k_transcripts ? Math.min(Math.max(1, k_transcripts), 50) : limit;
    k_knowledge = k_knowledge ? Math.min(Math.max(1, k_knowledge), 50) : limit;
    
    // Generate embedding for search query
    const resp = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query
    });
    const queryEmbedding = resp.data[0].embedding;
    
    let results = [];
    
    // Search transcripts if requested
    if (include === 'transcripts' || include === 'both') {
      const transcriptResults = searchSimilar(queryEmbedding, k_transcripts, sessionId);
      results = results.concat(transcriptResults.map(r => ({
        ...r,
        source: 'transcript',
        attribution: null
      })));
    }
    
    // Search knowledge if requested
    if (include === 'knowledge' || include === 'both') {
      const knowledgeResults = searchSimilarKnowledge(queryEmbedding, k_knowledge, sessionId);
      results = results.concat(knowledgeResults.map(r => ({
        ...r,
        source: 'knowledge',
        attribution: {
          sourceName: r.source_name,
          sourceType: r.source_type,
          chunkIndex: r.chunk_index
        }
      })));
    }
    
    // Sort by distance (lower is better)
    results.sort((a, b) => a.distance - b.distance);
    
    // Limit total results if both sources included
    if (include === 'both' && !k_transcripts && !k_knowledge) {
      results = results.slice(0, limit);
    }
    
    res.json({ 
      results,
      query,
      include,
      totalResults: results.length
    });
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
  console.log(`║ ${getIcon('server')} Server:    http://localhost:${PORT}${' '.repeat(Math.max(0, 13 - PORT.toString().length))}║`);
  console.log(`║ ${getIcon('viewer')} Viewer:    http://localhost:${PORT}/viewer.html${' '.repeat(Math.max(0, 3 - PORT.toString().length))}║`);
  console.log(`║ ${getIcon('database')} Database:  ${process.env.SQLITE_DB_PATH ? 'OK Custom path' : 'OK Default path'}            ║`);
  console.log(`║ ${getIcon('robot')} AI Model:  ${EMBED_MODEL.substring(0, 20).padEnd(20)}         ║`);
  console.log(`║ ${getIcon('time')} Interval:  ${INTERVAL_MIN} minutes                         ║`);
  console.log("╚════════════════════════════════════════════════╝");
});

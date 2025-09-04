# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the Application
```bash
npm start          # Run the production server
npm run dev        # Run with auto-reload for development
```

### Testing
```bash
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Add your OpenAI API key (must have access to Realtime API and Embeddings API)
3. Configure optional settings for embedding model and intervals

## Architecture Overview

### Core Components

**Secretary (Real-time Transcription)**
- Lives in `public/index.html` (main UI and WebRTC client)
- Connects to OpenAI Realtime API via WebRTC for live audio transcription
- Handles microphone access, audio streaming, and transcript display
- Automatically pauses when Sidekick is active (PTT mode)

**Sidekick (AI Assistant)**
- Implemented in `public/sidekick.js`
- Two-panel interface with push-to-talk voice chat
- Integrates with Secretary's pause/resume functionality
- Loads context from current session transcripts

**Backend Server (`server.js`)**
- Express.js server providing API endpoints
- Generates ephemeral tokens for secure browser access to OpenAI APIs
- Handles transcript storage and embedding generation
- Manages sessions and provides search functionality

**Database Layer (`db.js`)**
- SQLite with sqlite-vec extension for vector embeddings
- Stores transcripts with semantic search capability
- Embedding model: text-embedding-3-large (3072 dimensions)
- Automatic embedding generation every 3 minutes or on manual flush

### Key API Endpoints
- `POST /api/session/token` - Get ephemeral token for WebRTC connection
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `POST /api/embeddings` - Store transcript embeddings
- `POST /api/search` - Semantic search in transcripts
- `POST /api/sidekick/token` - Get token for Sidekick connection

### WebRTC Integration
- Both Secretary and Sidekick use WebRTC for real-time audio
- Audio track switching via `replaceTrack()` during PTT sessions
- Data channels for bidirectional communication
- Proper cleanup on disconnect to prevent memory leaks

## UI Design Principles

Always follow the Scandinavian Minimalism design guide in `docs/DESIGN.md`:
- Use the defined color tokens and spacing system
- Maintain clean typography hierarchy with Inter font
- Apply subtle shadows and rounded borders as specified
- Ensure generous whitespace and breathing room
- Keep interactions minimal and functional

## Important Notes

- Never expose OpenAI API keys in client-side code
- Use ephemeral tokens for all browser-to-OpenAI connections
- Transcripts are automatically embedded for semantic search
- Secretary and Sidekick coordinate to prevent audio conflicts
- The application requires Node.js 18+ and a modern browser with WebRTC support
# Live Audio Transcription with OpenAI Realtime API

A simple web application that uses OpenAI's Realtime API to transcribe live audio from your microphone in real-time. No audio synthesis or chat functionality - just pure transcription.

## Features

- 🎙️ Real-time audio capture from browser microphone
- 📝 Live transcription using OpenAI's Realtime API
- 🔒 Secure ephemeral token authentication
- 🎨 Clean, responsive UI with visual feedback
- ⚡ Low-latency WebRTC connection

## Prerequisites

- Node.js 18+ installed
- OpenAI API key with access to the Realtime API

## Setup

1. **Clone or download this project**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your OpenAI API key:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## How to Use

1. Click "Start Transcription" button
2. Allow microphone access when prompted
3. Start speaking - your words will appear as text in real-time
4. Click "Stop" when finished

## Architecture

- **Backend (server.js):** Express server that generates ephemeral tokens for secure browser access
- **Frontend (public/index.html):** WebRTC client that streams audio and receives transcriptions
- **Security:** API keys never exposed to browser; uses short-lived tokens instead

## Configuration

The app uses OpenAI's Realtime API with:
- **Model:** gpt-4o-realtime-preview
- **Mode:** Input transcription only (no TTS or agent responses)
- **Audio:** Direct microphone streaming via WebRTC

## Troubleshooting

- **"Failed to get session token":** Check your API key in `.env`
- **No transcription appearing:** Ensure microphone permissions are granted
- **Connection errors:** Verify you have access to the Realtime API on your OpenAI account

## Notes

- The Realtime API requires a paid OpenAI account with API access
- WebRTC connection provides lowest latency for live transcription
- Transcriptions appear after complete utterances (not word-by-word)
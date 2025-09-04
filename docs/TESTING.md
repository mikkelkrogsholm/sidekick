# Testing Guide - Secretary-Sidekick Integration

This document provides comprehensive testing procedures for the Secretary-Sidekick realtime web application, covering both manual test procedures and automated testing.

## Overview

The Secretary-Sidekick application is a realtime voice transcription and AI assistant system that integrates:
- **Secretary**: WebRTC-based live audio transcription using OpenAI's Realtime API
- **Sidekick**: AI assistant with push-to-talk functionality and auto-pause coordination
- **Backend**: Express.js server with SQLite vector database for transcript storage and retrieval

## Prerequisites

Before testing, ensure:
1. Server is running on `http://localhost:3000`
2. Valid OpenAI API key is configured
3. Modern browser with WebRTC support (Chrome 88+, Firefox 94+, Safari 15+)
4. Microphone permissions granted
5. Test environment has stable internet connection

## Manual Test Procedures

### Test Scenario 1: Secretary Pause/Resume Integration

**Objective**: Verify Secretary automatically pauses during Sidekick PTT sessions and resumes afterward.

**Steps**:
1. **Setup**
   - Navigate to `http://localhost:3000`
   - Create a new session: "Integration Test Session"
   - Start Secretary transcription (click "Start")
   - Verify status shows "Connected - Speak into your microphone"

2. **Connect Sidekick**
   - Click "Connect" in Sidekick panel
   - Wait for connection status to show "Connected"
   - Verify audio element is present and functional

3. **Test Auto-Pause on PTT**
   - Hold down "Hold to talk" button in Sidekick
   - Verify Secretary status changes to "Paused (Sidekick active)"
   - Speak into microphone while holding PTT
   - Verify Sidekick shows "[Listening...]" in output

4. **Test Auto-Resume**
   - Release PTT button
   - Verify Secretary status returns to "Connected - Speak into your microphone"
   - Speak into microphone
   - Verify Secretary transcript receives new text

**Expected Results**:
- Secretary pauses automatically when PTT is pressed
- Secretary resumes when PTT is released
- No transcript overlap between Secretary and Sidekick modes
- Status indicators update correctly throughout the process

### Test Scenario 2: WebRTC Audio Flow with replaceTrack

**Objective**: Verify audio track switching works correctly during PTT sessions.

**Steps**:
1. **Initial Connection**
   - Connect Sidekick (follow steps from Scenario 1)
   - Open browser developer tools, go to Console tab
   - Look for "ICE connection state" and "Received remote track" messages

2. **Test Track Replacement**
   - Press and hold PTT button
   - Check console for "Sent event: conversation.item.create" (if any)
   - Verify no WebRTC errors in console
   - Speak clearly for 3-5 seconds

3. **Test Track Restoration**
   - Release PTT button
   - Check console for successful track replacement
   - Verify no "track.stop()" errors
   - Test multiple PTT press/release cycles

4. **Test Audio Output**
   - Send text message to Sidekick: "Please say hello"
   - Verify audio plays from Sidekick
   - Check browser's audio indicator shows playback

**Expected Results**:
- No WebRTC connection errors during track switching
- Clean audio input during PTT sessions
- Proper audio output from Sidekick responses
- No audio artifacts or connection drops

### Test Scenario 3: Transcript Ingestion Verification

**Objective**: Verify transcripts are properly ingested and stored in the database.

**Steps**:
1. **Generate Test Content**
   - Start Secretary transcription
   - Speak clearly: "This is a test transcript for ingestion verification"
   - Wait 2-3 seconds for transcription to appear
   - Stop Secretary transcription

2. **Verify Backend Processing**
   - Check server console for "Flushed X chars for embedding" message
   - Navigate to `http://localhost:3000/api/embeddings?sessionId=[your-session-id]`
   - Verify transcript content appears in response

3. **Test Sidekick Ingestion**
   - Connect Sidekick
   - Send text message: "What did we just discuss?"
   - Verify Sidekick references the previous transcript content
   - Check server console for "Ingest failed" errors (should be none)

4. **Test Manual Flush**
   - Generate more transcript content
   - Navigate to browser Network tab in dev tools
   - Stop transcription and watch for `/flush` API call
   - Verify 200 response with `"flushed": true`

**Expected Results**:
- Transcripts appear in database within 15 seconds of silence
- Manual flush works immediately when stopping transcription
- Sidekick can access and reference previous transcript content
- No ingestion errors in server logs

### Test Scenario 4: End-to-End Conversation Flow

**Objective**: Test complete conversation flow between user, Secretary, and Sidekick.

**Steps**:
1. **Setup Complete Session**
   - Create session: "E2E Test Session"
   - Start Secretary transcription
   - Connect Sidekick
   - Verify both systems show "Connected" status

2. **Generate Context with Secretary**
   - Speak: "Today we need to discuss the quarterly budget review. The marketing department is requesting a 15% increase for digital advertising campaigns."
   - Wait for transcription to complete
   - Stop and start transcription to trigger embedding

3. **Test Sidekick Context Awareness**
   - Connect Sidekick (should load recent context)
   - Look for "[Context loaded from current session]" message
   - Use PTT to ask: "What percentage increase is marketing requesting?"
   - Verify Sidekick references the 15% figure from Secretary transcript

4. **Test Conversation Ingestion**
   - Continue PTT conversation with Sidekick about the budget
   - Check Sidekick output panel for "You: [your speech]" and "Sidekick: [response]"
   - Verify conversation appears in database embeddings

5. **Test Settings Integration**
   - Open Settings drawer
   - Toggle "Auto-pause Secretary while Sidekick talks" off
   - Test PTT - Secretary should continue running
   - Toggle back on - Secretary should pause during PTT

**Expected Results**:
- Sidekick loads context from recent Secretary transcripts
- Complete conversation flow works without errors
- Settings changes take effect immediately
- All interactions are properly stored and retrievable

## WebRTC Verification Steps

### Connection Health Checks

1. **ICE Connection State Monitoring**
   ```javascript
   // Run in browser console
   console.log("Sidekick PC state:", window.Sidekick?.pc?.iceConnectionState);
   console.log("Secretary PC state:", window.pc?.iceConnectionState);
   ```

2. **Track Status Verification**
   ```javascript
   // Check audio tracks during PTT
   console.log("Active tracks:", window.pc?.getSenders().map(s => ({
     track: s.track?.kind,
     enabled: s.track?.enabled
   })));
   ```

3. **Data Channel Health**
   ```javascript
   // Verify data channels are open
   console.log("Secretary DC:", window.dc?.readyState);
   console.log("Sidekick DC:", window.Sidekick?.dc?.readyState);
   ```

### Audio Flow Testing

1. **Microphone Access Test**
   - Navigate to `chrome://settings/content/microphone`
   - Verify site has microphone permission
   - Test with different audio input devices

2. **Audio Level Monitoring**
   - Use browser's built-in audio indicator
   - Verify audio levels show during PTT
   - Test with various microphone distances

## Transcript Verification Steps

### Database Integrity Checks

1. **Session Validation**
   ```bash
   curl http://localhost:3000/api/sessions
   # Verify all test sessions are present
   ```

2. **Embedding Count Verification**
   ```bash
   curl http://localhost:3000/api/embeddings?limit=10
   # Check recent embeddings match test content
   ```

3. **Search Functionality Test**
   ```bash
   curl -X POST http://localhost:3000/api/search \
     -H "Content-Type: application/json" \
     -d '{"query": "quarterly budget", "limit": 5}'
   ```

### Content Accuracy Verification

1. **Transcription Quality Check**
   - Speak known phrases with proper pronunciation
   - Verify transcription accuracy > 90% for clear speech
   - Test with different languages if configured

2. **Embedding Similarity Test**
   - Generate related content across multiple sessions
   - Use search API to verify similar content is found
   - Check relevance scores in search results

## Troubleshooting Common Issues

### WebRTC Connection Issues

**Problem**: Connection fails or drops frequently
**Solutions**:
- Check network stability and firewall settings
- Verify STUN server accessibility
- Test with different browsers
- Check browser console for ICE candidate errors

### Audio Problems

**Problem**: No audio input/output during PTT
**Solutions**:
- Verify microphone permissions in browser settings
- Check audio device selection in OS settings
- Test with different audio hardware
- Monitor browser audio indicators

### Transcription Issues

**Problem**: Poor transcription quality or missing text
**Solutions**:
- Verify OpenAI API key and quota
- Check microphone audio levels
- Test with different language settings
- Monitor server logs for API errors

### Database Integration Issues

**Problem**: Transcripts not saving or searchable
**Solutions**:
- Check SQLite database file permissions
- Verify embedding model availability
- Monitor server console for database errors
- Test manual flush functionality

## Performance Benchmarks

### Expected Response Times
- Secretary connection: < 3 seconds
- Sidekick connection: < 5 seconds
- Transcript ingestion: < 500ms per chunk
- Search queries: < 2 seconds
- Manual flush: < 3 seconds

### Resource Usage Limits
- Browser memory: < 100MB after 1 hour use
- Server memory: < 500MB with 10 active sessions
- Database size: ~1MB per hour of transcription
- WebRTC bandwidth: ~64kbps per connection

## Test Environment Recommendations

### Browser Compatibility
- **Chrome 88+**: Full support (recommended)
- **Firefox 94+**: Full support
- **Safari 15+**: Full support (macOS only)
- **Edge 88+**: Full support

### Hardware Requirements
- **CPU**: 2+ cores recommended for real-time processing
- **RAM**: 4GB minimum, 8GB recommended
- **Network**: Stable broadband connection (10+ Mbps)
- **Audio**: Quality microphone for accurate transcription

### Development Environment
- **Node.js**: 18.0.0 or higher
- **SQLite**: 3.35.0 or higher with vector extensions
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 20.04+

## Automated Testing Integration

For continuous integration, see `tests/integration.test.js` which provides:
- Automated mocking of WebRTC APIs
- Mock server endpoints for testing
- Programmatic test execution
- Coverage reporting for critical paths

Run automated tests with:
```bash
npm test
```

## Security Considerations

### API Key Protection
- Verify OpenAI API keys are not exposed in client-side code
- Check that ephemeral tokens expire correctly
- Monitor for unauthorized API usage

### Audio Privacy
- Verify audio data is not stored unnecessarily
- Check that WebRTC connections use proper encryption
- Test session isolation between different users

### Data Handling
- Verify transcript data is properly sanitized
- Check database access controls
- Test session data cleanup procedures
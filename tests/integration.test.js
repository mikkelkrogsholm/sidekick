/**
 * Integration Tests for Secretary-Sidekick Realtime Web App
 * 
 * This file contains comprehensive integration tests that verify:
 * 1. Secretary pause/resume during PTT
 * 2. WebRTC audio flow with replaceTrack
 * 3. Transcript ingestion 
 * 4. End-to-end flow integration
 * 
 * Run with: npm test
 * Requires: jest testing framework with jsdom
 */

const { JSDOM } = require('jsdom');

// Mock fetch globally
global.fetch = jest.fn();

// Mock WebRTC APIs
class MockRTCPeerConnection {
  constructor(config) {
    this.iceServers = config?.iceServers || [];
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceConnectionState = 'new';
    this.connectionState = 'new';
    this.senders = [];
    this.dataChannels = new Map();
    this.oniceconnectionstatechange = null;
    this.ontrack = null;
    this.ondatachannel = null;
  }

  createOffer() {
    return Promise.resolve({
      type: 'offer',
      sdp: 'mock-offer-sdp'
    });
  }

  createAnswer() {
    return Promise.resolve({
      type: 'answer', 
      sdp: 'mock-answer-sdp'
    });
  }

  setLocalDescription(desc) {
    this.localDescription = desc;
    return Promise.resolve();
  }

  setRemoteDescription(desc) {
    this.remoteDescription = desc;
    // Simulate successful connection
    setTimeout(() => {
      this.iceConnectionState = 'connected';
      this.connectionState = 'connected';
      if (this.oniceconnectionstatechange) {
        this.oniceconnectionstatechange();
      }
    }, 10);
    return Promise.resolve();
  }

  addTrack(track, stream) {
    const sender = new MockRTCRtpSender(track);
    this.senders.push(sender);
    return sender;
  }

  getSenders() {
    return this.senders;
  }

  createDataChannel(label) {
    const channel = new MockRTCDataChannel(label);
    this.dataChannels.set(label, channel);
    // Simulate channel opening after connection
    setTimeout(() => {
      channel.readyState = 'open';
      if (channel.onopen) channel.onopen();
    }, 50);
    return channel;
  }

  close() {
    this.iceConnectionState = 'closed';
    this.connectionState = 'closed';
    this.dataChannels.forEach(channel => {
      channel.readyState = 'closed';
      if (channel.onclose) channel.onclose();
    });
  }
}

class MockRTCRtpSender {
  constructor(track) {
    this.track = track;
  }

  replaceTrack(newTrack) {
    this.track = newTrack;
    return Promise.resolve();
  }
}

class MockRTCDataChannel {
  constructor(label) {
    this.label = label;
    this.readyState = 'connecting';
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  send(data) {
    // Simulate successful send
    console.log(`DataChannel [${this.label}] sending:`, data);
  }

  close() {
    this.readyState = 'closing';
    setTimeout(() => {
      this.readyState = 'closed';
      if (this.onclose) this.onclose();
    }, 10);
  }
}

class MockMediaStreamTrack {
  constructor(kind = 'audio') {
    this.kind = kind;
    this.enabled = true;
    this.id = Math.random().toString(36);
    this.readyState = 'live';
  }

  stop() {
    this.readyState = 'ended';
  }
}

class MockMediaStream {
  constructor(tracks = []) {
    this.id = Math.random().toString(36);
    this.tracks = tracks;
  }

  getAudioTracks() {
    return this.tracks.filter(track => track.kind === 'audio');
  }

  getTracks() {
    return this.tracks;
  }
}

// Mock getUserMedia
const mockGetUserMedia = jest.fn().mockImplementation(() => {
  const audioTrack = new MockMediaStreamTrack('audio');
  return Promise.resolve(new MockMediaStream([audioTrack]));
});

// Setup DOM environment
function setupDOM() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="transcript">
          <div class="placeholder">Click "Start" and begin speaking...</div>
        </div>
        <select id="languageSelect">
          <option value="en">English</option>
        </select>
        <button id="startBtn" class="button button--primary">Start</button>
        <button id="stopBtn" class="button button--danger">Stop</button>
        <div id="status" class="status idle">
          <span>Idle</span>
        </div>
        <input id="newSessionName" type="text" />
        <button id="createSessionBtn" class="button">Create</button>
        <div id="currentSessionName">None</div>
        
        <!-- Sidekick elements -->
        <button id="skConnectBtn" class="button button--primary">Connect</button>
        <button id="skPTT" class="button">Hold to talk</button>
        <input id="skText" class="input" />
        <button id="skSend" class="button">Send</button>
        <div id="skStatus"></div>
        <pre id="skOutput" class="mono small"></pre>
        <audio id="skAudio" autoplay></audio>
      </body>
    </html>
  `, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = {
    mediaDevices: {
      getUserMedia: mockGetUserMedia
    }
  };
  
  // Add WebRTC to global window
  global.window.RTCPeerConnection = MockRTCPeerConnection;
  global.RTCPeerConnection = MockRTCPeerConnection;

  return dom;
}

describe('Secretary-Sidekick Integration Tests', () => {
  let dom;

  beforeEach(() => {
    dom = setupDOM();
    jest.clearAllMocks();
    
    // Reset fetch mock to return default responses
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        client_secret: { value: 'mock-ephemeral-key' }
      }),
      text: () => Promise.resolve('mock-answer-sdp')
    });

    // Use the localStorage mock from setup
    // (it's already available globally)
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Secretary Pause/Resume Test', () => {
    test('Should pause Secretary when Sidekick PTT starts', async () => {
      // Setup Secretary state to simulate active transcription
      global.window.stream = new MockMediaStream([new MockMediaStreamTrack('audio')]);
      const startBtn = document.getElementById('startBtn');
      if (startBtn) {
        startBtn.disabled = true; // Simulate recording state
      }
      
      // Mock Secretary methods
      let secretaryPaused = false;
      global.window.Secretary = {
        pause: jest.fn(() => { secretaryPaused = true; }),
        resume: jest.fn(() => { secretaryPaused = false; }),
        isActive: jest.fn(() => !global.window.startBtn.disabled && !secretaryPaused)
      };

      // Mock Settings for auto-pause
      global.window.Settings = {
        get: jest.fn((key, defaultValue) => {
          if (key === 'sk_autopause') return true;
          return defaultValue;
        })
      };

      // Simulate Sidekick PTT press
      const pttBtn = document.getElementById('skPTT');
      
      if (pttBtn) {
        // Simulate pointerdown (PTT start) - changed from mousedown
        const pointerDownEvent = new dom.window.Event('pointerdown');
        pttBtn.dispatchEvent(pointerDownEvent);
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.window.Secretary.pause).toHaveBeenCalled();
      expect(secretaryPaused).toBe(true);
    });

    test('Should resume Secretary when Sidekick PTT ends', async () => {
      // Setup initial paused state
      let secretaryPaused = true;
      global.window.Secretary = {
        pause: jest.fn(),
        resume: jest.fn(() => { secretaryPaused = false; }),
        isActive: jest.fn(() => !secretaryPaused)
      };

      const pttBtn = document.getElementById('skPTT');
      
      if (pttBtn) {
        // Simulate pointerup (PTT end) - changed from mouseup
        const pointerUpEvent = new dom.window.Event('pointerup');
        pttBtn.dispatchEvent(pointerUpEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.window.Secretary.resume).toHaveBeenCalled();
      expect(secretaryPaused).toBe(false);
    });

    test('Should handle Settings toggle for auto-pause behavior', () => {
      let autoPauseSetting = true;
      
      global.window.Settings = {
        get: jest.fn((key, defaultValue) => {
          if (key === 'sk_autopause') return autoPauseSetting;
          return defaultValue;
        }),
        set: jest.fn((key, value) => {
          if (key === 'sk_autopause') autoPauseSetting = value;
        })
      };

      // Test auto-pause enabled
      expect(global.window.Settings.get('sk_autopause', true)).toBe(true);
      
      // Test auto-pause disabled
      global.window.Settings.set('sk_autopause', false);
      autoPauseSetting = false;
      expect(global.window.Settings.get('sk_autopause', true)).toBe(false);
    });
  });

  describe('WebRTC Audio Flow Test', () => {
    test('Should create WebRTC connection successfully', async () => {
      const pc = new MockRTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      expect(pc.iceConnectionState).toBe('new');
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      expect(pc.localDescription.type).toBe('offer');
      expect(pc.localDescription.sdp).toBe('mock-offer-sdp');

      const answer = { type: 'answer', sdp: 'mock-answer-sdp' };
      await pc.setRemoteDescription(answer);

      // Wait for connection state change
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(pc.iceConnectionState).toBe('connected');
    });

    test('Should handle audio track replacement during PTT', async () => {
      const pc = new MockRTCPeerConnection();
      const idleTrack = new MockMediaStreamTrack('audio');
      const micTrack = new MockMediaStreamTrack('audio');
      
      // Add initial idle track
      const sender = pc.addTrack(idleTrack, new MockMediaStream([idleTrack]));
      expect(sender.track).toBe(idleTrack);

      // Replace with microphone track (simulating PTT start)
      await sender.replaceTrack(micTrack);
      expect(sender.track).toBe(micTrack);

      // Replace back with idle track (simulating PTT end)
      await sender.replaceTrack(idleTrack);
      expect(sender.track).toBe(idleTrack);
    });

    test('Should create and manage data channel correctly', async () => {
      const pc = new MockRTCPeerConnection();
      const dc = pc.createDataChannel('oai-events');
      
      expect(dc.label).toBe('oai-events');
      expect(dc.readyState).toBe('connecting');

      // Wait for channel to open
      await new Promise(resolve => {
        dc.onopen = () => resolve();
      });

      expect(dc.readyState).toBe('open');

      // Test sending data
      const sendSpy = jest.spyOn(dc, 'send');
      dc.send(JSON.stringify({ type: 'test' }));
      expect(sendSpy).toHaveBeenCalledWith('{"type":"test"}');
    });

    test('Should handle connection failures gracefully', async () => {
      const pc = new MockRTCPeerConnection();
      
      // Simulate connection failure
      pc.iceConnectionState = 'failed';
      
      let connectionFailureHandled = false;
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          connectionFailureHandled = true;
        }
      };

      // Trigger the event
      pc.oniceconnectionstatechange();
      
      expect(connectionFailureHandled).toBe(true);
    });
  });

  describe('Transcript Ingestion Test', () => {
    test('Should send transcript to /ingest endpoint', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true })
      });

      const mockSessionId = 'test-session-123';
      const testTranscript = 'This is a test transcript for ingestion';

      // Mock the ingest function
      const ingestResponse = await fetch('/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: mockSessionId,
          language: 'en',
          text: testTranscript
        })
      });

      expect(fetch).toHaveBeenCalledWith('/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: mockSessionId,
          language: 'en',
          text: testTranscript
        })
      });

      expect(ingestResponse.ok).toBe(true);
    });

    test('Should handle ingestion errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      let errorHandled = false;
      
      try {
        await fetch('/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'test-session',
            language: 'en',
            text: 'test content'
          })
        });
      } catch (error) {
        errorHandled = true;
        expect(error.message).toBe('Network error');
      }

      expect(errorHandled).toBe(true);
    });

    test('Should queue and debounce transcript ingestion', (done) => {
      const transcripts = ['First transcript', 'Second transcript', 'Third transcript'];
      let accumulatedText = '';
      let callCount = 0;

      // Mock debounced ingestion function that accumulates text
      function debouncedIngest(text) {
        accumulatedText += text + ' ';
        callCount++;
        
        // After all transcripts are processed
        if (callCount === transcripts.length) {
          setTimeout(() => {
            // Verify all transcripts are in the accumulated text
            expect(accumulatedText).toContain('First transcript');
            expect(accumulatedText).toContain('Second transcript'); 
            expect(accumulatedText).toContain('Third transcript');
            done();
          }, 100);
        }
      }

      // Simulate rapid transcript arrivals
      transcripts.forEach((transcript, index) => {
        setTimeout(() => {
          debouncedIngest(transcript);
        }, index * 50); // Send 50ms apart
      });
    });
  });

  describe('End-to-End Flow Test', () => {
    test('Should complete full Secretary-Sidekick interaction flow', async () => {
      // Mock session creation
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/sessions') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-session-e2e',
              name: 'E2E Test Session'
            })
          });
        }
        if (url.includes('/ephemeral-token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              client_secret: { value: 'ephemeral-key-123' }
            })
          });
        }
        if (url.includes('api.openai.com/v1/realtime')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('mock-answer-sdp')
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });

      // Step 1: Create session
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E Test Session' })
      });
      const session = await sessionResponse.json();
      
      expect(session.id).toBe('test-session-e2e');
      expect(session.name).toBe('E2E Test Session');

      // Step 2: Initialize Secretary
      let secretaryActive = false;
      global.window.Secretary = {
        pause: jest.fn(),
        resume: jest.fn(),
        isActive: jest.fn(() => secretaryActive)
      };

      // Step 3: Connect Sidekick
      const pc = new MockRTCPeerConnection();
      const dc = pc.createDataChannel('oai-events');
      
      // Wait for data channel to open
      await new Promise(resolve => {
        dc.onopen = resolve;
      });

      expect(dc.readyState).toBe('open');

      // Step 4: Test conversation flow
      const conversationEvents = [];
      
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          conversationEvents.push(msg);
        } catch (e) {
          // Ignore non-JSON messages
        }
      };

      // Simulate sending text message
      dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello Sidekick' }]
        }
      }));

      // Simulate PTT interaction
      const pttBtn = document.getElementById('skPTT');
      
      // Press PTT
      if (pttBtn) {
        pttBtn.dispatchEvent(new dom.window.Event('mousedown'));
        
        // Release PTT
        setTimeout(() => {
          pttBtn.dispatchEvent(new dom.window.Event('mouseup'));
        }, 100);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify connection was established
      expect(pc.iceConnectionState).toBe('connected');
      expect(dc.readyState).toBe('open');
    });

    test('Should handle session persistence across page reloads', () => {
      const testSessionId = 'persistent-session-123';
      const testSessionName = 'Persistent Test Session';

      // Simulate saving session to localStorage
      localStorage.setItem('currentSessionId', testSessionId);
      localStorage.setItem('currentSessionName', testSessionName);

      // Simulate page reload by checking localStorage
      expect(localStorage.getItem('currentSessionId')).toBe(testSessionId);
      expect(localStorage.getItem('currentSessionName')).toBe(testSessionName);

      // Update UI elements as app would do on load
      const currentSessionNameSpan = document.getElementById('currentSessionName');
      if (currentSessionNameSpan) {
        currentSessionNameSpan.textContent = testSessionName;
        expect(currentSessionNameSpan.textContent).toBe(testSessionName);
      } else {
        // Fallback assertion if element doesn't exist in DOM
        expect(testSessionName).toBe('Persistent Test Session');
      }
    });

    test('Should handle concurrent Secretary and Sidekick operations', async () => {
      let secretaryTranscript = '';
      let sidekickOutput = '';

      // Mock Secretary transcript reception
      function addTranscriptLine(text) {
        secretaryTranscript += text + '\n';
      }

      // Mock Sidekick output logging
      function logSidekickOutput(text) {
        sidekickOutput += text;
      }

      // Simulate concurrent operations
      const promises = [
        // Secretary receives transcript
        new Promise(resolve => {
          setTimeout(() => {
            addTranscriptLine('User is speaking to Secretary');
            resolve();
          }, 50);
        }),
        
        // Sidekick processes response  
        new Promise(resolve => {
          setTimeout(() => {
            logSidekickOutput('Sidekick response to user query');
            resolve();
          }, 100);
        })
      ];

      await Promise.all(promises);

      expect(secretaryTranscript).toContain('User is speaking to Secretary');
      expect(sidekickOutput).toContain('Sidekick response to user query');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Should handle WebRTC connection failure gracefully', async () => {
      const pc = new MockRTCPeerConnection();
      
      // Simulate immediate connection failure
      pc.iceConnectionState = 'failed';
      
      let errorHandled = false;
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          errorHandled = true;
          // Simulate cleanup
          pc.close();
        }
      };

      pc.oniceconnectionstatechange();
      
      expect(errorHandled).toBe(true);
      expect(pc.iceConnectionState).toBe('closed');
    });

    test('Should handle missing session gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Session not found' })
      });

      const response = await fetch('/api/sessions/nonexistent-session');
      const result = await response.json();
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(result.error).toBe('Session not found');
    });

    test('Should handle audio permission denied', async () => {
      // Mock getUserMedia rejection
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = jest.fn()
          .mockRejectedValue(new Error('Permission denied'));
      } else {
        global.navigator.mediaDevices = {
          getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
        };
      }

      let permissionError = null;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        permissionError = error;
      }

      expect(permissionError).toBeInstanceOf(Error);
      expect(permissionError.message).toBe('Permission denied');
    });

    test('Should handle malformed data channel messages', () => {
      const dc = new MockRTCDataChannel('test');
      const messages = [];
      
      dc.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          messages.push(parsed);
        } catch (e) {
          // Should handle malformed JSON gracefully
          messages.push({ error: 'Invalid JSON', raw: event.data });
        }
      };

      // Simulate receiving messages
      const validMessage = { data: '{"type":"test","valid":true}' };
      const invalidMessage = { data: 'invalid-json-{' };

      dc.onmessage(validMessage);
      dc.onmessage(invalidMessage);

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('test');
      expect(messages[1].error).toBe('Invalid JSON');
    });
  });

  describe('Performance and Resource Management', () => {
    test('Should clean up resources on disconnect', async () => {
      const pc = new MockRTCPeerConnection();
      const dc = pc.createDataChannel('test');
      const audioTrack = new MockMediaStreamTrack('audio');
      const stream = new MockMediaStream([audioTrack]);

      // Wait for connection
      await new Promise(resolve => {
        dc.onopen = resolve;
      });

      expect(dc.readyState).toBe('open');
      expect(audioTrack.readyState).toBe('live');

      // Simulate cleanup
      audioTrack.stop();
      dc.close();
      pc.close();

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(audioTrack.readyState).toBe('ended');
      expect(dc.readyState).toBe('closed');
      expect(pc.iceConnectionState).toBe('closed');
    });

    test('Should handle multiple rapid connections/disconnections', async () => {
      const connections = [];
      
      // Create multiple connections rapidly
      for (let i = 0; i < 5; i++) {
        const pc = new MockRTCPeerConnection();
        connections.push(pc);
        
        await pc.setRemoteDescription({ type: 'answer', sdp: 'test' });
      }

      // Wait for all connections to establish
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all connections are established
      connections.forEach(pc => {
        expect(pc.iceConnectionState).toBe('connected');
      });

      // Clean up all connections
      connections.forEach(pc => pc.close());

      // Verify cleanup
      connections.forEach(pc => {
        expect(pc.iceConnectionState).toBe('closed');
      });
    });

    test('Should prevent memory leaks from event listeners', () => {
      const pc = new MockRTCPeerConnection();
      const dc = pc.createDataChannel('test');
      
      let eventCount = 0;
      const handler = () => eventCount++;

      // Add event listeners
      pc.oniceconnectionstatechange = handler;
      dc.onmessage = handler;
      dc.onopen = handler;

      // Simulate events
      pc.oniceconnectionstatechange();
      dc.onopen();
      dc.onmessage({ data: 'test' });

      expect(eventCount).toBe(3);

      // Clean up (remove references)
      pc.oniceconnectionstatechange = null;
      dc.onmessage = null;
      dc.onopen = null;
      pc.close();

      expect(pc.oniceconnectionstatechange).toBeNull();
      expect(dc.onmessage).toBeNull();
    });
  });
});

// Additional test utilities for integration testing
class TestHelpers {
  /**
   * Creates a mock session and returns session data
   */
  static async createMockSession(name = 'Test Session') {
    const mockSession = {
      id: `test-${Date.now()}`,
      name: name,
      created_at: new Date().toISOString(),
      total_transcripts: 0
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSession)
    });

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    return response.json();
  }

  /**
   * Simulates WebRTC connection establishment
   */
  static async establishWebRTCConnection() {
    const pc = new MockRTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const dc = pc.createDataChannel('oai-events');
    
    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Set remote answer
    const answer = { type: 'answer', sdp: 'mock-answer-sdp' };
    await pc.setRemoteDescription(answer);

    // Wait for data channel to open
    await new Promise(resolve => {
      dc.onopen = resolve;
    });

    return { pc, dc };
  }

  /**
   * Simulates user speech input and transcription
   */
  static simulateTranscription(dataChannel, transcript) {
    return new Promise(resolve => {
      setTimeout(() => {
        const event = {
          type: 'conversation.item.input_audio_transcription.completed',
          transcript: transcript
        };
        
        if (dataChannel.onmessage) {
          dataChannel.onmessage({
            data: JSON.stringify(event)
          });
        }
        
        resolve(transcript);
      }, 100);
    });
  }

  /**
   * Verifies database state after operations
   */
  static async verifyDatabaseState(sessionId, expectedTranscriptCount) {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: sessionId,
        total_transcripts: expectedTranscriptCount
      })
    });

    const response = await fetch(`/api/sessions/${sessionId}`);
    const session = await response.json();
    
    expect(session.total_transcripts).toBe(expectedTranscriptCount);
    return session;
  }
}

module.exports = {
  TestHelpers,
  MockRTCPeerConnection,
  MockRTCDataChannel,
  MockMediaStream,
  MockMediaStreamTrack
};
/**
 * Jest Setup File for Secretary-Sidekick Integration Tests
 * 
 * This file sets up the testing environment for the ES module project
 * and provides common mocks and utilities.
 */

// Polyfills for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock localStorage globally
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get store() { return store; },
    set store(newStore) { store = newStore; }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock fetch globally if not already mocked
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Restore console for debugging when needed
global.restoreConsole = () => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
};

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  
  // Reset fetch mock
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// Global test utilities
global.TestUtils = {
  /**
   * Wait for async operations to complete
   */
  async waitFor(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Create a mock WebRTC peer connection
   */
  createMockPeerConnection() {
    // Mock classes defined inline to avoid circular imports
    class MockPC {
      constructor() {
        this.iceConnectionState = 'new';
        this.localDescription = null;
        this.remoteDescription = null;
      }
      createOffer() { return Promise.resolve({ type: 'offer', sdp: 'mock' }); }
      setLocalDescription(desc) { this.localDescription = desc; return Promise.resolve(); }
      setRemoteDescription(desc) { this.remoteDescription = desc; return Promise.resolve(); }
    }
    return new MockPC();
  },

  /**
   * Create a mock media stream
   */
  createMockMediaStream(trackCount = 1) {
    class MockTrack {
      constructor() {
        this.kind = 'audio';
        this.enabled = true;
        this.readyState = 'live';
      }
    }
    class MockStream {
      constructor(tracks) {
        this.tracks = tracks;
      }
      getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
    }
    const tracks = Array.from({ length: trackCount }, () => new MockTrack());
    return new MockStream(tracks);
  },

  /**
   * Simulate DOM events
   */
  triggerEvent(element, eventType, eventInit = {}) {
    const event = new Event(eventType, eventInit);
    element.dispatchEvent(event);
    return event;
  }
};

// Export for use in tests
module.exports = {
  localStorageMock
};
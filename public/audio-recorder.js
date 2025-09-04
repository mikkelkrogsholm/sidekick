// Audio Recording Module
// Handles recording of user speech and AI responses

class AudioRecorder {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.currentStream = null;
    this.recordingType = null; // 'user' or 'ai'
    this.startTime = null;
    this.sessionId = null;
  }

  // Start recording user speech from a cloned stream
  async startUserRecording(originalStream, sessionId) {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      this.sessionId = sessionId;
      this.recordingType = 'user';
      this.recordedChunks = [];
      this.startTime = new Date().toISOString();

      // Clone the stream to avoid interfering with WebRTC
      this.currentStream = originalStream.clone();
      
      // Create MediaRecorder with appropriate options
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/wav';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.currentStream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveRecording();
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      console.log('Started user audio recording');
      
    } catch (error) {
      console.error('Error starting user recording:', error);
      this.cleanup();
    }
  }

  // Start recording AI responses from audio element
  startAIRecording(audioElement, sessionId) {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      this.sessionId = sessionId;
      this.recordingType = 'ai';
      this.recordedChunks = [];
      this.startTime = new Date().toISOString();

      // Create audio context and source from audio element
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Check if audio element already has a source node
      if (!audioElement.sourceNode) {
        audioElement.sourceNode = audioContext.createMediaElementSource(audioElement);
        // Connect to default output so audio still plays
        audioElement.sourceNode.connect(audioContext.destination);
      }
      
      // Create destination for recording
      const destination = audioContext.createMediaStreamDestination();
      audioElement.sourceNode.connect(destination);
      
      this.currentStream = destination.stream;
      this.audioContext = audioContext; // Store for cleanup

      // Create MediaRecorder for AI audio
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/wav';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.currentStream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveRecording();
        if (this.audioContext) {
          this.audioContext.close(); // Clean up audio context
        }
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      console.log('Started AI audio recording');
      
    } catch (error) {
      console.error('Error starting AI recording:', error);
      this.cleanup();
    }
  }

  // Stop current recording
  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log(`Stopped ${this.recordingType} audio recording`);
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.cleanup();
    }
  }

  // Save recording to server
  async saveRecording() {
    if (this.recordedChunks.length === 0) {
      console.warn('No audio data to save');
      this.cleanup();
      return;
    }

    try {
      const endTime = new Date().toISOString();
      const blob = new Blob(this.recordedChunks, { 
        type: this.mediaRecorder.mimeType || 'audio/webm' 
      });

      // Create filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.recordingType}_${timestamp}.webm`;

      // Create query parameters and send blob directly
      const audioType = this.recordingType === 'user' ? 'user_speech' : 'ai_response';
      const params = new URLSearchParams({
        sessionId: this.sessionId,
        audioType: audioType,
        startedAt: this.startTime,
        endedAt: endTime
      });

      // Upload to server
      const response = await fetch(`/api/audio/upload?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: blob
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Audio recording saved:', result.id);
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('audioRecordingSaved', {
          detail: { 
            id: result.id, 
            audioType: this.recordingType, 
            sessionId: this.sessionId 
          }
        }));
      } else {
        console.error('Failed to save audio recording:', await response.text());
      }

    } catch (error) {
      console.error('Error saving recording:', error);
    } finally {
      this.cleanup();
    }
  }

  // Cleanup resources
  cleanup() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingType = null;
    this.startTime = null;
    this.sessionId = null;
    
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext = null;
    }
  }
}

// Global instance
window.AudioRecorder = new AudioRecorder();
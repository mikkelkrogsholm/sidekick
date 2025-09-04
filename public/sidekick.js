// Sidekick module - handles WebRTC connection to OpenAI Realtime API
const $ = s => document.querySelector(s);
let pc = null;
let dc = null;
let remoteAudio = null;
let stream = null;
let secretaryPaused = false;
let isConnected = false;
let activeSessionId = null;
let pendingUserUtterance = "";
let accumulatedAssistantText = "";
let isAssistantResponding = false;
let basePrompt = "You are Sidekick.";
let isRecording = false;
let shouldSendResponse = false;
let accumulatedTranscript = "";

async function fetchJSON(url, init) { 
  const r = await fetch(url, init); 
  if (!r.ok) throw new Error(await r.text()); 
  return r.json(); 
}

async function postJSON(url, body) { 
  return fetchJSON(url, { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(body) 
  }); 
}

async function ingestText(text) {
  if (!activeSessionId || !text?.trim()) return;
  const language = document.getElementById("languageSelect")?.value || "en";
  try {
    await postJSON("/ingest", { sessionId: activeSessionId, language, text });
  } catch (e) {
    console.error("Ingest failed", e);
  }
}

async function recordConversation(userText, assistantText) {
  // Only record if setting is enabled
  const shouldRecord = window.Settings?.get('sk_record_conversations', false) ?? false;
  if (!shouldRecord || !userText || !assistantText) return;
  
  // Add to transcript display
  if (window.Transcript?.addConversation) {
    window.Transcript.addConversation({ user: userText, assistant: assistantText });
  }
  
  // Ingest for embeddings as a single block
  const payload = `[Sidekick conversation]\nYou: ${userText}\nSidekick: ${assistantText}`;
  await ingestText(payload);
}

function status(msg) { 
  const el = $("#skStatus"); 
  if (el) el.textContent = msg; 
}

function log(text) { 
  const out = $("#skOutput"); 
  if (!out) return;
  
  // If this is a complete message, add it on a new line
  if (text.includes('\n') || text.endsWith('.') || text.endsWith('!') || text.endsWith('?')) {
    out.textContent += text + "\n"; 
  } else {
    // For partial updates, append to the current line
    const lines = out.textContent.split('\n');
    if (lines[lines.length - 1] && !lines[lines.length - 1].match(/[.!?]$/)) {
      lines[lines.length - 1] += text;
      out.textContent = lines.join('\n');
    } else {
      out.textContent += text;
    }
  }
  out.scrollTop = out.scrollHeight; 
}

function clearOutput() {
  const out = $("#skOutput");
  if (out) out.textContent = "";
}

async function connectSidekick(selectedSessionId) {
  try {
    // Prevent multiple connections
    if (isConnected) {
      console.log("Already connected");
      return;
    }

    status("Connecting...");
    
    // Set the active session for transcript ingestion
    activeSessionId = selectedSessionId;
    
    // 1) Optional context
    let context = "";
    const useNotes = window.Settings?.get("sk_use_notes", true) ?? true;
    
    if (useNotes && selectedSessionId) {
      try {
        const last = await fetchJSON(`/api/sessions/${selectedSessionId}/last-chunk`);
        if (last.content?.trim()) {
          const rag = await postJSON(`/api/search`, { 
            query: last.content, 
            limit: 6, 
            sessionId: selectedSessionId 
          });
          context = buildContext(last.content, rag.results || []);
        }
      } catch (err) {
        console.error("Error fetching context:", err);
        // Continue without context
      }
    }

    // 2) Ephemeral session mint
    status("Getting session token...");
    const token = await fetchJSON(`/ephemeral-token`);
    const ephemeralKey = token.client_secret?.value || token.client_secret || token.value;
    
    if (!ephemeralKey) {
      throw new Error("No ephemeral key received from server");
    }

    // 3) WebRTC peer connection with ICE servers
    status("Setting up connection...");
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Set up audio element
    remoteAudio = $("#skAudio");
    if (!remoteAudio) {
      throw new Error("Audio element not found");
    }
    
    // Handle incoming audio tracks
    pc.ontrack = e => { 
      console.log("Received remote track:", e.track.kind);
      if (remoteAudio) {
        remoteAudio.srcObject = e.streams[0]; 
      }
    };
    
    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        status("Connection lost");
        disconnect();
      }
    };

    // Add a dummy audio track to ensure the offer has an audio media section
    // This is required by OpenAI's Realtime API
    const dummyStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    // Keep the idle track alive and store the sender
    idleTrack = dummyStream.getAudioTracks()[0];
    idleTrack.enabled = false; // Disable but don't stop
    audioSender = pc.addTrack(idleTrack, dummyStream);

    // Create data channel
    dc = pc.createDataChannel("oai-events");
    
    dc.onopen = () => {
      console.log("Data channel opened");
      isConnected = true;
      status("Connected");
      $("#skConnectBtn").textContent = "Disconnect";
      
      // Set active session ID
      activeSessionId = selectedSessionId;
      
      // Send initial session configuration with instructions
      basePrompt = window.Settings?.get("sk_prompt", "You are Sidekick.") ?? "You are Sidekick.";
      const temp = window.Settings?.get("sk_temp", 0.6) ?? 0.6;
      
      sendEvent({
        type: "session.update",
        session: {
          instructions: basePrompt + (context ? "\n\nContext:\n" + context : ""),
          temperature: temp,
          voice: window.Settings?.get("sk_voice", "marin") ?? "marin",
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: false
          }
        }
      });
      
      // Log initial connection
      log("[Connected to Sidekick]\n");
      if (context) {
        log("[Context loaded from current session]\n");
      }
    };
    
    dc.onclose = () => {
      console.log("Data channel closed");
      isConnected = false;
      status("Disconnected");
    };
    
    dc.onerror = (error) => {
      console.error("Data channel error:", error);
      status("Connection error");
    };
    
    dc.onmessage = onRealtimeMessage;

    // Create offer (now includes audio media section)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Get model from settings
    const model = window.Settings?.get("sk_model", "gpt-4o-realtime-preview-2024-12-17") ?? "gpt-4o-realtime-preview-2024-12-17";
    
    // Send offer to OpenAI Realtime API
    status("Connecting to OpenAI...");
    const res = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      }
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const answerSdp = await res.text();
    const answer = { 
      type: "answer", 
      sdp: answerSdp 
    };
    
    await pc.setRemoteDescription(answer);
    
    // Wire up PTT and text input
    bindPTT(selectedSessionId);
    
  } catch (error) {
    console.error("Connection error:", error);
    status(`Error: ${error.message}`);
    isConnected = false;
    
    // Clean up on error
    disconnect();
  }
}

function disconnect() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  
  if (activeMicStream) {
    activeMicStream.getTracks().forEach(t => t.stop());
    activeMicStream = null;
  }
  
  if (idleTrack) {
    idleTrack.stop();
    idleTrack = null;
  }
  
  if (dc) {
    dc.close();
    dc = null;
  }
  
  if (pc) {
    pc.close();
    pc = null;
  }
  
  // Reset all state variables
  audioSender = null;
  activeSessionId = null;
  pendingUserUtterance = null;
  isConnected = false;
  $("#skConnectBtn").textContent = "Connect";
  status("Disconnected");
  
  // Resume Secretary if it was paused
  if (secretaryPaused && window.Secretary?.resume) {
    window.Secretary.resume();
    secretaryPaused = false;
  }
}

function sendEvent(obj) { 
  if (dc?.readyState === "open") {
    dc.send(JSON.stringify(obj));
    console.log("Sent event:", obj.type);
  } else {
    console.error("Cannot send event - data channel not open");
  }
}

function buildContext(latest, hits) {
  const bullets = hits.slice(0, 6).map((h, i) => `${i + 1}. ${h.content}`).join("\n");
  return `Latest note: ${latest}\n\nRelated notes:\n${bullets || "(none)"}`;
}

async function buildRagContextFromQuery(question, sessionId) {
  if (!question?.trim() || !sessionId) return "";
  try {
    const result = await postJSON(`/api/search`, { 
      query: question, 
      limit: 6, 
      sessionId,
      include: 'both',
      k_transcripts: 3,
      k_knowledge: 3
    });
    const hits = result?.results || [];
    if (!hits.length) return "";
    const lines = hits.map((h, i) => {
      const src = h.source === 'knowledge' ? `(knowledge: ${h.attribution?.sourceName ?? 'source'} #${h.attribution?.chunkIndex ?? '?'})` : '(transcript)';
      return `${i + 1}. ${h.content} ${src}`;
    }).join('\n');
    return `User question: ${question}\n\nRelevant material:\n${lines}`;
  } catch (e) {
    console.error('RAG context error:', e);
    return "";
  }
}

async function updateInstructionsWithContext(contextText) {
  const temp = window.Settings?.get("sk_temp", 0.6) ?? 0.6;
  sendEvent({
    type: "session.update",
    session: {
      instructions: basePrompt + (contextText ? `\n\nContext:\n${contextText}` : ""),
      temperature: temp
    }
  });
}

// Push-to-talk handlers
function bindPTT(sessionId) {
  const btn = $("#skPTT");
  const textInput = $("#skText");
  const sendBtn = $("#skSend");
  
  if (!btn) return;
  
  let toggleMode = false;
  
  const startRecording = async (e) => {
    if (e) e.preventDefault();
    if (!isConnected) return;
    
    // Check if we should interrupt the assistant
    if (isAssistantResponding) {
      sendEvent({ type: "response.cancel" });
      isAssistantResponding = false;
      log("\n[Interrupted]\n");
      
      // Stop audio playback immediately
      if (remoteAudio && remoteAudio.srcObject) {
        remoteAudio.pause();
        remoteAudio.currentTime = 0;
      }
      
      // Don't return - continue to start recording
      // This allows interrupting and immediately starting a new recording
    }
    
    if (isRecording) return;
    
    try {
      isRecording = true;
      shouldSendResponse = false;
      accumulatedTranscript = "";
      btn.style.background = "var(--color-accent)";
      btn.style.color = "white";
      btn.textContent = "Recording...";
      
      // Pause Secretary if configured
      const shouldPause = window.Settings?.get("sk_autopause", true) ?? true;
      if (shouldPause && window.Secretary?.pause && !secretaryPaused) { 
        window.Secretary.pause(); 
        secretaryPaused = true; 
      }
      
      // Get microphone
      activeMicStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Get the microphone track and replace the idle track
      const micTrack = activeMicStream.getAudioTracks()[0];
      await audioSender.replaceTrack(micTrack);
      
      // Note: We don't need to send response.create here
      // The server VAD will detect speech and handle the conversation automatically
      
      log("\n[Listening...]\n");
      
    } catch (error) {
      console.error("Error starting recording:", error);
      status(`Mic error: ${error.message}`);
      isRecording = false;
      btn.style.background = "";
      btn.style.color = "";
      btn.textContent = "Hold to talk";
    }
  };
  
  const stopRecording = async (e) => {
    if (e) e.preventDefault();
    if (!isRecording) return;
    
    isRecording = false;
    shouldSendResponse = true;
    
    const pttMode = window.Settings?.get('sk_ptt_mode', 'hold') ?? 'hold';
    btn.style.background = "";
    btn.style.color = "";
    btn.textContent = pttMode === 'toggle' ? "Click to talk" : "Hold to talk";
    
    if (activeMicStream) {
      // Replace the microphone track with the idle track
      await audioSender.replaceTrack(idleTrack);
      
      // Stop the microphone stream
      activeMicStream.getTracks().forEach(t => t.stop());
      activeMicStream = null;
      log("[Processing...]\n");
    }
    
    // Send response if we have accumulated transcript
    if (shouldSendResponse && accumulatedTranscript) {
      pendingUserUtterance = accumulatedTranscript;
      
      // Build RAG context and send response
      (async () => {
        const ctx = await buildRagContextFromQuery(accumulatedTranscript, activeSessionId);
        if (ctx) await updateInstructionsWithContext(ctx);
        const temp = window.Settings?.get("sk_temp", 0.6) ?? 0.6;
        sendEvent({ 
          type: "response.create",
          response: {
            temperature: temp
          }
        });
      })();
      
      accumulatedTranscript = "";
    }
    
    // Note: Secretary resume is now handled in response.done to prevent audio leakage
  };
  
  // Setup PTT based on mode
  const setupPTTHandlers = () => {
    const pttMode = window.Settings?.get('sk_ptt_mode', 'hold') ?? 'hold';
    btn.textContent = pttMode === 'toggle' ? "Click to talk" : "Hold to talk";
    toggleMode = pttMode === 'toggle';
    
    // Clear existing handlers
    btn.onmousedown = null;
    btn.onmouseup = null;
    btn.ontouchstart = null;
    btn.ontouchend = null;
    btn.onclick = null;
    btn.onkeydown = null;
    btn.onkeyup = null;
    
    if (toggleMode) {
      // Toggle mode: click to start/stop
      btn.onclick = (e) => {
        e.preventDefault();
        if (isRecording) {
          stopRecording(e);
        } else {
          startRecording(e);
        }
      };
      
      // Keyboard support for toggle mode
      btn.onkeydown = (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      };
    } else {
      // Hold mode with pointer capture
      let pointerCaptured = false;
      
      const handlePointerDown = async (e) => {
        e.preventDefault();
        
        // Capture the pointer to track release even outside the button
        if (e.pointerId !== undefined && btn.setPointerCapture) {
          try {
            btn.setPointerCapture(e.pointerId);
            pointerCaptured = true;
          } catch (err) {
            console.log("Pointer capture not supported, using fallback");
          }
        }
        
        await startRecording(e);
      };
      
      const handlePointerUp = async (e) => {
        e.preventDefault();
        
        // Release pointer capture
        if (pointerCaptured && e.pointerId !== undefined && btn.releasePointerCapture) {
          try {
            btn.releasePointerCapture(e.pointerId);
            pointerCaptured = false;
          } catch (err) {
            // Ignore
          }
        }
        
        await stopRecording(e);
      };
      
      // Use pointer events for better tracking
      btn.onpointerdown = handlePointerDown;
      btn.onpointerup = handlePointerUp;
      
      // Also add global document listener as fallback
      document.addEventListener('pointerup', (e) => {
        if (isRecording && !toggleMode) {
          handlePointerUp(e);
        }
      });
      
      // Touch events fallback
      btn.ontouchstart = (e) => {
        e.preventDefault();
        startRecording(e);
      };
      
      btn.ontouchend = (e) => {
        e.preventDefault();
        stopRecording(e);
      };
      
      // Keyboard support for hold mode
      btn.onkeydown = (e) => {
        if (e.key === ' ' && !isRecording) {
          e.preventDefault();
          startRecording();
        }
      };
      
      btn.onkeyup = (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          stopRecording();
        }
      };
    }
  };
  
  // Initial setup
  setupPTTHandlers();
  
  // Listen for settings changes
  window.addEventListener('storage', (e) => {
    if (e.key === 'sk_ptt_mode') {
      setupPTTHandlers();
    }
  });

  // Text input handler
  const sendText = () => {
    if (!textInput || !isConnected) return;
    
    const text = textInput.value.trim();
    if (!text) return;
    
    textInput.value = "";
    log(`\nYou: ${text}\n`);
    
    // Set pending utterance for typed input
    pendingUserUtterance = text;
    
    // Pause Secretary if configured (for typed input too)
    const shouldPause = window.Settings?.get("sk_autopause", true) ?? true;
    if (shouldPause && window.Secretary?.pause && !secretaryPaused) {
      window.Secretary.pause();
      secretaryPaused = true;
    }
    
    // Build dynamic RAG context for this question and update session instructions
    (async () => {
      const ctx = await buildRagContextFromQuery(text, sessionId);
      if (ctx) await updateInstructionsWithContext(ctx);

      // Send the text as a conversation item
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: text
          }]
        }
      });

      // Then request a response
      const temp = window.Settings?.get("sk_temp", 0.6) ?? 0.6;
      sendEvent({ 
        type: "response.create",
        response: {
          temperature: temp
        }
      });
    })();
  };
  
  if (sendBtn) {
    sendBtn.onclick = sendText;
  }
  
  if (textInput) {
    textInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText();
      }
    };
  }
}

let currentResponseText = "";

function onRealtimeMessage(e) {
  try {
    const msg = JSON.parse(e.data);
    console.log("Received message:", msg.type);
    
    switch(msg.type) {
      case "response.text.delta":
        // Text delta update
        if (msg.delta) {
          if (!isAssistantResponding) {
            isAssistantResponding = true;
          }
          currentResponseText += msg.delta;
          log(msg.delta);
        }
        break;
        
      case "response.text.done":
        // Text generation complete
        if (msg.text) {
          if (!currentResponseText) {
            log("\nSidekick: " + msg.text + "\n");
          }
          // Store the complete assistant text
          accumulatedAssistantText = msg.text;
        }
        currentResponseText = "";
        break;
        
      case "response.audio_transcript.delta":
        // Transcript of what the model is saying
        if (msg.delta) {
          if (!isAssistantResponding) {
            isAssistantResponding = true;
          }
          currentResponseText += msg.delta;
          log(msg.delta);
        }
        break;
        
      case "response.audio_transcript.done":
        // Complete transcript of audio response
        if (msg.transcript) {
          log("\n");
          // Store the complete assistant text
          accumulatedAssistantText = msg.transcript;
        }
        break;
        
      case "conversation.item.input_audio_transcription.completed":
        // User's speech was transcribed
        if (msg.transcript) {
          // Accumulate transcript while recording
          if (isRecording) {
            if (accumulatedTranscript) {
              accumulatedTranscript += " " + msg.transcript;
            } else {
              accumulatedTranscript = msg.transcript;
            }
            log(`\nYou: ${msg.transcript}\n`);
          } else {
            // If not recording (shouldn't happen), send response immediately
            log(`\nYou: ${msg.transcript}\n`);
            pendingUserUtterance = msg.transcript;

            // Build RAG context for the spoken question and update instructions, then request a response
            (async () => {
              const ctx = await buildRagContextFromQuery(msg.transcript, activeSessionId);
              if (ctx) await updateInstructionsWithContext(ctx);
              const temp = window.Settings?.get("sk_temp", 0.6) ?? 0.6;
              sendEvent({ 
                type: "response.create",
                response: {
                  temperature: temp
                }
              });
            })();
          }
        }
        break;
        
      case "response.done":
        // Response complete
        isAssistantResponding = false;
        
        if (msg.response?.output && !accumulatedAssistantText) {
          // Extract assistant text if we didn't get it from done events
          msg.response.output.forEach(item => {
            if (item.type === "text" && item.text) {
              if (!currentResponseText.includes(item.text)) {
                log("\nSidekick: " + item.text + "\n");
              }
              accumulatedAssistantText = item.text;
            }
          });
        }
        
        // Record the complete conversation if enabled and we have both parts
        if (pendingUserUtterance && accumulatedAssistantText) {
          recordConversation(pendingUserUtterance, accumulatedAssistantText);
        }
        
        // Reset state for next interaction
        pendingUserUtterance = "";
        accumulatedAssistantText = "";
        currentResponseText = "";
        shouldSendResponse = false;

        // Restore base instructions (remove transient context) for next turn
        updateInstructionsWithContext("");
        
        // Resume Secretary after response is complete
        if (secretaryPaused && window.Secretary?.resume) {
          window.Secretary.resume();
          secretaryPaused = false;
        }
        break;
        
      case "response.cancelled":
        // Response was cancelled
        isAssistantResponding = false;
        currentResponseText = "";
        accumulatedAssistantText = "";
        
        // Don't resume Secretary here as user is likely about to speak
        break;
        
      case "error":
        console.error("Realtime API error:", msg);
        if (msg.error?.message) {
          log(`\n[Error: ${msg.error.message}]\n`);
          status(`Error: ${msg.error.message}`);
        }
        isAssistantResponding = false;
        break;
        
      case "session.created":
        console.log("Session created:", msg);
        break;
        
      case "session.updated":
        console.log("Session updated:", msg);
        break;
        
      default:
        // Log other message types for debugging
        if (msg.type.includes("error")) {
          console.error("Unknown error type:", msg);
        }
    }
  } catch (err) {
    console.error("Error parsing message:", err, e.data);
  }
}

// Wire up UI on DOM load
window.addEventListener("DOMContentLoaded", () => {
  const connectBtn = $("#skConnectBtn");
  if (!connectBtn) return;
  
  connectBtn.onclick = async () => {
    try {
      if (isConnected) {
        // Disconnect
        disconnect();
      } else {
        // Connect
        status("Connecting...");
        
        // Get current session from localStorage
        const currentSessionId = localStorage.getItem('currentSessionId') || null;
        
        if (!currentSessionId) {
          // Try to use current session if Secretary has one selected
          const sessionNameSpan = document.getElementById('currentSessionName');
          if (sessionNameSpan && sessionNameSpan.textContent !== 'None') {
            // Session is selected, use it
            await connectSidekick(currentSessionId);
          } else {
            // No session selected, connect without context
            await connectSidekick(null);
          }
        } else {
          await connectSidekick(currentSessionId);
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
      status(`Error: ${error.message}`);
      isConnected = false;
      $("#skConnectBtn").textContent = "Connect";
    }
  };
  
  // Clear output when starting fresh
  const clearBtn = document.createElement('button');
  clearBtn.className = 'button button--ghost';
  clearBtn.textContent = 'Clear';
  clearBtn.onclick = clearOutput;
  
  const panelHeader = $("#sidekickPanel .panel-actions");
  if (panelHeader) {
    panelHeader.insertBefore(clearBtn, panelHeader.firstChild);
  }
});

// Expose global reference for debugging
window.Sidekick = {
  connect: connectSidekick,
  disconnect: disconnect,
  isConnected: () => isConnected
};

import { Settings } from "./settings.js";

const $ = s => document.querySelector(s);
let pc, dc, remoteAudio, stream, secretaryPaused = false;

async function fetchJSON(url, init){ const r = await fetch(url, init); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function postJSON(url, body){ return fetchJSON(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }); }

function status(msg){ const el = $("#skStatus"); if (el) el.textContent = msg; }
function log(text){ const out = $("#skOutput"); out.textContent += text + "\n"; out.scrollTop = out.scrollHeight; }

async function connectSidekick(selectedSessionId){
  // 1) Optional context
  let context = "";
  if (Settings.get("sk_use_notes", true) && selectedSessionId) {
    try {
      const last = await fetchJSON(`/api/sessions/${selectedSessionId}/last-chunk`);
      if (last.content?.trim()) {
        const rag = await postJSON(`/api/search`, { query: last.content, limit: 6, sessionId: selectedSessionId });
        context = buildContext(last.content, rag.results || []);
      }
    } catch (err) {
      console.error("Error fetching context:", err);
    }
  }

  // 2) Ephemeral session mint
  const token = await fetchJSON(`/ephemeral-token`);

  // 3) WebRTC peer
  pc = new RTCPeerConnection();
  remoteAudio = $("#skAudio");
  pc.ontrack = e => { remoteAudio.srcObject = e.streams[0]; };

  dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    status("Connected");
    // seed initial context/instructions
    const prompt = Settings.get("sk_prompt","You are Sidekick.");
    sendEvent({
      type: "response.create",
      response: {
        instructions: prompt,
        input_text: context || "Start a helpful conversation.",
        temperature: Settings.get("sk_temp",0.6)
      }
    });
  };
  dc.onmessage = onRealtimeMessage;

  // Offer/Answer via Realtime endpoint using ephemeral key
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const model = Settings.get("sk_model","gpt-realtime");
  const res = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${token.client_secret?.value || token.client_secret || token.value || ""}`,
      "Content-Type": "application/sdp"
    }
  });
  const answer = { type: "answer", sdp: await res.text() };
  await pc.setRemoteDescription(answer);

  // wire PTT
  bindPTT(selectedSessionId);
}

function sendEvent(obj){ if (dc?.readyState === "open") dc.send(JSON.stringify(obj)); }

function buildContext(latest, hits){
  const bullets = hits.slice(0,6).map((h,i)=>`${i+1}) ${h.content}`).join("\n");
  return `Latest note: ${latest}\nRelated notes:\n${bullets || "(none)"}`;
}

// Push-to-talk handlers
function bindPTT(sessionId){
  const btn = $("#skPTT");
  const down = async () => {
    if (Settings.get("sk_autopause", true) && window.Secretary?.pause && !secretaryPaused){ window.Secretary.pause(); secretaryPaused = true; }
    const base = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream = new MediaStream([ base.getAudioTracks()[0].clone() ]);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    // Let the model know audio is coming and we want a reply
    sendEvent({ type:"response.create", response: { input_audio: true, temperature: Settings.get("sk_temp",0.6) }});
  };
  const up = () => {
    if (!stream) return;
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    if (secretaryPaused && window.Secretary?.resume){ window.Secretary.resume(); secretaryPaused = false; }
  };
  btn.onmousedown = down;  btn.onmouseup = up;
  btn.ontouchstart = down; btn.ontouchend = up;

  // Text ask
  $("#skSend").onclick = () => {
    const text = $("#skText").value.trim();
    if (!text) return;
    $("#skText").value = "";
    sendEvent({ type:"response.create", response: { input_text: text, temperature: Settings.get("sk_temp",0.6) }});
  };
}

function onRealtimeMessage(e){
  try {
    const msg = JSON.parse(e.data);
    // Minimal: show partials/finals
    if (msg.type === "response.delta" && msg.delta?.output_text) log(msg.delta.output_text);
    if (msg.type === "response.completed" && msg.response?.output_text) log(msg.response.output_text);
    // (Optional) tool calls could be handled here, see Note below.
  } catch {}
}

// Wire up
window.addEventListener("DOMContentLoaded", () => {
  $("#skConnectBtn").onclick = async () => {
    try {
      status("Connecting...");
      const select = document.getElementById("sessionSelect"); // re-use your existing session select if present
      const sessionId = select?.value || null;
      
      // For now, try to get current session from localStorage or use null
      const currentSessionId = localStorage.getItem('currentSessionId') || null;
      
      await connectSidekick(currentSessionId);
    } catch (error) {
      console.error("Connection error:", error);
      status(`Error: ${error.message}`);
    }
  };
});
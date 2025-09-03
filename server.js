import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Enable CORS for browser access
app.use(cors());
app.use(express.static("public"));

app.get("/ephemeral-token", async (req, res) => {
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
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to start`);
});
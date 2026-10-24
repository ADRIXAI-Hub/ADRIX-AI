
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = (process.env.GEMINI_MODEL || "gemini-3.8-flash")
  .replace(/^models\//, "")
  .trim();

app.get("/", (req, res) => {
  res.json({
    app: "ADRIX AI",
    status: "online",
    message: "ADRIX AI backend is running"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Render Environment."
      });
    }

    const message = String(
      req.body?.message ??
      req.body?.prompt ??
      req.body?.text ??
      ""
    ).trim();

    if (!message) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const parts = [{ text: message }];

    // Optional image support when the frontend sends a data URL.
    const image = req.body?.image;

    if (typeof image === "string" && image.startsWith("data:image/")) {
      const match = image.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
      );

      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2].replace(/\s/g, "")
          }
        });
      }
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);

      return res.status(502).json({
        error:
          data?.error?.message ||
          `Gemini API request failed (${response.status}).`
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned no text. Please try another message."
      });
    }

    return res.json({ reply });
  } catch (error) {
    console.error("ADRIX AI server error:", error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ADRIX AI server running on port ${PORT}`);
});

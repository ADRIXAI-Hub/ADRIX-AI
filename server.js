
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    app: "ADRIX AI",
    status: "Backend is running"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const message =
      req.body.message ||
      req.body.prompt ||
      req.body.text;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Please send a message"
      });
    }

    const parts = [{ text: message }];

    const image = req.body.image;

    if (typeof image === "string" && image.startsWith("data:")) {
      const match = image.match(
        /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/
      );

      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2]
          }
        });
      }
    }

    const model = (
  process.env.GEMINI_MODEL || "gemini-2.5-flash"
).replace(/^models\//, "").trim();

const url =
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts
          }],
          systemInstruction: {
            parts: [{
              text: "You are ADRIX AI, a helpful assistant. Reply clearly in the language used by the user."
            }]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        data.error?.message || "Unknown error"
      );

      return res.status(502).json({
        error: data.error?.message || "Gemini API request failed"
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    return res.json({ reply });

  } catch (error) {
    console.error("Server error:", error.message);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ADRIX AI server running on port ${PORT}`);
});

import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.GEMINI_API_KEY;

const MODEL = (process.env.GEMINI_MODEL || "gemini-3.8-flash")
  .replace(/^models\//, "")
  .replace(/:generateContent$/, "")
  .trim();

app.disable("x-powered-by");

app.use(cors({
  origin: "https://adrixai-hub.github.io",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10mb" }));

/* =========================
   HOME / HEALTH
========================= */

app.get("/", (req, res) => {
  res.json({
    app: "ADRIX AI",
    status: "online",
    model: MODEL
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "ADRIX AI"
  });
});

/* =========================
   CHAT
========================= */

app.post("/chat", async (req, res) => {

  const started = Date.now();

  try {

    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY Render में सेट नहीं है।"
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
        error: "कृपया अपना सवाल लिखें।"
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "सवाल बहुत लंबा है। 4000 characters से कम रखें।"
      });
    }

    /* =========================
       TEXT PART
    ========================= */

    const parts = [
      {
        text:
          "You are ADRIX AI. " +
          "Answer the user directly and quickly. " +
          "Use simple Hindi or Hinglish when appropriate. " +
          "For simple questions, keep the answer short. " +
          "Do not unnecessarily repeat the question.\n\n" +
          message
      }
    ];

    /* =========================
       OPTIONAL IMAGE
    ========================= */

    const image = req.body?.image;

    if (
      typeof image === "string" &&
      image.length > 0
    ) {

      if (image.length > 5000000) {
        return res.status(400).json({
          error: "फोटो बहुत बड़ी है। छोटी फोटो चुनें।"
        });
      }

      const match = image.match(
        /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/
      );

      if (!match) {
        return res.status(400).json({
          error: "सिर्फ JPEG, PNG या WebP image supported है।"
        });
      }

      parts.push({
        inline_data: {
          mime_type: match[1],
          data: match[2].replace(/\s/g, "")
        }
      });
    }

    /* =========================
       GEMINI URL
    ========================= */

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    /* =========================
       30 SECOND TIMEOUT
    ========================= */

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

    console.log(
      "ADRIX: Gemini request started"
    );

    let response;

    try {

      response = await fetch(url, {
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
          ],

          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.5
          }
        }),

        signal: controller.signal
      });

    } finally {

      clearTimeout(timeout);

    }

    console.log(
      "ADRIX: Gemini response received",
      response.status,
      `${Date.now() - started}ms`
    );

    /* =========================
       READ RESPONSE
    ========================= */

    const data = await response.json();

    if (!response.ok) {

      console.error(
        "Gemini API error:",
        response.status,
        data?.error?.message || "Unknown error"
      );

      if (response.status === 429) {
        return res.status(429).json({
          error: "Gemini API quota या rate limit की समस्या है।"
        });
      }

      return res.status(502).json({
        error:
          data?.error?.message ||
          `Gemini API error ${response.status}`
      });
    }

    /* =========================
       GET AI TEXT
    ========================= */

    const reply = (
      data?.candidates?.[0]?.content?.parts || []
    )
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {

      return res.status(502).json({
        error: "Gemini ने कोई text response नहीं दिया।"
      });
    }

    /* =========================
       SUCCESS
    ========================= */

    return res.json({
      reply,
      model: MODEL,
      responseTime: `${Date.now() - started}ms`
    });

  } catch (error) {

    console.error(
      "ADRIX server error:",
      error?.name || "UnknownError"
    );

    if (error?.name === "AbortError") {

      return res.status(504).json({
        error:
          "AI response में बहुत समय लग रहा है। कृपया दोबारा कोशिश करें।"
      });
    }

    return res.status(500).json({
      error:
        "AI connection में समस्या हुई। बाद में फिर कोशिश करें।"
    });
  }

});

/* =========================
   SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ADRIX AI server running on port ${PORT}`
    );

    console.log(
      `ADRIX AI model: ${MODEL}`
    );
  }
);

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const ALLOWED_ORIGINS = [
  "https://adrixai-hub.github.io"
];

app.use(cors({
  origin(origin, callback) {
    // Allow requests without Origin for health checks and server tools.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600
}));

app.use(express.json({ limit: "10kb" }));

// Basic in-memory rate limit: 20 chat requests per IP per 15 minutes.
// This resets when the server restarts and is not shared across instances.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20;
const requestCounts = new Map();

app.use("/chat", (req, res, next) => {
  if (req.method !== "POST") return next();

  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  let entry = requestCounts.get(ip);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  entry.count += 1;
  requestCounts.set(ip, entry);

  if (entry.count > MAX_REQUESTS) {
    res.set("Retry-After", String(
      Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    ));

    return res.status(429).json({
      error: "बहुत सारी requests भेजी गई हैं। कुछ देर बाद दोबारा कोशिश करें।"
    });
  }

  // Periodically remove expired entries to limit memory growth.
  if (requestCounts.size > 1000) {
    for (const [key, value] of requestCounts) {
      if (now >= value.resetAt) requestCounts.delete(key);
    }
  }

  next();
});

const client = API_KEY
  ? new OpenAI({ apiKey: API_KEY })
  : null;

app.get("/", (req, res) => {
  res.send("ADRIX AI backend is running!");
});

app.post("/chat", async (req, res) => {
  const message = req.body?.message;

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 4000
  ) {
    return res.status(400).json({
      error: "कृपया 1 से 4000 अक्षरों के बीच सही सवाल लिखें।"
    });
  }

  if (!client) {
    return res.status(503).json({
      error: "AI सेवा अभी कॉन्फ़िगर नहीं है। बाद में कोशिश करें।"
    });
  }

  try {
    const result = await client.responses.create({
      model: MODEL,
      instructions:
        "You are ADRIX AI, a helpful assistant. Reply in the language the user uses.",
      input: message.trim()
    });

    return res.json({
      reply: result.output_text || "अभी जवाब नहीं मिल पाया।"
    });
  } catch (error) {
    // Never log the user's message, API key, or full error object.
    const status = error?.status;

    console.error("ADRIX AI request failed. Status:", status || "unknown");

    if (status === 429) {
      return res.status(429).json({
        error: "AI सेवा की limit पूरी हो गई है। कृपया बाद में कोशिश करें।"
      });
    }

    return res.status(503).json({
      error: "अभी जवाब नहीं मिल पाया। कृपया बाद में कोशिश करें।"
    });
  }
});

// Do not expose internal error details to users.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request बहुत बड़ी है।"
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Request का format सही नहीं है।"
    });
  }

  if (err?.message === "Origin not allowed") {
    return res.status(403).json({
      error: "यह वेबसाइट अनुमति प्राप्त नहीं है।"
    });
  }

  return res.status(500).json({
    error: "सर्वर में समस्या है। बाद में कोशिश करें।"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("ADRIX AI server started");
});


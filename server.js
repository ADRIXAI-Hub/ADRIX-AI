import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

app.use(cors({
  origin: "https://adrixai-hub.github.io",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Images are larger than text; keep the request limit bounded.
app.use(express.json({ limit: "6mb" }));

const client = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null;

app.get("/", (req, res) => {
  res.send("ADRIX AI backend is running!");
});

app.post("/chat", async (req, res) => {
  const message = req.body?.message;
  const image = req.body?.image;

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 4000
  ) {
    return res.status(400).json({
      error: "कृपया 1 से 4000 अक्षरों के बीच सवाल लिखें।"
    });
  }

  let content = [
    { type: "input_text", text: message.trim() }
  ];

  if (image !== undefined && image !== null && image !== "") {
    if (typeof image !== "string" || image.length > 5_000_000) {
      return res.status(400).json({
        error: "फोटो बहुत बड़ी है। छोटी फोटो चुनें।"
      });
    }

    // Only allow common image formats as data URLs.
    const validImage =
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image);

    if (!validImage) {
      return res.status(400).json({
        error: "सिर्फ JPEG, PNG या WebP फोटो चुनें।"
      });
    }

    content.push({
      type: "input_image",
      image_url: image
    });
  }

  if (!client) {
    return res.status(503).json({
      error: "AI सेवा कॉन्फ़िगर नहीं है।"
    });
  }

  try {
    const result = await client.responses.create({
      model: MODEL,
      instructions:
        "You are ADRIX AI. Reply in the language the user uses. Describe uploaded images carefully and state uncertainty when needed.",
      input: [{ role: "user", content }]
    });

    return res.json({
      reply: result.output_text || "अभी जवाब नहीं मिल पाया।"
    });
  } catch (error) {
    // Do not log user messages, images, or secrets.
    console.error("ADRIX AI request failed:", error?.status || "unknown");

    if (error?.status === 429) {
      return res.status(429).json({
        error: "AI quota या rate limit की समस्या है।"
      });
    }

    return res.status(503).json({
      error: "AI जवाब नहीं दे पाया। बाद में कोशिश करें।"
    });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "फोटो या request बहुत बड़ी है। छोटी फोटो चुनें।"
    });
  }

  return res.status(400).json({
    error: "Request सही नहीं है।"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("ADRIX AI server started");
});



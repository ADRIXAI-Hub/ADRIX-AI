
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20kb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("ADRIX AI backend is running!");
});

app.post("/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" ||
        !message.trim() ||
        message.length > 4000) {
      return res.status(400).json({
        error: "कृपया सही सवाल लिखें।"
      });
    }

    const result = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions:
        "You are ADRIX AI, a helpful assistant. Reply in the language the user uses.",
      input: message.trim()
    });

    res.json({ reply: result.output_text });
  } catch (error) {
    console.error("AI request failed:", error.status || "unknown");

    res.status(500).json({
      error: "अभी जवाब नहीं मिल पाया। कृपया दोबारा कोशिश करें।"
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("ADRIX AI server started");
});

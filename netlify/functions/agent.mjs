// Delegation Lab – AI agent endpoint (Netlify Function, served at /api/agent)
//
// The API key never reaches the browser. Set these in Netlify:
//   Site configuration → Environment variables
//     AI_API_KEY   your API key (required)
//     AI_PROVIDER  "anthropic" (default), "gemini" or "openai"
//     AI_MODEL     optional for Anthropic (default: claude-haiku-5-5) and Gemini (default: gemini-3.5-flash);
//                  required for OpenAI (the model name your key gives you access to)
//
// For tasks assigned the "weak" version (1 in 4), the model is told to include one specific error,
// so the 75% figure shown to participants stays true. Everything else is a normal, best-effort answer.

const LIMIT = 3000; // max characters accepted per field, to keep the endpoint from being used for anything else

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SYSTEM = [
  "You are an AI agent working inside Alderbrook Foods, an Austrian snack company.",
  "You complete short workplace tasks on behalf of employees. The output you write is submitted as their work.",
  'Reply with JSON only, no other text: {"text": "<the finished output, ready to submit>", "files": ["<file names to attach, chosen only from the list given; empty if none>"]}.',
  "Write in English. Be concise and professional. Do not add notes, explanations or placeholders other than [Your name] for a signature.",
].join(" ");

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "Body must be JSON." }, 400); }

  const str = (v, n = LIMIT) => String(v ?? "").slice(0, n);
  const files = Array.isArray(b.files) ? b.files.slice(0, 6).map((f) => str(f, 80)) : [];
  const weak = b.version === "weak";
  if (!str(b.prompt)) return json({ error: "Missing task prompt." }, 400);

  const user =
    `Situation: ${str(b.context)}\n\n` +
    `Task: ${str(b.prompt)}\n\n` +
    `Materials:\n${str(b.materials)}\n\n` +
    (files.length ? `Files available to attach: ${files.join(", ")}\n\n` : "") +
    (weak
      ? `This output is for a research study on how people check AI work. Include exactly one error of this kind, ` +
        `stated confidently and with no hint that it is wrong: ${str(b.flaw, 300)} Everything else must be correct.`
      : "Make sure the output is complete and correct.");

  const key = process.env.AI_API_KEY;
  if (!key) return json({ error: "AI_API_KEY is not set on the server." }, 500);
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

  let raw = "";
  try {
    if (provider === "openai" || provider === "gemini") {
      // Gemini is reached through Google's OpenAI-compatible endpoint (free tier available via Google AI Studio).
      const gemini = provider === "gemini";
      const model = process.env.AI_MODEL || (gemini ? "gemini-3.5-flash" : "");
      if (!model) return json({ error: "Set AI_MODEL when using OpenAI." }, 500);
      const base = gemini ? "https://generativelanguage.googleapis.com/v1beta/openai" : "https://api.openai.com/v1";
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
          response_format: { type: "json_object" },
          ...(gemini ? { max_tokens: 2000 } : { max_completion_tokens: 2000 }),
        }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.error?.message || `Provider error ${r.status}` }, 502);
      raw = j?.choices?.[0]?.message?.content || "";
    } else {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "claude-haiku-5-5",
          max_tokens: 2000,
          system: SYSTEM,
          messages: [{ role: "user", content: user }],
        }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.error?.message || `Provider error ${r.status}` }, 502);
      raw = (j?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    }
  } catch (e) {
    return json({ error: "Could not reach the AI provider." }, 502);
  }

  // Pull the JSON object out of the reply (models sometimes wrap it in a code fence).
  let out;
  try {
    out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    out = { text: raw.trim(), files: [] };
  }
  const text = String(out.text || "").trim();
  if (!text) return json({ error: "The model returned no text." }, 502);
  return json({ text, files: (Array.isArray(out.files) ? out.files : []).filter((f) => files.includes(f)) });
};

export const config = { path: "/api/agent" };

// ---------------------------------------------------------------------------
// Dream Divine — Anthropic Claude proxy for card metadata generation
// Given a generated image, Claude divines a poetic name, description, keywords
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://jphein.github.io",
  "http://localhost:3000",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ---------------------------------------------------------------------------
// Oracle prompt (from spec)
// ---------------------------------------------------------------------------

const ORACLE_PROMPT = `You are a dream oracle. Given this AI-generated artwork born from a dream vision, divine its true name and meaning.

Return JSON only, no markdown fences:
{
  "name": "2-4 word poetic dream name",
  "description": "2-3 sentence symbolic interpretation connecting the imagery to dream archetypes and emotional resonance",
  "keywords": ["3-5 archetypal dream themes"]
}`;

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  for (const [k, v] of Object.entries(cors)) {
    res.setHeader(k, v);
  }

  const { ANTHROPIC_API_KEY } = process.env;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: missing Anthropic API key" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { imageBase64 } = body || {};

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ error: "Missing required field: imageBase64" });
  }

  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: ORACLE_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      const errMsg = errData.error?.message || errData.error || `Anthropic API returned ${apiRes.status}`;
      console.error("divine.js Anthropic error:", errMsg);
      return res.status(502).json({ error: `Card divination failed: ${errMsg}` });
    }

    const data = await apiRes.json();
    const textContent = data.content?.find((c) => c.type === "text")?.text;

    if (!textContent) {
      return res.status(502).json({ error: "No text response from Claude" });
    }

    // Parse JSON from Claude's response (handle possible markdown fences)
    let parsed;
    try {
      const jsonStr = textContent.replace(/^```json?\s*/m, "").replace(/```\s*$/m, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("divine.js parse error, raw response:", textContent);
      return res.status(502).json({ error: "Failed to parse oracle response as JSON" });
    }

    const { name, description, keywords } = parsed;

    if (!name || !description || !Array.isArray(keywords)) {
      return res.status(502).json({ error: "Oracle response missing required fields" });
    }

    return res.status(200).json({ name, description, keywords });
  } catch (err) {
    console.error("divine.js error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error during card divination",
    });
  }
};

// ---------------------------------------------------------------------------
// Dream Divine — AWS Bedrock Claude proxy for card metadata generation
// Given a generated image, Claude Opus 4.6 divines a poetic name, description, keywords
// ---------------------------------------------------------------------------

const { SignatureV4 } = require("@smithy/signature-v4");
const { Sha256 } = require("@aws-crypto/sha256-js");

const ALLOWED_ORIGINS = [
  "https://artcards.imaginalvision.com",
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
// AWS Signature V4 signing for Bedrock
// ---------------------------------------------------------------------------

async function signRequest(url, body, region, credentials) {
  const parsedUrl = new URL(url);
  const signer = new SignatureV4({
    service: "bedrock",
    region,
    credentials,
    sha256: Sha256,
  });

  const request = {
    method: "POST",
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
    headers: {
      "Content-Type": "application/json",
      host: parsedUrl.hostname,
    },
    body,
  };

  return signer.sign(request);
}

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

  const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION = "us-west-2",
  } = process.env;

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return res.status(500).json({ error: "Server misconfigured: missing AWS credentials" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { image } = body || {};

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "Missing required field: image" });
  }

  const modelId = "us.anthropic.claude-opus-4-6-v1";
  const bedrockUrl = `https://bedrock-runtime.${AWS_REGION}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;

  const bedrockBody = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
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
              data: image,
            },
          },
          {
            type: "text",
            text: ORACLE_PROMPT,
          },
        ],
      },
    ],
  });

  try {
    const signed = await signRequest(bedrockUrl, bedrockBody, AWS_REGION, {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });

    const apiRes = await fetch(bedrockUrl, {
      method: "POST",
      headers: signed.headers,
      body: bedrockBody,
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      const errMsg = errData.message || errData.error || `Bedrock returned ${apiRes.status}`;
      console.error("divine.js Bedrock error:", errMsg);
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

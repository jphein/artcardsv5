// ---------------------------------------------------------------------------
// Dream Cast — Azure OpenAI image generation proxy
// Models: flux-1.1-pro (backgrounds), gpt-image-1.5 (elements/transparency)
// ---------------------------------------------------------------------------

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
// Prompt prefixes (from Dreamspace)
// ---------------------------------------------------------------------------

const PROMPT_PREFIXES = {
  background:
    "immersive atmospheric background for a therapeutic art collage, edge-to-edge composition " +
    "with no central focal object, rich layered depth and luminous soft lighting, painterly " +
    "textures blending watercolor washes with subtle grain, dreamlike and emotionally evocative, " +
    "soft color transitions, gentle gradients of light and shadow that invite projection and " +
    "contemplation — ",
  element:
    "clean digital illustration for collage cutout, complete subject fully visible, centered " +
    "with generous empty space on all sides, plain solid white background, no shadows, no " +
    "ground, sharp edges — ",
  freeform: "",
  custom: "",
};

// ---------------------------------------------------------------------------
// Dream essence style suffixes
// ---------------------------------------------------------------------------

const ESSENCE_SUFFIXES = {
  "fairy-tale": ", fairy tale illustration style with storybook warmth and whimsical detail",
  "oil-painting": ", rich oil painting style with visible brushstrokes and classical depth",
  "anime": ", anime art style with clean lines, vibrant colors, and expressive design",
  "watercolor": ", soft watercolor style with translucent washes and organic bleeding edges",
  "dark-fantasy": ", dark fantasy art style with dramatic shadows and gothic atmosphere",
  "ethereal": ", ethereal luminous style with soft glowing light and otherworldly beauty",
  "mythological": ", mythological art style with epic grandeur and symbolic imagery",
};

// ---------------------------------------------------------------------------
// FLUX size constraint: max 1440px per dimension, round to 32px multiples
// ---------------------------------------------------------------------------

function clampFluxSize(width, height) {
  const MAX = 1440;
  if (width > MAX || height > MAX) {
    const scale = MAX / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  // Round to nearest 32px multiple
  width = Math.round(width / 32) * 32;
  height = Math.round(height / 32) * 32;
  // Ensure minimums
  width = Math.max(width, 256);
  height = Math.max(height, 256);
  return `${width}x${height}`;
}

// ---------------------------------------------------------------------------
// Parse size string and apply model constraints
// ---------------------------------------------------------------------------

function resolveSize(sizeStr, model) {
  const match = (sizeStr || "1024x1024").match(/^(\d+)x(\d+)$/);
  if (!match) return "1024x1024";

  let w = parseInt(match[1], 10);
  let h = parseInt(match[2], 10);

  if (model === "flux-1.1-pro" || model === "FLUX-1.1-pro") {
    return clampFluxSize(w, h);
  }
  return `${w}x${h}`;
}

// ---------------------------------------------------------------------------
// Build the full prompt with prefix and essences
// ---------------------------------------------------------------------------

function buildPrompt(prompt, dreamType, essences) {
  const prefix = PROMPT_PREFIXES[dreamType] || "";
  let full = prefix + prompt;

  if (Array.isArray(essences) && essences.length > 0) {
    for (const essence of essences) {
      const suffix = ESSENCE_SUFFIXES[essence];
      if (suffix) full += suffix;
    }
  }

  return full;
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

  const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY } = process.env;
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: missing Azure OpenAI credentials" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const {
    prompt,
    model = "flux-1.1-pro",
    size = "1024x1024",
    background,
    dreamType = "freeform",
    essences,
  } = body || {};

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Missing required field: prompt" });
  }

  const allowedModels = ["flux-1.1-pro", "FLUX-1.1-pro", "gpt-image-1.5"];
  if (!allowedModels.includes(model)) {
    return res.status(400).json({
      error: `Invalid model. Allowed: flux-1.1-pro, gpt-image-1.5`,
    });
  }

  // Normalize model name for Azure API
  const azureModel = model === "flux-1.1-pro" ? "FLUX-1.1-pro" : model;
  const resolvedSize = resolveSize(size, model);
  const fullPrompt = buildPrompt(prompt.trim(), dreamType, essences);

  const isFlux = azureModel === "FLUX-1.1-pro";

  // FLUX uses width/height integers; GPT-Image uses size string + response_format
  let azureBody;
  if (isFlux) {
    const [w, h] = resolvedSize.split("x").map(Number);
    azureBody = { prompt: fullPrompt, width: w, height: h };
  } else {
    azureBody = {
      model: azureModel,
      prompt: fullPrompt,
      n: 1,
      size: resolvedSize,
      response_format: "b64_json",
    };
    if (background === "transparent") {
      azureBody.background = "transparent";
    }
  }

  try {
    const endpoint = AZURE_OPENAI_ENDPOINT.replace(/\/$/, "").replace(/\/openai\/v1$/, "");
    const apiRes = await fetch(`${endpoint}/openai/deployments/${encodeURIComponent(azureModel)}/images/generations?api-version=2024-10-21`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify(azureBody),
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      const errMsg = errData.error?.message || errData.error || `Azure API returned ${apiRes.status}`;
      console.error("cast.js Azure error:", errMsg);
      return res.status(502).json({ error: `Image generation failed: ${errMsg}` });
    }

    const data = await apiRes.json();
    const imageData = data.data?.[0]?.b64_json;

    if (!imageData) {
      return res.status(502).json({ error: "No image data in Azure response" });
    }

    return res.status(200).json({
      image: imageData,
      model: azureModel,
      size: resolvedSize,
    });
  } catch (err) {
    console.error("cast.js error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error during image generation",
    });
  }
};

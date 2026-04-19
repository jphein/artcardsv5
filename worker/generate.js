import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { json, readJson } from "./cors.js";

// ---------------------------------------------------------------------------
// Shared: Dream Cast (Azure OpenAI image generation)
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

const ESSENCE_SUFFIXES = {
  "fairy-tale": ", fairy tale illustration style with storybook warmth and whimsical detail",
  "oil-painting": ", rich oil painting style with visible brushstrokes and classical depth",
  "anime": ", anime art style with clean lines, vibrant colors, and expressive design",
  "watercolor": ", soft watercolor style with translucent washes and organic bleeding edges",
  "dark-fantasy": ", dark fantasy art style with dramatic shadows and gothic atmosphere",
  "ethereal": ", ethereal luminous style with soft glowing light and otherworldly beauty",
  "mythological": ", mythological art style with epic grandeur and symbolic imagery",
};

function clampFluxSize(width, height) {
  const MAX = 1440;
  if (width > MAX || height > MAX) {
    const scale = MAX / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  width = Math.round(width / 32) * 32;
  height = Math.round(height / 32) * 32;
  width = Math.max(width, 256);
  height = Math.max(height, 256);
  return `${width}x${height}`;
}

function resolveSize(sizeStr, model) {
  const match = (sizeStr || "1024x1024").match(/^(\d+)x(\d+)$/);
  if (!match) return "1024x1024";
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (model === "flux-1.1-pro" || model === "FLUX-1.1-pro") return clampFluxSize(w, h);
  return `${w}x${h}`;
}

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

export async function handleCast(request, env, origin) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY } = env;
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    return json({ error: "Server misconfigured: missing Azure OpenAI credentials" }, 500, origin);
  }

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body" }, 400, origin);

  const {
    prompt,
    model = "flux-1.1-pro",
    size = "1024x1024",
    background,
    dreamType = "freeform",
    essences,
  } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return json({ error: "Missing required field: prompt" }, 400, origin);
  }

  const allowedModels = ["flux-1.1-pro", "FLUX-1.1-pro", "gpt-image-1.5"];
  if (!allowedModels.includes(model)) {
    return json(
      { error: "Invalid model. Allowed: flux-1.1-pro, gpt-image-1.5" },
      400,
      origin,
    );
  }

  const azureModel = model === "flux-1.1-pro" ? "FLUX-1.1-pro" : model;
  const resolvedSize = resolveSize(size, model);
  const fullPrompt = buildPrompt(prompt.trim(), dreamType, essences);
  const isFlux = azureModel === "FLUX-1.1-pro";

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
    if (background === "transparent") azureBody.background = "transparent";
  }

  const endpoint = AZURE_OPENAI_ENDPOINT.replace(/\/$/, "").replace(/\/openai\/v1$/, "");
  const apiRes = await fetch(
    `${endpoint}/openai/deployments/${encodeURIComponent(azureModel)}/images/generations?api-version=2024-10-21`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_API_KEY },
      body: JSON.stringify(azureBody),
    },
  );

  if (!apiRes.ok) {
    const errData = await apiRes.json().catch(() => ({}));
    const errMsg = errData.error?.message || errData.error || `Azure API returned ${apiRes.status}`;
    console.error("cast Azure error:", errMsg);
    return json({ error: `Image generation failed: ${errMsg}` }, 502, origin);
  }

  const data = await apiRes.json();
  const imageData = data.data?.[0]?.b64_json;
  if (!imageData) return json({ error: "No image data in Azure response" }, 502, origin);

  return json({ image: imageData, model: azureModel, size: resolvedSize }, 200, origin);
}

// ---------------------------------------------------------------------------
// Divine (AWS Bedrock Claude with SigV4)
// ---------------------------------------------------------------------------

const ORACLE_PROMPT = `You are a dream oracle. Given this AI-generated artwork born from a dream vision, divine its true name and meaning.

Return JSON only, no markdown fences:
{
  "name": "2-4 word poetic dream name",
  "description": "2-3 sentence symbolic interpretation connecting the imagery to dream archetypes and emotional resonance",
  "keywords": ["3-5 archetypal dream themes"]
}`;

async function signRequest(url, body, region, credentials) {
  const parsedUrl = new URL(url);
  const signer = new SignatureV4({
    service: "bedrock",
    region,
    credentials,
    sha256: Sha256,
  });
  return signer.sign({
    method: "POST",
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
    headers: { "Content-Type": "application/json", host: parsedUrl.hostname },
    body,
  });
}

export async function handleDivine(request, env, origin) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION = "us-west-2",
  } = env;

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return json({ error: "Server misconfigured: missing AWS credentials" }, 500, origin);
  }

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body" }, 400, origin);

  const { image } = body;
  if (!image || typeof image !== "string") {
    return json({ error: "Missing required field: image" }, 400, origin);
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
          { type: "image", source: { type: "base64", media_type: "image/png", data: image } },
          { type: "text", text: ORACLE_PROMPT },
        ],
      },
    ],
  });

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
    console.error("divine Bedrock error:", errMsg);
    return json({ error: `Card divination failed: ${errMsg}` }, 502, origin);
  }

  const data = await apiRes.json();
  const textContent = data.content?.find((c) => c.type === "text")?.text;
  if (!textContent) return json({ error: "No text response from Claude" }, 502, origin);

  let parsed;
  try {
    const jsonStr = textContent.replace(/^```json?\s*/m, "").replace(/```\s*$/m, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("divine parse error, raw response:", textContent);
    return json({ error: "Failed to parse oracle response as JSON" }, 502, origin);
  }

  const { name, description, keywords } = parsed;
  if (!name || !description || !Array.isArray(keywords)) {
    return json({ error: "Oracle response missing required fields" }, 502, origin);
  }

  return json({ name, description, keywords }, 200, origin);
}

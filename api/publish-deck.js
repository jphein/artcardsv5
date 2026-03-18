const TGC_BASE = "https://www.thegamecrafter.com/api";

// ---------------------------------------------------------------------------
// CORS helpers
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
// TGC API helpers
// ---------------------------------------------------------------------------

async function tgcPost(path, body) {
  const res = await fetch(`${TGC_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error || JSON.stringify(data);
    throw new Error(`TGC POST ${path} failed: ${msg}`);
  }
  return data.result;
}

async function tgcPut(path, body) {
  const res = await fetch(`${TGC_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error || JSON.stringify(data);
    throw new Error(`TGC PUT ${path} failed: ${msg}`);
  }
  return data.result;
}

// ---------------------------------------------------------------------------
// Download an image URL into a Buffer
// ---------------------------------------------------------------------------

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${url} (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Upload a file buffer to TGC as multipart/form-data
// ---------------------------------------------------------------------------

async function uploadFileToTGC(sessionId, fileName, buffer) {
  // Build multipart body manually to avoid needing a third-party library.
  const boundary = `----FormBoundary${Date.now().toString(36)}`;
  const CRLF = "\r\n";

  const fieldParts = [
    ["session_id", sessionId],
  ];

  let prefix = "";
  for (const [key, value] of fieldParts) {
    prefix +=
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}` +
      `${value}${CRLF}`;
  }

  const fileHeader =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
    `Content-Type: image/png${CRLF}${CRLF}`;

  const tail = `${CRLF}--${boundary}--${CRLF}`;

  const headerBuf = Buffer.from(prefix + fileHeader, "utf-8");
  const tailBuf = Buffer.from(tail, "utf-8");
  const body = Buffer.concat([headerBuf, buffer, tailBuf]);

  const res = await fetch(`${TGC_BASE}/file`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error || JSON.stringify(data);
    throw new Error(`TGC file upload failed: ${msg}`);
  }
  return data.result;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  const cors = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Set CORS on every response
  for (const [k, v] of Object.entries(cors)) {
    res.setHeader(k, v);
  }

  const { TGC_API_KEY, TGC_USERNAME, TGC_PASSWORD } = process.env;
  if (!TGC_API_KEY || !TGC_USERNAME || !TGC_PASSWORD) {
    return res.status(500).json({ error: "Server misconfigured: missing TGC credentials" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { name, cards, deckType, backImageUrl } = body || {};

  if (!name || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({
      error: "Request body must include name (string), cards (non-empty array of {url, name})",
    });
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Create a TGC session
    // -----------------------------------------------------------------------
    console.log("Creating TGC session...");
    const session = await tgcPost("/session", {
      api_key_id: TGC_API_KEY,
      username: TGC_USERNAME,
      password: TGC_PASSWORD,
    });
    const sessionId = session.id;
    console.log("Session created:", sessionId);

    // -----------------------------------------------------------------------
    // 2. Create a game
    // -----------------------------------------------------------------------
    console.log("Creating game:", name);
    const game = await tgcPost("/game", {
      session_id: sessionId,
      name,
      designer_id: session.user_id,
    });
    const gameId = game.id;
    console.log("Game created:", gameId);

    // -----------------------------------------------------------------------
    // 3. Upload the shared card-back image
    // -----------------------------------------------------------------------
    let backFileId;
    if (backImageUrl) {
      console.log("Uploading shared card back image...");
      const backBuffer = await downloadImage(backImageUrl);
      const backFile = await uploadFileToTGC(sessionId, "card-back.png", backBuffer);
      backFileId = backFile.id;
      console.log("Card back uploaded:", backFileId);
    }

    // -----------------------------------------------------------------------
    // 4. Create a square deck component in the game
    // -----------------------------------------------------------------------
    console.log("Creating square deck...");
    const deckPayload = {
      session_id: sessionId,
      name: deckType || "Main Deck",
      game_id: gameId,
    };
    if (backFileId) {
      deckPayload.back_id = backFileId;
    }
    const deck = await tgcPost("/squaredeck", deckPayload);
    const deckId = deck.id;
    console.log("Deck created:", deckId);

    // -----------------------------------------------------------------------
    // 5. For each card: download image, upload to TGC, create card entry
    // -----------------------------------------------------------------------
    const createdCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardName = card.name || `Card ${i + 1}`;
      console.log(`Processing card ${i + 1}/${cards.length}: ${cardName}`);

      // Download
      const imageBuffer = await downloadImage(card.url);

      // Upload
      const file = await uploadFileToTGC(
        sessionId,
        `${cardName.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`,
        imageBuffer
      );
      console.log(`  Uploaded file: ${file.id}`);

      // Create card in deck
      const squareCard = await tgcPost("/squarecard", {
        session_id: sessionId,
        name: cardName,
        deck_id: deckId,
        face_id: file.id,
        ...(backFileId ? { back_id: backFileId } : {}),
      });
      createdCards.push({ name: cardName, cardId: squareCard.id, fileId: file.id });
      console.log(`  Card created: ${squareCard.id}`);
    }

    // -----------------------------------------------------------------------
    // 6. Publish the game
    // -----------------------------------------------------------------------
    console.log("Publishing game...");
    const published = await tgcPut(`/game/${gameId}`, {
      session_id: sessionId,
      shop_status: "Published",
    });
    const slug = published.slug || published.name_slug || gameId;
    console.log("Game published. Slug:", slug);

    // -----------------------------------------------------------------------
    // 7. Return result
    // -----------------------------------------------------------------------
    return res.status(200).json({
      gameId,
      slug,
      shopUrl: `https://www.thegamecrafter.com/games/${slug}`,
      cardsCreated: createdCards.length,
      cards: createdCards,
    });
  } catch (err) {
    console.error("publish-deck error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error during deck publishing",
    });
  }
};

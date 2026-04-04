const TGC_BASE = "https://www.thegamecrafter.com/api";

// ---------------------------------------------------------------------------
// CORS helpers
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
// TGC API helpers
// ---------------------------------------------------------------------------

async function tgcGet(path) {
  const res = await fetch(`${TGC_BASE}${path}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error || JSON.stringify(data);
    throw new Error(`TGC GET ${path} failed: ${msg}`);
  }
  return data.result;
}

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

const TGC_SQUARE_SIZE = 1125;
const CLOUDINARY_CLOUD = "dqm00mcjs";

function resizeForTGC(url) {
  // Cloudinary native URLs: add transform inline
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)/);
  if (match) {
    return `${match[1]}c_pad,w_${TGC_SQUARE_SIZE},h_${TGC_SQUARE_SIZE},b_black/${match[2]}`;
  }
  // Non-Cloudinary URLs (InstantDB, etc.): proxy through Cloudinary fetch for resize
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/c_pad,w_${TGC_SQUARE_SIZE},h_${TGC_SQUARE_SIZE},b_black/${url}`;
}

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

async function uploadFileToTGC(sessionId, folderId, fileName, buffer) {
  const boundary = `----FormBoundary${Date.now().toString(36)}`;
  const CRLF = "\r\n";

  const fieldParts = [
    ["session_id", sessionId],
    ["folder_id", folderId],
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
      error: "Request body must include name (string), cards (non-empty array)",
    });
  }

  try {
    // 1. Create a TGC session
    const session = await tgcPost("/session", {
      api_key_id: TGC_API_KEY,
      username: TGC_USERNAME,
      password: TGC_PASSWORD,
    });
    const sessionId = session.id;

    // 2. Look up the user's default designer ID
    const user = await tgcGet(`/user/${session.user_id}?session_id=${encodeURIComponent(sessionId)}`);
    const designerId = user.default_designer_id;
    const folderId = user.root_folder_id;

    // 3. Create a game
    const game = await tgcPost("/game", {
      session_id: sessionId,
      name,
      designer_id: designerId,
    });
    const gameId = game.id;

    // 4. Upload the shared card-back image (optional)
    let backFileId;
    if (backImageUrl) {
      const backBuffer = await downloadImage(backImageUrl);
      const backFile = await uploadFileToTGC(sessionId, folderId, "card-back.png", backBuffer);
      backFileId = backFile.id;
    }

    // 5. Create a square deck component in the game
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

    // 6. For each card: download image, upload to TGC, create card entry
    // Accept both {cardName, imageUrl} (from client) and {name, url} formats
    const createdCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardName = card.cardName || card.name || `Card ${i + 1}`;
      const cardUrl = card.imageUrl || card.url;

      if (!cardUrl) {
        throw new Error(`Card "${cardName}" has no image URL`);
      }

      const imageBuffer = await downloadImage(resizeForTGC(cardUrl));

      const file = await uploadFileToTGC(
        sessionId,
        folderId,
        `${cardName.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`,
        imageBuffer
      );

      const squareCard = await tgcPost("/squarecard", {
        session_id: sessionId,
        name: cardName,
        deck_id: deckId,
        face_id: file.id,
        ...(backFileId ? { back_id: backFileId } : {}),
      });
      createdCards.push({ name: cardName, cardId: squareCard.id, fileId: file.id });
    }

    // 7. Publish the game
    const published = await tgcPut(`/game/${gameId}`, {
      session_id: sessionId,
      shop_status: "Published",
    });
    const slug = published.slug || published.name_slug || gameId;

    // 8. Return result
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

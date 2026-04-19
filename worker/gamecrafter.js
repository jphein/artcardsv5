import { json, readJson } from "./cors.js";

const TGC_BASE = "https://www.thegamecrafter.com/api";
const TGC_SQUARE_SIZE = 1125;
const CLOUDINARY_CLOUD = "dqm00mcjs";

const SQUARE_DECK_BASE = 5.99;
const SQUARE_CARD_COST = 0.18;

async function tgcFetch(method, path, body) {
  const res = await fetch(`${TGC_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error || JSON.stringify(data);
    throw new Error(`TGC ${method} ${path} failed: ${msg}`);
  }
  return data.result;
}

const tgcGet = (path) => tgcFetch("GET", path);
const tgcPost = (path, body) => tgcFetch("POST", path, body);
const tgcPut = (path, body) => tgcFetch("PUT", path, body);

function resizeForTGC(url) {
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)/);
  if (match) {
    return `${match[1]}c_pad,w_${TGC_SQUARE_SIZE},h_${TGC_SQUARE_SIZE},b_black/${match[2]}`;
  }
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/c_pad,w_${TGC_SQUARE_SIZE},h_${TGC_SQUARE_SIZE},b_black/${url}`;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadFileToTGC(sessionId, folderId, fileName, buffer) {
  const boundary = `----FormBoundary${Date.now().toString(36)}`;
  const CRLF = "\r\n";

  let prefix = "";
  for (const [key, value] of [
    ["session_id", sessionId],
    ["folder_id", folderId],
  ]) {
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

function requireMethod(request, method, origin) {
  if (request.method !== method) {
    return json({ error: "Method not allowed" }, 405, origin);
  }
  return null;
}

function requireTgcCreds(env, origin) {
  const { TGC_API_KEY, TGC_USERNAME, TGC_PASSWORD } = env;
  if (!TGC_API_KEY || !TGC_USERNAME || !TGC_PASSWORD) {
    return json({ error: "Server misconfigured: missing TGC credentials" }, 500, origin);
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/gamecrafter/publish
// ---------------------------------------------------------------------------

export async function handlePublish(request, env, origin) {
  const methodErr = requireMethod(request, "POST", origin);
  if (methodErr) return methodErr;
  const credsErr = requireTgcCreds(env, origin);
  if (credsErr) return credsErr;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body" }, 400, origin);

  const { name, cards, deckType, backImageUrl } = body;
  if (!name || !Array.isArray(cards) || cards.length === 0) {
    return json(
      { error: "Request body must include name (string), cards (non-empty array)" },
      400,
      origin,
    );
  }

  const session = await tgcPost("/session", {
    api_key_id: env.TGC_API_KEY,
    username: env.TGC_USERNAME,
    password: env.TGC_PASSWORD,
  });
  const sessionId = session.id;

  const user = await tgcGet(
    `/user/${session.user_id}?session_id=${encodeURIComponent(sessionId)}`,
  );
  const designerId = user.default_designer_id;
  const folderId = user.root_folder_id;

  const game = await tgcPost("/game", {
    session_id: sessionId,
    name,
    designer_id: designerId,
  });
  const gameId = game.id;

  let backFileId;
  if (backImageUrl) {
    const backBuffer = await downloadImage(backImageUrl);
    const backFile = await uploadFileToTGC(sessionId, folderId, "card-back.png", backBuffer);
    backFileId = backFile.id;
  }

  const deckPayload = {
    session_id: sessionId,
    name: deckType || "Main Deck",
    game_id: gameId,
  };
  if (backFileId) deckPayload.back_id = backFileId;
  const deck = await tgcPost("/squaredeck", deckPayload);
  const deckId = deck.id;

  const createdCards = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cardName = card.cardName || card.name || `Card ${i + 1}`;
    const cardUrl = card.imageUrl || card.url;
    if (!cardUrl) throw new Error(`Card "${cardName}" has no image URL`);

    const imageBuffer = await downloadImage(resizeForTGC(cardUrl));
    const file = await uploadFileToTGC(
      sessionId,
      folderId,
      `${cardName.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`,
      imageBuffer,
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

  const published = await tgcPut(`/game/${gameId}`, {
    session_id: sessionId,
    shop_status: "Published",
  });
  const slug = published.slug || published.name_slug || gameId;

  return json(
    {
      gameId,
      slug,
      shopUrl: `https://www.thegamecrafter.com/games/${slug}`,
      cardsCreated: createdCards.length,
      cards: createdCards,
    },
    200,
    origin,
  );
}

// ---------------------------------------------------------------------------
// POST /api/gamecrafter/status
// ---------------------------------------------------------------------------

export async function handleStatus(request, env, origin) {
  const methodErr = requireMethod(request, "POST", origin);
  if (methodErr) return methodErr;
  const credsErr = requireTgcCreds(env, origin);
  if (credsErr) return credsErr;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body" }, 400, origin);

  const { gameId } = body;
  if (!gameId) return json({ error: "Missing required field: gameId" }, 400, origin);

  const session = await tgcPost("/session", {
    api_key_id: env.TGC_API_KEY,
    username: env.TGC_USERNAME,
    password: env.TGC_PASSWORD,
  });
  const game = await tgcGet(
    `/game/${gameId}?session_id=${encodeURIComponent(session.id)}`,
  );

  return json(
    {
      gameId: game.id,
      name: game.name,
      slug: game.slug || game.name_slug,
      shopStatus: game.shop_status,
      shopUrl:
        game.shop_status === "Published"
          ? `https://www.thegamecrafter.com/games/${game.slug || game.name_slug || game.id}`
          : null,
      dateCreated: game.date_created,
      dateUpdated: game.date_updated,
    },
    200,
    origin,
  );
}

// ---------------------------------------------------------------------------
// POST /api/gamecrafter/price
// ---------------------------------------------------------------------------

export async function handlePrice(request, env, origin) {
  const methodErr = requireMethod(request, "POST", origin);
  if (methodErr) return methodErr;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body" }, 400, origin);

  const { cardCount, deckType } = body;
  if (!cardCount || cardCount < 1) {
    return json({ error: "cardCount must be a positive integer" }, 400, origin);
  }

  const estimated = SQUARE_DECK_BASE + cardCount * SQUARE_CARD_COST;

  return json(
    {
      deckType: deckType || "square",
      cardCount,
      estimatedPrice: `$${estimated.toFixed(2)}`,
      currency: "USD",
      note: "Estimate only. Final price set by The Game Crafter at checkout.",
    },
    200,
    origin,
  );
}

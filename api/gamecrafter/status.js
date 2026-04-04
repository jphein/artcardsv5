const TGC_BASE = "https://www.thegamecrafter.com/api";

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

  const { gameId } = body || {};
  if (!gameId) {
    return res.status(400).json({ error: "Missing required field: gameId" });
  }

  try {
    const sessionRes = await fetch(`${TGC_BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key_id: TGC_API_KEY,
        username: TGC_USERNAME,
        password: TGC_PASSWORD,
      }),
    });
    const sessionData = await sessionRes.json();
    if (!sessionRes.ok || sessionData.error) {
      throw new Error(sessionData.error?.message || "Session creation failed");
    }
    const sessionId = sessionData.result.id;

    const gameRes = await fetch(
      `${TGC_BASE}/game/${gameId}?session_id=${encodeURIComponent(sessionId)}`
    );
    const gameData = await gameRes.json();
    if (!gameRes.ok || gameData.error) {
      throw new Error(gameData.error?.message || "Failed to fetch game");
    }

    const game = gameData.result;
    return res.status(200).json({
      gameId: game.id,
      name: game.name,
      slug: game.slug || game.name_slug,
      shopStatus: game.shop_status,
      shopUrl: game.shop_status === "Published"
        ? `https://www.thegamecrafter.com/games/${game.slug || game.name_slug || game.id}`
        : null,
      dateCreated: game.date_created,
      dateUpdated: game.date_updated,
    });
  } catch (err) {
    console.error("publish-status error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error while fetching game status",
    });
  }
};

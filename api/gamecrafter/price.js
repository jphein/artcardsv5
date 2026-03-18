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

// TGC square deck pricing (approximate, based on public pricing page)
// Base price + per-card cost. These are estimates — TGC may adjust.
const SQUARE_DECK_BASE = 5.99;
const SQUARE_CARD_COST = 0.18;

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

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { cardCount, deckType } = body || {};
  if (!cardCount || cardCount < 1) {
    return res.status(400).json({ error: "cardCount must be a positive integer" });
  }

  const estimated = SQUARE_DECK_BASE + (cardCount * SQUARE_CARD_COST);

  return res.status(200).json({
    deckType: deckType || "square",
    cardCount,
    estimatedPrice: `$${estimated.toFixed(2)}`,
    currency: "USD",
    note: "Estimate only. Final price set by The Game Crafter at checkout.",
  });
};

const PROXY_BASE = process.env.REACT_APP_TGC_PROXY_URL || 'https://artcardsv5.vercel.app/api/gamecrafter';

function resolveImageUrl(card) {
  if (card.source === 'dreamscape' && card.imageUrl) {
    return card.imageUrl;
  }
  if (card.public_id && card.cloud_name) {
    return `https://res.cloudinary.com/${card.cloud_name}/image/upload/${card.public_id}`;
  }
  return card.imageUrl || null;
}

async function request(path, body) {
  try {
    const res = await fetch(`${PROXY_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: text || `Request failed with status ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

export async function publishDeck({ name, cards, deckType = 'square' }) {
  const resolvedCards = cards.map((card) => ({
    cardName: card.cardName || card.public_id || 'Untitled',
    imageUrl: resolveImageUrl(card),
  }));

  const invalid = resolvedCards.find((c) => !c.imageUrl);
  if (invalid) {
    return { error: `Card "${invalid.cardName}" has no resolvable image URL` };
  }

  return request('/publish', { name, cards: resolvedCards, deckType });
}

export async function getPublishStatus(gameId) {
  return request('/status', { gameId });
}

export async function getDeckPrice(cardCount, deckType = 'square') {
  return request('/price', { cardCount, deckType });
}

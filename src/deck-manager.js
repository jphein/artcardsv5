import React, { useState } from "react";
import { db, id } from "./db";
import "./deck-manager.css";

const DeckManager = ({ cards, spreadType, onLoadDeck, userId }) => {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deckName, setDeckName] = useState("");

  const query = userId
    ? {
        decks: {
          $: { where: { "owner.id": userId } },
          owner: {},
        },
      }
    : null;

  const { isLoading, error, data } = db.useQuery(query);

  const decks = data?.decks || [];

  const handleSave = async () => {
    if (!deckName.trim() || !userId) return;

    await db.transact([
      db.tx.decks[id()]
        .update({
          name: deckName.trim(),
          spreadType,
          cards,
          createdAt: Date.now(),
        })
        .link({ owner: userId }),
    ]);

    setDeckName("");
    setSaving(false);
  };

  const handleDelete = async (e, deckId) => {
    e.stopPropagation();
    await db.transact(db.tx.decks[deckId].delete());
  };

  const handleLoad = (deck) => {
    onLoadDeck(deck.cards, deck.spreadType);
  };

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!userId) {
    return (
      <div className="deck-manager deck-manager--signed-out">
        <span className="deck-manager__signin-msg">
          Sign in to save decks
        </span>
      </div>
    );
  }

  return (
    <div className={`deck-manager ${expanded ? "deck-manager--expanded" : ""}`}>
      <button
        className="deck-manager__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="deck-manager__header-icon">
          {expanded ? "\u25BE" : "\u25B8"}
        </span>
        Saved Decks
        {decks.length > 0 && (
          <span className="deck-manager__count">{decks.length}</span>
        )}
      </button>

      {expanded && (
        <div className="deck-manager__body">
          {/* Save current deck */}
          <div className="deck-manager__save-section">
            {!saving ? (
              <button
                className="deck-manager__save-btn"
                onClick={() => setSaving(true)}
                disabled={cards.length === 0}
              >
                Save Current Deck
              </button>
            ) : (
              <div className="deck-manager__save-form">
                <input
                  className="deck-manager__name-input"
                  type="text"
                  placeholder="Deck name..."
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") setSaving(false);
                  }}
                  autoFocus
                />
                <button
                  className="deck-manager__confirm-btn"
                  onClick={handleSave}
                  disabled={!deckName.trim()}
                >
                  Save
                </button>
                <button
                  className="deck-manager__cancel-btn"
                  onClick={() => {
                    setSaving(false);
                    setDeckName("");
                  }}
                >
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* Deck list */}
          <div className="deck-manager__list">
            {isLoading && (
              <div className="deck-manager__loading">Loading...</div>
            )}
            {error && (
              <div className="deck-manager__error">Failed to load decks</div>
            )}
            {!isLoading && !error && decks.length === 0 && (
              <div className="deck-manager__empty">No saved decks yet</div>
            )}
            {decks
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map((deck) => (
                <div
                  key={deck.id}
                  className="deck-manager__deck-item"
                  onClick={() => handleLoad(deck)}
                  title="Click to load this deck"
                >
                  <div className="deck-manager__deck-info">
                    <span className="deck-manager__deck-name">
                      {deck.name}
                    </span>
                    <span className="deck-manager__deck-meta">
                      {deck.cards ? deck.cards.length : 0} cards
                      {deck.createdAt && (
                        <> &middot; {formatDate(deck.createdAt)}</>
                      )}
                    </span>
                  </div>
                  <button
                    className="deck-manager__delete-btn"
                    onClick={(e) => handleDelete(e, deck.id)}
                    title="Delete deck"
                  >
                    &times;
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckManager;

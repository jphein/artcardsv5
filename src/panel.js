import React, { useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import SpreadView from "./spread-view";
import Lightbox from "./lightbox";
import SPREAD_LAYOUTS from "./spread-layouts";
import { useCurrentUser } from "./auth-button";
import { PhysicalCardsHint } from "./physical-cards";
import { db, id } from "./db";
import { publishDeck } from "./gamecrafter";
import "./panel.css";

const CLOUD_NAME = "dqm00mcjs";

const CardPanel = forwardRef(({ onNavigate, onCollect, onUncollect, onToggle, onDockDragStart, onDockDragEnd }, ref) => {
  const { user } = useCurrentUser();
  const userId = user ? user.id : null;
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [showSpread, setShowSpread] = useState(false);
  const [spreadType, setSpreadType] = useState("three");
  const [lightboxCard, setLightboxCard] = useState(null);
  const [lightboxLabel, setLightboxLabel] = useState(null);
  const [lightboxSublabel, setLightboxSublabel] = useState(null);
  const [decksExpanded, setDecksExpanded] = useState(false);
  const [savingDeck, setSavingDeck] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [dropTargetDeck, setDropTargetDeck] = useState(null);
  const [publishingDeckId, setPublishingDeckId] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Query saved decks from InstantDB
  const deckQuery = userId ? { decks: { $: { where: { userId } } } } : null;
  const { data: deckData } = db.useQuery(deckQuery);
  const decks = deckData?.decks || [];

  // Query dreamscape cards + files
  const { data: instantData } = db.useQuery({ cards: {}, $files: {} });
  const dreamscapeCards = instantData?.cards || [];
  const instantFiles = instantData?.$files || [];
  const fileUrlMap = {};
  instantFiles.forEach((f) => { fileUrlMap[f.path] = f.url; });

  // Build dreamscape card objects with resolved image URLs
  const resolvedDreamCards = dreamscapeCards
    .filter((card) => card.imagePath && fileUrlMap[card.imagePath])
    .map((card) => ({
      public_id: card.id,
      source: "dreamscape",
      imageUrl: fileUrlMap[card.imagePath],
      cardName: card.name,
      cardDescription: card.description,
    }));

  useImperativeHandle(ref, () => ({
    addCard(cardData) {
      if (cards.some((c) => c.public_id === cardData.public_id)) return;
      setCards((prev) => [...prev, cardData]);
      onCollect && onCollect(cardData.public_id);
      if (!open) {
        setOpen(true);
        onToggle && onToggle(true);
      }
    },
  }));

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (cards.some((c) => c.public_id === data.public_id)) return;
      setCards((prev) => [...prev, data]);
      onCollect && onCollect(data.public_id);
    } catch {
      return;
    }
    if (!open) {
      setOpen(true);
      onToggle && onToggle(true);
    }
  };

  const removeCard = (public_id) => {
    setCards((prev) => prev.filter((c) => c.public_id !== public_id));
    onUncollect && onUncollect(public_id);
  };

  const handleLoadDeck = useCallback((deckCards, deckSpreadType) => {
    setCards(deckCards);
    setSpreadType(deckSpreadType);
  }, []);

  const handleCardClick = (card) => {
    const layout = SPREAD_LAYOUTS[spreadType];
    const index = cards.indexOf(card);
    const position = layout && layout.positions[index];
    setLightboxCard(card);
    setLightboxLabel(position ? position.label : null);
    setLightboxSublabel(position ? position.sublabel : null);
  };

  // Deck operations
  const handleSaveDeck = async () => {
    if (!deckName.trim() || !userId) return;
    await db.transact(
      db.tx.decks[id()].update({
        name: deckName.trim(),
        spreadType,
        cards,
        userId,
        createdAt: Date.now(),
      })
    );
    setDeckName("");
    setSavingDeck(false);
  };

  const handleDeleteDeck = async (e, deckId) => {
    e.stopPropagation();
    await db.transact(db.tx.decks[deckId].delete());
  };

  const handleLoadSavedDeck = (deck) => {
    setCards(deck.cards || []);
    setSpreadType(deck.spreadType || "three");
  };

  const handlePublishDeck = async (e, deck) => {
    e.stopPropagation();
    setPublishingDeckId(deck.id);
    setPublishError(null);
    try {
      const result = await publishDeck(deck);
      await db.transact(db.tx.decks[deck.id].update({ tgcGameId: result.gameId, tgcShopUrl: result.shopUrl }));
    } catch (err) {
      setPublishError(deck.id);
      setTimeout(() => setPublishError(null), 3000);
    } finally {
      setPublishingDeckId(null);
    }
  };

  // Drop card onto a specific deck
  const handleDeckDrop = async (e, deck) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetDeck(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const existing = deck.cards || [];
      if (existing.some((c) => c.public_id === data.public_id)) return;
      await db.transact(
        db.tx.decks[deck.id].update({
          cards: [...existing, data],
        })
      );
    } catch {
      return;
    }
  };

  const renderCard = (card) => {
    const isDreamscape = card.source === "dreamscape";
    return (
      <div
        key={card.public_id}
        className={`card-panel__card${isDreamscape ? " card-panel__card--dreamscape" : ""}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(
            "application/json",
            JSON.stringify({ ...card, fromDock: true })
          );
          e.dataTransfer.effectAllowed = "move";
          onDockDragStart && onDockDragStart();
        }}
        onDragEnd={(e) => {
          onDockDragEnd && onDockDragEnd();
          if (e.dataTransfer.dropEffect === "move") {
            removeCard(card.public_id);
          }
        }}
        onClick={() => onNavigate && onNavigate(card.slideIndex)}
        title={isDreamscape ? card.cardName || "Dreamscape card" : "Click to focus"}
      >
        {isDreamscape ? (
          <img src={card.imageUrl} alt={card.cardName || "Dreamscape card"} />
        ) : (
          <AdvancedImage
            cldImg={new CloudinaryImage(card.public_id, { cloudName: card.cloud_name || CLOUD_NAME })}
            alt={card.public_id}
          />
        )}
        {isDreamscape && card.cardName && (
          <span className="card-panel__card-name">{card.cardName}</span>
        )}
        <button
          className="card-panel__remove"
          onClick={(e) => {
            e.stopPropagation();
            removeCard(card.public_id);
          }}
        >
          &times;
        </button>
      </div>
    );
  };

  const renderDeckPreview = (deckCards) => {
    const previews = (deckCards || []).slice(0, 4);
    return (
      <div className="card-panel__deck-thumbs">
        {previews.map((card, i) => (
          <div
            key={card.public_id || i}
            className="card-panel__deck-thumb"
            style={{ zIndex: previews.length - i }}
          >
            {card.source === "dreamscape" ? (
              <img src={card.imageUrl} alt="" />
            ) : (
              <AdvancedImage
                cldImg={new CloudinaryImage(card.public_id, { cloudName: card.cloud_name || CLOUD_NAME })}
                alt=""
              />
            )}
          </div>
        ))}
        {previews.length === 0 && (
          <div className="card-panel__deck-thumb card-panel__deck-thumb--empty" />
        )}
      </div>
    );
  };

  const artCards = cards.filter((c) => c.source !== "dreamscape");
  const dreamCards = cards.filter((c) => c.source === "dreamscape");
  const sortedDecks = [...decks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <>
      <div className={`card-panel ${open ? "card-panel--open" : ""}`}>
        <button
          className="card-panel__toggle"
          onClick={() => {
            const next = !open;
            setOpen(next);
            onToggle && onToggle(next);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              onToggle && onToggle(true);
            }
          }}
        >
          <span className="card-panel__toggle-arrow">
            {open ? "\u25BC" : "\u25B2"}
          </span>
          {" "}My Cards ({cards.length})
        </button>

        <div
          className={`card-panel__tray ${dragOver ? "card-panel__tray--dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {cards.length === 0 && !decksExpanded && resolvedDreamCards.length === 0 && (
            <div className="card-panel__empty">
              Drag cards here to collect them
            </div>
          )}

          {/* Art Cards Section */}
          {artCards.length > 0 && (
            <div className="card-panel__section card-panel__section--art">
              <div className="card-panel__section-header">
                <span className="card-panel__section-icon">{"\u2726"}</span>
                <span className="card-panel__section-title">Art Cards</span>
                <span className="card-panel__section-count">{artCards.length}</span>
              </div>
              <div className="card-panel__section-cards">
                {artCards.map(renderCard)}
              </div>
            </div>
          )}

          {/* Dreamscape Cards Section */}
          {dreamCards.length > 0 && (
            <div className="card-panel__section card-panel__section--dreamscape">
              <div className="card-panel__section-header">
                <span className="card-panel__section-icon">{"\u2728"}</span>
                <span className="card-panel__section-title">Dreamscape</span>
                <span className="card-panel__section-count">{dreamCards.length}</span>
              </div>
              <div className="card-panel__section-cards">
                {dreamCards.map(renderCard)}
              </div>
            </div>
          )}

          {/* View Spread */}
          {cards.length > 0 && (
            <div className="card-panel__actions">
              <button
                className="card-panel__spread-btn"
                onClick={() => setShowSpread(true)}
              >
                View Spread
              </button>
            </div>
          )}

          {/* ─── My Decks Section ─── */}
          <div className="card-panel__section card-panel__section--decks">
            <button
              className="card-panel__section-header card-panel__section-header--toggle"
              onClick={() => setDecksExpanded(!decksExpanded)}
            >
              <span className="card-panel__section-icon">{"\u2660"}</span>
              <span className="card-panel__section-title">My Decks</span>
              {decks.length > 0 && (
                <span className="card-panel__section-count">{decks.length}</span>
              )}
              <span className="card-panel__section-chevron">
                {decksExpanded ? "\u25BE" : "\u25B8"}
              </span>
            </button>

            {decksExpanded && (
              <div className="card-panel__decks-body">
                {!userId && (
                  <div className="card-panel__decks-signin">
                    Sign in to save &amp; load decks
                  </div>
                )}

                {userId && (
                  <>
                    {/* Save current hand as deck */}
                    <div className="card-panel__decks-save">
                      {!savingDeck ? (
                        <button
                          className="card-panel__decks-save-btn"
                          onClick={() => setSavingDeck(true)}
                          disabled={cards.length === 0}
                        >
                          {"\u2727"} Save Current Hand
                        </button>
                      ) : (
                        <div className="card-panel__decks-save-form">
                          <input
                            className="card-panel__decks-input"
                            type="text"
                            placeholder="Name your deck..."
                            value={deckName}
                            onChange={(e) => setDeckName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveDeck();
                              if (e.key === "Escape") setSavingDeck(false);
                            }}
                            autoFocus
                          />
                          <button
                            className="card-panel__decks-confirm"
                            onClick={handleSaveDeck}
                            disabled={!deckName.trim()}
                          >
                            Save
                          </button>
                          <button
                            className="card-panel__decks-cancel"
                            onClick={() => { setSavingDeck(false); setDeckName(""); }}
                          >
                            &times;
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Deck list */}
                    <div className="card-panel__decks-list">
                      {sortedDecks.length === 0 && (
                        <div className="card-panel__decks-empty">
                          No saved decks yet
                        </div>
                      )}
                      {sortedDecks.map((deck) => (
                        <div
                          key={deck.id}
                          className={`card-panel__deck-item${dropTargetDeck === deck.id ? " card-panel__deck-item--drop" : ""}`}
                          onClick={() => handleLoadSavedDeck(deck)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDropTargetDeck(deck.id);
                          }}
                          onDragLeave={() => setDropTargetDeck(null)}
                          onDrop={(e) => handleDeckDrop(e, deck)}
                          title="Click to load \u2022 Drag cards here to add"
                        >
                          {renderDeckPreview(deck.cards)}
                          <div className="card-panel__deck-info">
                            <span className="card-panel__deck-name">{deck.name}</span>
                            <span className="card-panel__deck-meta">
                              {deck.cards ? deck.cards.length : 0} cards
                              {deck.spreadType && <> &middot; {deck.spreadType}</>}
                            </span>
                          </div>
                          {deck.tgcShopUrl ? (
                            <a
                              className="card-panel__deck-buy"
                              href={deck.tgcShopUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Buy this deck on The Game Crafter"
                            >
                              Buy Deck
                            </a>
                          ) : (
                            <button
                              className={`card-panel__deck-publish${publishingDeckId === deck.id ? " card-panel__deck-publish--loading" : ""}`}
                              onClick={(e) => handlePublishDeck(e, deck)}
                              disabled={publishingDeckId === deck.id}
                              title="Publish to The Game Crafter"
                            >
                              {publishingDeckId === deck.id ? "Publishing\u2026" : "\u2726 Publish"}
                            </button>
                          )}
                          {publishError === deck.id && (
                            <span className="card-panel__deck-publish-error">Failed</span>
                          )}
                          <button
                            className="card-panel__deck-delete"
                            onClick={(e) => handleDeleteDeck(e, deck.id)}
                            title="Delete deck"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Auto-populated Dreamscape cards */}
                    {resolvedDreamCards.length > 0 && (
                      <div className="card-panel__decks-dreamscape">
                        <div className="card-panel__decks-dreamscape-header">
                          {"\u2728"} Dreamscape Collection
                        </div>
                        <div className="card-panel__decks-dreamscape-grid">
                          {resolvedDreamCards.map((card) => (
                            <div
                              key={card.public_id}
                              className="card-panel__deck-dream-card"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  "application/json",
                                  JSON.stringify({ ...card, fromCollection: true })
                                );
                                e.dataTransfer.effectAllowed = "copy";
                                onDockDragStart && onDockDragStart();
                              }}
                              onDragEnd={() => {
                                onDockDragEnd && onDockDragEnd();
                              }}
                              title={card.cardName || "Dreamscape card"}
                            >
                              <img src={card.imageUrl} alt={card.cardName || ""} />
                              {card.cardName && (
                                <span className="card-panel__deck-dream-name">{card.cardName}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <PhysicalCardsHint cardCount={cards.length} />
        </div>
      </div>

      {showSpread && (
        <SpreadView
          cards={cards}
          spreadType={spreadType}
          onClose={() => setShowSpread(false)}
          onCardClick={handleCardClick}
          onReorder={setCards}
          onSpreadChange={setSpreadType}
          onLoadDeck={handleLoadDeck}
          userId={userId}
          collectionCards={resolvedDreamCards}
          onAddCard={(cardData, atIndex) => {
            if (cards.some((c) => c.public_id === cardData.public_id)) return;
            if (typeof atIndex === "number" && atIndex >= 0) {
              setCards((prev) => {
                const next = [...prev];
                next.splice(atIndex, 0, cardData);
                return next;
              });
            } else {
              setCards((prev) => [...prev, cardData]);
            }
          }}
        />
      )}

      <Lightbox
        card={lightboxCard}
        label={lightboxLabel}
        sublabel={lightboxSublabel}
        onClose={() => setLightboxCard(null)}
      />
    </>
  );
});

CardPanel.displayName = "CardPanel";

export default CardPanel;

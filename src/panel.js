import React, { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
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

const cldImageCache = new Map();
function getCldImage(publicId, cloudName) {
  const key = `${cloudName || CLOUD_NAME}/${publicId}`;
  if (!cldImageCache.has(key)) {
    cldImageCache.set(key, new CloudinaryImage(publicId, { cloudName: cloudName || CLOUD_NAME }));
  }
  return cldImageCache.get(key);
}

const TABS = [
  { key: "hand", icon: "\u2726", label: "Hand" },
  { key: "decks", icon: "\u2660", label: "Decks" },
  { key: "spread", icon: "\u2727", label: "Spread" },
];

// ─── Memoized Sub-Components ───

const CardThumbnail = React.memo(({ card, isDreamscape, imgUrl, onDragStart, onDragEnd, onClick, onRemove }) => (
  <div
    className={`card-panel__card${isDreamscape ? " card-panel__card--dreamscape" : ""}`}
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onClick}
    title={isDreamscape ? card.cardName || "Dreamscape card" : "Click to focus"}
  >
    {isDreamscape ? (
      <img src={imgUrl} alt={card.cardName || "Dreamscape card"} />
    ) : (
      <AdvancedImage
        cldImg={getCldImage(card.public_id, card.cloud_name)}
        alt={card.public_id}
      />
    )}
    {isDreamscape && card.cardName && (
      <span className="card-panel__card-name">{card.cardName}</span>
    )}
    <button
      className="card-panel__remove"
      onClick={onRemove}
    >
      &times;
    </button>
  </div>
));
CardThumbnail.displayName = "CardThumbnail";

const DeckPreview = React.memo(({ deckCards, resolveCardUrl }) => {
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
            <img src={resolveCardUrl(card)} alt="" />
          ) : (
            <AdvancedImage
              cldImg={getCldImage(card.public_id, card.cloud_name)}
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
});
DeckPreview.displayName = "DeckPreview";

const DeckItem = React.memo(({ deck, isDropTarget, onLoad, onDragOver, onDragLeave, onDrop, onPublish, onDelete, publishingDeckId, publishError, resolveCardUrl }) => (
  <div
    className={`card-panel__deck-item${isDropTarget ? " card-panel__deck-item--drop" : ""}${deck.isDreambook ? " card-panel__deck-item--dreambook" : ""}`}
    onClick={onLoad}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    title={deck.isDreambook ? "Click to load your Dreambook journal" : "Click to load \u2022 Drag cards here to add"}
  >
    <DeckPreview deckCards={deck.cards} resolveCardUrl={resolveCardUrl} />
    <div className="card-panel__deck-info">
      <span className="card-panel__deck-name">
        {deck.isDreambook && <span className="card-panel__deck-dreambook-icon">{"\u263D"} </span>}
        {deck.name}
      </span>
      <span className="card-panel__deck-meta">
        {deck.cards ? deck.cards.length : 0} cards
        {deck.spreadType && <> &middot; {deck.spreadType}</>}
        {deck.isDreambook && <> &middot; auto</>}
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
        onClick={onPublish}
        disabled={publishingDeckId === deck.id}
        title="Publish to The Game Crafter"
      >
        {publishingDeckId === deck.id ? "Publishing\u2026" : "\u2726 Publish"}
      </button>
    )}
    {publishError && publishError.deckId === deck.id && (
      <span className="card-panel__deck-publish-error" title={publishError.message}>
        {publishError.message.length > 40 ? publishError.message.slice(0, 40) + "\u2026" : publishError.message}
      </span>
    )}
    {!deck.isDreambook && (
      <button
        className="card-panel__deck-delete"
        onClick={onDelete}
        title="Delete deck"
      >
        &times;
      </button>
    )}
  </div>
));
DeckItem.displayName = "DeckItem";

const DreamscapeCardItem = React.memo(({ card, onDragStart, onDragEnd }) => (
  <div
    className="card-panel__deck-dream-card"
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    title={card.cardName || "Dreamscape card"}
  >
    <img src={card.imageUrl} alt={card.cardName || ""} />
    {card.cardName && (
      <span className="card-panel__deck-dream-name">{card.cardName}</span>
    )}
  </div>
));
DreamscapeCardItem.displayName = "DreamscapeCardItem";

const CardPanel = forwardRef(({ onNavigate, onCollect, onUncollect, onToggle, onDockDragStart, onDockDragEnd, prefs, setPref }, ref) => {
  const { user } = useCurrentUser();
  const userId = user ? user.id : null;
  const [open, setOpen] = useState(prefs ? !!prefs.dockOpen : false);
  const [cards, setCards] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [showSpread, setShowSpread] = useState(false);
  const [spreadType, setSpreadType] = useState(prefs ? prefs.spreadType : "three");
  const [lightbox, setLightbox] = useState({ card: null, label: null, sublabel: null });
  const [activeTab, setActiveTab] = useState("hand");
  const [savingDeck, setSavingDeck] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [dropTargetDeck, setDropTargetDeck] = useState(null);
  const [publishingDeckId, setPublishingDeckId] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Query saved decks from InstantDB
  const deckQuery = userId ? { decks: { $: { where: { userId } } } } : null;
  const { data: deckData } = db.useQuery(deckQuery);
  const decks = deckData?.decks || [];

  // Query dreamscape cards + files + user creations
  const { data: instantData } = db.useQuery({ cards: {}, $files: {} });
  const creationsQuery = userId
    ? { creations: { $: { where: { userId } } } }
    : null;
  const { data: creationsData } = db.useQuery(creationsQuery);
  const userCreations = creationsData?.creations || [];
  const dreamscapeCards = instantData?.cards || [];
  const instantFiles = instantData?.$files || [];
  const fileUrlMap = useMemo(() => {
    const map = {};
    instantFiles.forEach((f) => { map[f.path] = f.url; });
    return map;
  }, [instantFiles]);

  // Build dreamscape card objects with resolved image URLs
  const resolvedDreamCards = useMemo(() =>
    dreamscapeCards
      .filter((card) => card.imagePath && fileUrlMap[card.imagePath])
      .map((card) => ({
        public_id: card.id,
        source: "dreamscape",
        imageUrl: fileUrlMap[card.imagePath],
        cardName: card.name,
        cardDescription: card.description,
      })),
    [dreamscapeCards, fileUrlMap]
  );

  // Sync Dreambook deck entity from user's journal creations
  const dreambookDeck = useMemo(() => decks.find((d) => d.isDreambook), [decks]);
  const lastSyncRef = useRef(null);
  useEffect(() => {
    if (!userId) return;
    const creationCards = userCreations
      .filter((c) => c.imagePath && fileUrlMap[c.imagePath])
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((c) => ({
        public_id: c.id,
        source: "dreamscape",
        imagePath: c.imagePath,
        cardName: c.cardName || "Unnamed Dream",
        cardDescription: c.cardDescription || "",
      }));
    const syncKey = creationCards.map((c) => c.public_id + ":" + c.cardName).join(",");
    if (lastSyncRef.current === syncKey) return;
    lastSyncRef.current = syncKey;
    if (creationCards.length === 0 && !dreambookDeck) return;
    if (dreambookDeck) {
      db.transact(db.tx.decks[dreambookDeck.id].update({ cards: creationCards }));
    } else if (creationCards.length > 0) {
      db.transact(db.tx.decks[id()].update({
        name: "Dreambook",
        spreadType: "freeform",
        cards: creationCards,
        userId,
        createdAt: Date.now(),
        isDreambook: true,
      }));
    }
  }, [userId, userCreations, fileUrlMap, dreambookDeck]);

  useImperativeHandle(ref, () => ({
    addCard(cardData) {
      if (cards.some((c) => c.public_id === cardData.public_id)) return;
      setCards((prev) => [...prev, cardData]);
      onCollect && onCollect(cardData.public_id);
      if (!open) {
        setOpen(true);
        onToggle && onToggle(true);
        if (setPref) setPref("dockOpen", true);
      }
      setActiveTab("hand");
    },
  }));

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
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
      if (setPref) setPref("dockOpen", true);
    }
    setActiveTab("hand");
  }, [cards, open, onCollect, onToggle, setPref]);

  const removeCard = useCallback((public_id) => {
    setCards((prev) => prev.filter((c) => c.public_id !== public_id));
    onUncollect && onUncollect(public_id);
  }, [onUncollect]);

  const handleLoadDeck = useCallback((deckCards, deckSpreadType) => {
    setCards(deckCards);
    setSpreadType(deckSpreadType);
    if (setPref) setPref("spreadType", deckSpreadType);
  }, [setPref]);

  const handleCardClick = useCallback((card) => {
    const layout = SPREAD_LAYOUTS[spreadType];
    const index = cards.indexOf(card);
    const position = layout && layout.positions[index];
    setLightbox({
      card,
      label: position ? position.label : null,
      sublabel: position ? position.sublabel : null,
    });
  }, [spreadType, cards]);

  // Deck operations
  const handleSaveDeck = useCallback(async () => {
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
  }, [deckName, userId, spreadType, cards]);

  const handleDeleteDeck = useCallback(async (e, deckId) => {
    e.stopPropagation();
    await db.transact(db.tx.decks[deckId].delete());
  }, []);

  const handleLoadSavedDeck = useCallback((deck) => {
    const resolved = (deck.cards || []).map((c) =>
      c.imagePath && fileUrlMap[c.imagePath] ? { ...c, imageUrl: fileUrlMap[c.imagePath] } : c
    );
    setCards(resolved);
    const st = deck.spreadType || "three";
    setSpreadType(st);
    if (setPref) setPref("spreadType", st);
    setActiveTab("hand");
  }, [fileUrlMap, setPref]);

  const handlePublishDeck = useCallback(async (e, deck) => {
    e.stopPropagation();
    setPublishingDeckId(deck.id);
    setPublishError(null);
    try {
      const resolvedDeck = {
        ...deck,
        cards: (deck.cards || []).map((c) =>
          c.imagePath && fileUrlMap[c.imagePath] ? { ...c, imageUrl: fileUrlMap[c.imagePath] } : c
        ),
      };
      const result = await publishDeck(resolvedDeck);
      if (result.error) {
        throw new Error(result.error);
      }
      await db.transact(db.tx.decks[deck.id].update({ tgcGameId: result.gameId, tgcShopUrl: result.shopUrl }));
    } catch (err) {
      const msg = err.message || "Unknown error";
      console.error("Publish deck failed:", msg, err);
      setPublishError({ deckId: deck.id, message: msg });
      setTimeout(() => setPublishError(null), 8000);
    } finally {
      setPublishingDeckId(null);
    }
  }, [fileUrlMap]);

  // Drop card onto a specific deck
  const handleDeckDrop = useCallback(async (e, deck) => {
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
  }, []);

  // Resolve card image URL — prefers fresh fileUrlMap for imagePath cards
  const resolveCardUrl = useCallback((card) => {
    if (card.imagePath && fileUrlMap[card.imagePath]) return fileUrlMap[card.imagePath];
    return card.imageUrl;
  }, [fileUrlMap]);

  const sortedDecks = useMemo(() =>
    [...decks].sort((a, b) => {
      if (a.isDreambook) return -1;
      if (b.isDreambook) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    }),
    [decks]
  );
  const currentLayout = SPREAD_LAYOUTS[spreadType];

  // ─── Stable callbacks for memoized sub-components ───

  const handleCardDragStart = useCallback((e, card, imgUrl) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ ...card, imageUrl: imgUrl, fromDock: true })
    );
    e.dataTransfer.effectAllowed = "move";
    onDockDragStart && onDockDragStart();
  }, [onDockDragStart]);

  const handleCardDragEnd = useCallback((e, publicId) => {
    onDockDragEnd && onDockDragEnd();
    if (e.dataTransfer.dropEffect === "move") {
      removeCard(publicId);
    }
  }, [onDockDragEnd, removeCard]);

  const handleCardNavigate = useCallback((slideIndex) => {
    onNavigate && onNavigate(slideIndex);
  }, [onNavigate]);

  const handleCardRemove = useCallback((e, publicId) => {
    e.stopPropagation();
    removeCard(publicId);
  }, [removeCard]);

  const handleDreamDragStart = useCallback((e, card) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ ...card, fromCollection: true })
    );
    e.dataTransfer.effectAllowed = "copy";
    onDockDragStart && onDockDragStart();
  }, [onDockDragStart]);

  const handleDreamDragEnd = useCallback(() => {
    onDockDragEnd && onDockDragEnd();
  }, [onDockDragEnd]);

  const handleDeckItemDragOver = useCallback((e, deckId) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetDeck(deckId);
  }, []);

  const handleDeckItemDragLeave = useCallback(() => {
    setDropTargetDeck(null);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox({ card: null, label: null, sublabel: null });
  }, []);

  const openSpread = useCallback(() => setShowSpread(true), []);
  const closeSpread = useCallback(() => setShowSpread(false), []);

  const handleSpreadChange = useCallback((st) => {
    setSpreadType(st);
    if (setPref) setPref("spreadType", st);
  }, [setPref]);

  const handleAddCard = useCallback((cardData, atIndex) => {
    setCards((prev) => {
      if (prev.some((c) => c.public_id === cardData.public_id)) return prev;
      if (typeof atIndex === "number" && atIndex >= 0) {
        const next = [...prev];
        next.splice(atIndex, 0, cardData);
        return next;
      }
      return [...prev, cardData];
    });
  }, []);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    onToggle && onToggle(next);
    if (setPref) setPref("dockOpen", next);
  }, [open, onToggle, setPref]);

  const handleToggleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!open) {
      setOpen(true);
      onToggle && onToggle(true);
      if (setPref) setPref("dockOpen", true);
    }
  }, [open, onToggle, setPref]);

  const handleSetSpreadType = useCallback((key) => {
    setSpreadType(key);
    if (setPref) setPref("spreadType", key);
  }, [setPref]);

  const cancelSaveDeck = useCallback(() => {
    setSavingDeck(false);
    setDeckName("");
  }, []);

  // ─── Memoized Tab Content ───

  const handTab = useMemo(() => (
    <div className="card-panel__tab-content card-panel__tab-content--hand">
      {cards.length === 0 ? (
        <div className="card-panel__empty">
          <div className="card-panel__empty-arrow">{"\u25B2"}</div>
          Drag cards here to collect them
        </div>
      ) : (
        <div className="card-panel__hand-scroll">
          {cards.map((card) => {
            const isDreamscape = card.source === "dreamscape";
            const imgUrl = resolveCardUrl(card);
            return (
              <CardThumbnail
                key={card.public_id}
                card={card}
                isDreamscape={isDreamscape}
                imgUrl={imgUrl}
                onDragStart={(e) => handleCardDragStart(e, card, imgUrl)}
                onDragEnd={(e) => handleCardDragEnd(e, card.public_id)}
                onClick={() => handleCardNavigate(card.slideIndex)}
                onRemove={(e) => handleCardRemove(e, card.public_id)}
              />
            );
          })}
        </div>
      )}
      <PhysicalCardsHint cardCount={cards.length} />
    </div>
  ), [cards, resolveCardUrl, handleCardDragStart, handleCardDragEnd, handleCardNavigate, handleCardRemove]);

  const decksTab = useMemo(() => (
    <div className="card-panel__tab-content card-panel__tab-content--decks">
      {!userId ? (
        <div className="card-panel__decks-signin">
          Sign in to save &amp; load decks
        </div>
      ) : (
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
                  onClick={cancelSaveDeck}
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
              <DeckItem
                key={deck.id}
                deck={deck}
                isDropTarget={dropTargetDeck === deck.id}
                onLoad={() => handleLoadSavedDeck(deck)}
                onDragOver={deck.isDreambook ? undefined : (e) => handleDeckItemDragOver(e, deck.id)}
                onDragLeave={deck.isDreambook ? undefined : handleDeckItemDragLeave}
                onDrop={deck.isDreambook ? undefined : (e) => handleDeckDrop(e, deck)}
                onPublish={(e) => handlePublishDeck(e, deck)}
                onDelete={(e) => handleDeleteDeck(e, deck.id)}
                publishingDeckId={publishingDeckId}
                publishError={publishError}
                resolveCardUrl={resolveCardUrl}
              />
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
                  <DreamscapeCardItem
                    key={card.public_id}
                    card={card}
                    onDragStart={(e) => handleDreamDragStart(e, card)}
                    onDragEnd={handleDreamDragEnd}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  ), [userId, savingDeck, deckName, cards.length, sortedDecks, dropTargetDeck,
      publishingDeckId, publishError, resolvedDreamCards, resolveCardUrl,
      handleSaveDeck, cancelSaveDeck, handleLoadSavedDeck, handleDeckItemDragOver,
      handleDeckItemDragLeave, handleDeckDrop, handlePublishDeck, handleDeleteDeck,
      handleDreamDragStart, handleDreamDragEnd]);

  const spreadTab = useMemo(() => (
    <div className="card-panel__tab-content card-panel__tab-content--spread">
      {/* Spread type selector as visual cards */}
      <div className="card-panel__spread-picker">
        {Object.entries(SPREAD_LAYOUTS).map(([key, layout]) => (
          <button
            key={key}
            className={`card-panel__spread-option${spreadType === key ? " card-panel__spread-option--active" : ""}`}
            onClick={() => handleSetSpreadType(key)}
          >
            <span className="card-panel__spread-option-name">{layout.name}</span>
            <span className="card-panel__spread-option-count">
              {layout.count === Infinity ? "\u221E" : layout.count} {layout.count === 1 ? "card" : "cards"}
            </span>
          </button>
        ))}
      </div>

      {/* Description of selected spread */}
      <div className="card-panel__spread-desc">
        <span className="card-panel__spread-desc-icon">{"\u2727"}</span>
        <span className="card-panel__spread-desc-text">{currentLayout.description}</span>
      </div>

      {/* Mini preview / status */}
      <div className="card-panel__spread-status">
        <span className="card-panel__spread-status-count">
          {cards.length} {cards.length === 1 ? "card" : "cards"} in hand
        </span>
        {currentLayout.count !== Infinity && cards.length < currentLayout.count && (
          <span className="card-panel__spread-status-hint">
            (need {currentLayout.count - cards.length} more)
          </span>
        )}
      </div>

      {/* Open Spread View button */}
      <button
        className="card-panel__spread-btn"
        onClick={openSpread}
        disabled={cards.length === 0}
      >
        Open Spread View
      </button>
    </div>
  ), [spreadType, currentLayout, cards.length, handleSetSpreadType, openSpread]);

  return (
    <>
      <div className={`card-panel ${open ? "card-panel--open" : ""}`}>
        <button
          className="card-panel__toggle"
          onClick={handleToggle}
          onDragOver={handleToggleDragOver}
        >
          <span className="card-panel__toggle-arrow">
            {open ? "\u25BC" : "\u25B2"}
          </span>
          {" "}My Cards ({cards.length})
        </button>

        {/* ─── Tab Bar ─── */}
        <div className="card-panel__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`card-panel__tab${activeTab === tab.key ? " card-panel__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="card-panel__tab-icon">{tab.icon}</span>
              <span className="card-panel__tab-label">{tab.label}</span>
              {tab.key === "hand" && cards.length > 0 && (
                <span className="card-panel__tab-badge">{cards.length}</span>
              )}
              {tab.key === "decks" && decks.length > 0 && (
                <span className="card-panel__tab-badge">{decks.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tray with tab content ─── */}
        <div
          className={`card-panel__tray ${dragOver ? "card-panel__tray--dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {activeTab === "hand" && handTab}
          {activeTab === "decks" && decksTab}
          {activeTab === "spread" && spreadTab}
        </div>
      </div>

      {showSpread && (
        <SpreadView
          cards={cards}
          spreadType={spreadType}
          onClose={closeSpread}
          onCardClick={handleCardClick}
          onReorder={setCards}
          onSpreadChange={handleSpreadChange}
          onLoadDeck={handleLoadDeck}
          userId={userId}
          collectionCards={resolvedDreamCards}
          onAddCard={handleAddCard}
        />
      )}

      {lightbox.card && (
        <Lightbox
          card={lightbox.card}
          label={lightbox.label}
          sublabel={lightbox.sublabel}
          onClose={closeLightbox}
        />
      )}
    </>
  );
});

CardPanel.displayName = "CardPanel";

export default CardPanel;

import React, { useState, forwardRef, useImperativeHandle } from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import SpreadView from "./spread-view";
import Lightbox from "./lightbox";
import SPREAD_LAYOUTS from "./spread-layouts";
import { useCurrentUser } from "./auth-button";
import { PhysicalCardsHint } from "./physical-cards";
import "./panel.css";

const CardPanel = forwardRef(({ onNavigate, onCollect, onUncollect, onToggle, onDockDragStart, onDockDragEnd }, ref) => {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [showSpread, setShowSpread] = useState(false);
  const [spreadType, setSpreadType] = useState("three");
  const [lightboxCard, setLightboxCard] = useState(null);
  const [lightboxLabel, setLightboxLabel] = useState(null);
  const [lightboxSublabel, setLightboxSublabel] = useState(null);

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

  const handleLoadDeck = (deckCards, deckSpreadType) => {
    setCards(deckCards);
    setSpreadType(deckSpreadType);
  };

  const handleCardClick = (card) => {
    const layout = SPREAD_LAYOUTS[spreadType];
    const index = cards.indexOf(card);
    const position = layout && layout.positions[index];
    setLightboxCard(card);
    setLightboxLabel(position ? position.label : null);
    setLightboxSublabel(position ? position.sublabel : null);
  };

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
          {cards.length === 0 && (
            <div className="card-panel__empty">
              Drag cards here to collect them
            </div>
          )}
          {cards.map((card) => {
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
                title={isDreamscape ? card.cardName || "Dreamscape card" : "Drag back to table, or click to focus"}
              >
                {isDreamscape ? (
                  <img src={card.imageUrl} alt={card.cardName || "Dreamscape card"} />
                ) : (
                  <AdvancedImage
                    cldImg={new CloudinaryImage(card.public_id, { cloudName: card.cloud_name })}
                    alt={card.public_id}
                  />
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
          })}
          {cards.length > 0 && (
            <button
              className="card-panel__spread-btn"
              onClick={() => setShowSpread(true)}
            >
              View Spread
            </button>
          )}
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
          userId={user ? user.id : null}
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

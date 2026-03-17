import React, { useState } from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import "./panel.css";

const MAX_CARDS = Infinity;

const CardPanel = ({ onNavigate, onToggle }) => {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState([]);
  const [dragOver, setDragOver] = useState(false);

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

    if (cards.length >= MAX_CARDS) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      // Avoid duplicates
      if (cards.some((c) => c.public_id === data.public_id)) return;
      setCards((prev) => [...prev, data]);
    } catch {
      // ignore invalid drops
    }

    // Auto-open the panel when a card is dropped
    if (!open) {
      setOpen(true);
      onToggle && onToggle(true);
    }
  };

  const removeCard = (public_id) => {
    setCards((prev) => prev.filter((c) => c.public_id !== public_id));
  };

  return (
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
            Drag cards here (up to {MAX_CARDS})
          </div>
        )}
        {cards.map((card) => {
          const cldImg = new CloudinaryImage(card.public_id, {
            cloudName: card.cloud_name
          });
          return (
            <div
              key={card.public_id}
              className="card-panel__card"
              onClick={() => onNavigate && onNavigate(card.slideIndex)}
              title="Click to spin carousel to this card"
            >
              <AdvancedImage cldImg={cldImg} alt={card.public_id} />
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
      </div>
    </div>
  );
};

export default CardPanel;

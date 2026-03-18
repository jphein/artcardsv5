import React, { useState, useCallback, useEffect, useRef } from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import SPREAD_LAYOUTS from "./spread-layouts";
import "./spread-view.css";

const SPREAD_TYPES = Object.entries(SPREAD_LAYOUTS).map(([key, val]) => ({
  key,
  label: val.name,
  count: val.count,
}));

const SpreadView = ({
  cards,
  spreadType,
  onClose,
  onCardClick,
  onReorder,
  onSpreadChange,
}) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dealingCards, setDealingCards] = useState(new Set());
  const [dealtCards, setDealtCards] = useState(new Set());
  const [flashType, setFlashType] = useState(null);
  const prevSpreadType = useRef(spreadType);

  const spreadConfig = SPREAD_TYPES.find((s) => s.key === spreadType) || SPREAD_TYPES[0];
  const maxActive = spreadConfig.count;
  const activeCards = cards.slice(0, maxActive);
  const remainingCards = maxActive < Infinity ? cards.slice(maxActive) : [];

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e, dropIndex) => {
      e.preventDefault();
      setDragOverIndex(null);

      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        return;
      }

      const reordered = [...cards];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dropIndex, 0, moved);

      setDragIndex(null);
      onReorder && onReorder(reordered);
    },
    [cards, dragIndex, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // Trigger dealing animation on mount and when spread type changes
  useEffect(() => {
    const indices = new Set(activeCards.map((_, i) => i));
    setDealingCards(indices);
    setDealtCards(new Set());

    // Flash the type button on change
    if (prevSpreadType.current !== spreadType) {
      setFlashType(spreadType);
      prevSpreadType.current = spreadType;
    }

    // Stagger: transition each card from dealing → dealt
    const timers = activeCards.map((_, i) => {
      const dealTime = i * 150 + 700; // wait for deal anim (700ms) + stagger
      return setTimeout(() => {
        setDealingCards((prev) => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
        setDealtCards((prev) => new Set(prev).add(i));
      }, dealTime);
    });

    // Clear flash after animation
    const flashTimer = setTimeout(() => setFlashType(null), 400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(flashTimer);
    };
  }, [spreadType, activeCards.length]);

  const layout = SPREAD_LAYOUTS[spreadType];
  const isFreeform = spreadType === "freeform";

  const renderCard = (card, index, isActive) => {
    const cldImg = new CloudinaryImage(card.public_id, {
      cloudName: card.cloud_name,
    });

    const isDragging = dragIndex === index;
    const isDragOver = dragOverIndex === index;
    const isDealing = isActive && dealingCards.has(index);
    const isDealt = isActive && dealtCards.has(index);
    const position = isActive && !isFreeform && layout ? layout.positions[index] : null;

    const isPositioned = !!position;

    // Build wrapper style for positioned (non-freeform) active cards
    const wrapperStyle = isPositioned
      ? {
          transform: `translate(calc(-50% + ${position.offsetX}%), calc(-50% + ${position.offsetY}%)) rotate(${position.rotation}deg) scale(${position.scale})`,
          transitionDelay: `${index * 150}ms`,
          animationDelay: isDealing ? `${index * 150}ms` : undefined,
        }
      : undefined;

    return (
      <div
        key={card.public_id}
        className={`spread-view__card-wrapper${
          isPositioned ? " spread-view__card-wrapper--positioned" : ""
        }`}
        style={wrapperStyle}
      >
        <div
          className={`spread-view__card ${
            isActive ? "spread-view__card--active" : "spread-view__card--remaining"
          } ${isDragging ? "spread-view__card--dragging" : ""} ${
            isDragOver ? "spread-view__card--dragover" : ""
          } ${isDealing ? "spread-view__card--dealing" : ""} ${
            isDealt ? "spread-view__card--dealt" : ""
          }`}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          onClick={() => onCardClick && onCardClick(card)}
        >
          <AdvancedImage cldImg={cldImg} alt={card.public_id} />
          {isActive && (
            <span className="spread-view__card-number">{index + 1}</span>
          )}
        </div>
        {position && (
          <div className="spread-view__card-label">{position.label}</div>
        )}
      </div>
    );
  };

  return (
    <div className="spread-view">
      <div className="spread-view__backdrop" onClick={onClose} />

      <div className="spread-view__content">
        {/* Close Button */}
        <button className="spread-view__close" onClick={onClose}>
          &times;
        </button>

        {/* Spread Type Selector */}
        <div className="spread-view__selector">
          {SPREAD_TYPES.map((type) => (
            <button
              key={type.key}
              className={`spread-view__type-btn ${
                spreadType === type.key ? "spread-view__type-btn--active" : ""
              } ${flashType === type.key ? "spread-view__type-btn--flash" : ""}`}
              onClick={() => onSpreadChange && onSpreadChange(type.key)}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Spread Description */}
        {layout && (
          <div className="spread-view__description">
            {layout.description}
          </div>
        )}

        {/* Active Cards */}
        <div className={`spread-view__cards ${
          isFreeform ? "spread-view__cards--freeform" : "spread-view__cards--positioned"
        }`}>
          {activeCards.map((card, i) => renderCard(card, i, true))}
          {activeCards.length === 0 && (
            <div className="spread-view__empty">
              No cards in this spread yet.
            </div>
          )}
        </div>

        {/* Remaining Cards */}
        {remainingCards.length > 0 && (
          <>
            <div className="spread-view__separator">
              <span className="spread-view__separator-label">
                Remaining Cards
              </span>
            </div>
            <div className="spread-view__remaining">
              {remainingCards.map((card, i) =>
                renderCard(card, activeCards.length + i, false)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SpreadView;

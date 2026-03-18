import React, { useState, useCallback, useEffect, useRef } from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import SPREAD_LAYOUTS from "./spread-layouts";
import DeckManager from "./deck-manager";
import CardBack from "./card-back";
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
  onLoadDeck,
  userId,
  collectionCards,
  onAddCard,
}) => {
  const [dealingCards, setDealingCards] = useState(new Set());
  const [dealtCards, setDealtCards] = useState(new Set());
  const [flashType, setFlashType] = useState(null);
  const [flippedIds, setFlippedIds] = useState(new Set());
  const [scaleMap, setScaleMap] = useState({});
  const [zMap, setZMap] = useState({});
  const [positionOverrides, setPositionOverrides] = useState({});
  const [rotationMap, setRotationMap] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef({ active: false, publicId: null, offsetX: 0, offsetY: 0, el: null });

  const prevSpreadType = useRef(spreadType);
  const cardsContainerRef = useRef(null);
  const zCounterRef = useRef(100);
  const draggingIdRef = useRef(null);

  draggingIdRef.current = draggingId;

  const spreadConfig = SPREAD_TYPES.find((s) => s.key === spreadType) || SPREAD_TYPES[0];
  const maxActive = spreadConfig.count;
  const activeCards = cards.slice(0, maxActive);
  const remainingCards = maxActive < Infinity ? cards.slice(maxActive) : [];

  const bringToFront = useCallback((publicId) => {
    const nextZ = zCounterRef.current + 1;
    zCounterRef.current = nextZ;
    setZMap((prev) => ({ ...prev, [publicId]: nextZ }));
  }, []);

  // Free-drag via pointer events — DOM-direct for zero-lag movement
  const handlePointerDown = useCallback((e, publicId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    bringToFront(publicId);
    const el = e.currentTarget;
    const cardRect = el.getBoundingClientRect();
    dragRef.current = {
      active: false,
      publicId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - cardRect.left,
      offsetY: e.clientY - cardRect.top,
      el,
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d.el) return;

      if (!d.active) {
        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;
        if (dx * dx + dy * dy < 64) return;
        d.active = true;
        d.el.style.position = "fixed";
        d.el.style.zIndex = "9999";
        d.el.style.transition = "none";
        d.el.style.pointerEvents = "none";
        const currentTransform = d.el.style.transform.replace(/translate\([^)]*\)\s*/g, "");
        d.el.dataset.dragTransform = currentTransform;
        draggingIdRef.current = publicId;
        setDraggingId(publicId);
      }

      const fx = ev.clientX - d.offsetX;
      const fy = ev.clientY - d.offsetY;
      d.el.style.left = `${fx}px`;
      d.el.style.top = `${fy}px`;
      d.el.style.transform = d.el.dataset.dragTransform || "";
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;

      if (d.active && d.el && cardsContainerRef.current) {
        const rect = cardsContainerRef.current.getBoundingClientRect();
        const cardW = d.el.offsetWidth;
        const cardH = d.el.offsetHeight;
        const elLeft = parseFloat(d.el.style.left);
        const elTop = parseFloat(d.el.style.top);
        const cx = elLeft + cardW / 2 - rect.left;
        const cy = elTop + cardH / 2 - rect.top;

        d.el.style.position = "";
        d.el.style.zIndex = "";
        d.el.style.transition = "";
        d.el.style.left = "";
        d.el.style.top = "";
        d.el.style.transform = "";
        d.el.style.pointerEvents = "";
        delete d.el.dataset.dragTransform;

        setPositionOverrides((prev) => ({
          ...prev,
          [publicId]: { x: cx, y: cy },
        }));
      }

      dragRef.current = { active: false, publicId: null, offsetX: 0, offsetY: 0, el: null };
      draggingIdRef.current = null;
      setDraggingId(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [bringToFront]);

  // Double-click to flip
  const handleDoubleClick = useCallback((e, publicId) => {
    e.stopPropagation();
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
    bringToFront(publicId);
  }, [bringToFront]);

  // Non-passive wheel for scaling
  useEffect(() => {
    const container = cardsContainerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      const cardEl = e.target.closest(".spread-view__card-wrapper");
      if (!cardEl) return;
      e.preventDefault();
      const publicId = cardEl.dataset.publicId;
      if (!publicId) return;

      if (e.shiftKey) {
        const rotDelta = e.deltaY < 0 ? -5 : 5;
        setRotationMap((prev) => ({
          ...prev,
          [publicId]: (prev[publicId] || 0) + rotDelta,
        }));
      } else {
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setScaleMap((prev) => {
          const current = prev[publicId] || 1;
          const next = Math.min(2.5, Math.max(0.3, current + delta));
          return { ...prev, [publicId]: next };
        });
      }
      bringToFront(publicId);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [bringToFront]);

  // 3D tilt effect on hover
  useEffect(() => {
    const container = cardsContainerRef.current;
    if (!container) return;
    let activeCard = null;

    const onMove = (e) => {
      const cardEl = e.target.closest(".spread-view__card-wrapper");
      if (cardEl !== activeCard) {
        if (activeCard) {
          activeCard.style.removeProperty("--tilt-x");
          activeCard.style.removeProperty("--tilt-y");
          activeCard.style.removeProperty("--light-x");
          activeCard.style.removeProperty("--light-y");
        }
        activeCard = cardEl;
      }
      if (!cardEl) return;
      const rect = cardEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      cardEl.style.setProperty("--tilt-x", `${(0.5 - y) * 18}deg`);
      cardEl.style.setProperty("--tilt-y", `${(x - 0.5) * 18}deg`);
      cardEl.style.setProperty("--light-x", `${x * 100}%`);
      cardEl.style.setProperty("--light-y", `${y * 100}%`);
    };

    const onLeave = (e) => {
      const cardEl = e.target.closest(".spread-view__card-wrapper");
      if (cardEl) {
        cardEl.style.removeProperty("--tilt-x");
        cardEl.style.removeProperty("--tilt-y");
        cardEl.style.removeProperty("--light-x");
        cardEl.style.removeProperty("--light-y");
      }
      if (activeCard === cardEl) activeCard = null;
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave, true);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave, true);
    };
  }, []);

  // Reset overrides when spread type changes
  useEffect(() => {
    setPositionOverrides({});
    setScaleMap({});
    setRotationMap({});
    setFlippedIds(new Set());
  }, [spreadType]);

  // Dealing animation
  useEffect(() => {
    const indices = new Set(activeCards.map((_, i) => i));
    setDealingCards(indices);
    setDealtCards(new Set());

    if (prevSpreadType.current !== spreadType) {
      setFlashType(spreadType);
      prevSpreadType.current = spreadType;
    }

    const timers = activeCards.map((_, i) => {
      const dealTime = i * 150 + 700;
      return setTimeout(() => {
        setDealingCards((prev) => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
        setDealtCards((prev) => new Set(prev).add(i));
      }, dealTime);
    });

    const flashTimer = setTimeout(() => setFlashType(null), 400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(flashTimer);
    };
  }, [spreadType, activeCards.length]);

  const layout = SPREAD_LAYOUTS[spreadType];
  const isFreeform = spreadType === "freeform";

  const renderCard = (card, index, isActive) => {
    const isDreamscape = card.source === "dreamscape";
    const isDragging = draggingId === card.public_id;
    const isDealing = isActive && dealingCards.has(index);
    const isDealt = isActive && dealtCards.has(index);
    const isFlipped = flippedIds.has(card.public_id);
    const position = isActive && !isFreeform && layout ? layout.positions[index] : null;
    const isPositioned = !!position;
    const userScale = scaleMap[card.public_id] || 1;
    const userRotation = rotationMap[card.public_id] || 0;
    const zIndex = zMap[card.public_id] || (index + 1);
    const posOverride = positionOverrides[card.public_id];

    // Build wrapper style
    let wrapperStyle;
    if (posOverride) {
      wrapperStyle = {
        position: "absolute",
        left: `${posOverride.x}px`,
        top: `${posOverride.y}px`,
        transform: `rotate(${userRotation}deg) scale(${userScale})`,
        zIndex,
        transition: isDragging ? "none" : "transform 0.3s ease",
      };
    } else if (isPositioned) {
      const totalRotation = position.rotation + userRotation;
      wrapperStyle = {
        transform: `translate(calc(-50% + ${position.offsetX}%), calc(-50% + ${position.offsetY}%)) rotate(${totalRotation}deg) scale(${position.scale * userScale})`,
        transitionDelay: `${index * 150}ms`,
        animationDelay: isDealing ? `${index * 150}ms` : undefined,
        zIndex,
      };
    } else {
      wrapperStyle = {
        transform: `rotate(${userRotation}deg) scale(${userScale})`,
        zIndex,
      };
    }

    const wrapperClasses = [
      "spread-view__card-wrapper",
      isPositioned && !posOverride ? "spread-view__card-wrapper--positioned" : "",
    ].filter(Boolean).join(" ");

    const cardClasses = [
      "spread-view__card",
      isActive ? "spread-view__card--active" : "spread-view__card--remaining",
      isDragging ? "spread-view__card--dragging" : "",
      isDealing ? "spread-view__card--dealing" : "",
      isDealt ? "spread-view__card--dealt" : "",
      isFlipped ? "spread-view__card--flipped" : "",
    ].filter(Boolean).join(" ");

    return (
      <div
        key={card.public_id}
        className={wrapperClasses}
        data-public-id={card.public_id}
        style={wrapperStyle}
        onPointerDown={(e) => handlePointerDown(e, card.public_id)}
        onDoubleClick={(e) => handleDoubleClick(e, card.public_id)}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className={cardClasses}>
          <div className="spread-view__card-inner">
            <div className="spread-view__card-face spread-view__card-face--front">
              {isDreamscape ? (
                <img src={card.imageUrl} alt={card.cardName || "Dreamscape card"} />
              ) : (
                <AdvancedImage
                  cldImg={new CloudinaryImage(card.public_id, { cloudName: card.cloud_name })}
                  alt={card.public_id}
                />
              )}
              {isActive && (
                <span className="spread-view__card-number">{index + 1}</span>
              )}
            </div>
            <div className="spread-view__card-face spread-view__card-face--back">
              <CardBack width={isActive ? 200 : 80} />
            </div>
          </div>
        </div>
        {position && !isFlipped && (
          <div className="spread-view__card-label">{position.label}</div>
        )}
      </div>
    );
  };

  return (
    <div className="spread-view">
      <div className="spread-view__backdrop" onClick={onClose} />

      <div className="spread-view__content">
        <button className="spread-view__close" onClick={onClose}>
          &times;
        </button>

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

        {layout && (
          <div className="spread-view__description">
            {layout.description}
          </div>
        )}

        <div
          ref={cardsContainerRef}
          className={`spread-view__cards ${
            isFreeform ? "spread-view__cards--freeform" : "spread-view__cards--positioned"
          }`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData("application/json"));
              if (data.fromCollection && onAddCard) {
                onAddCard(data);
              }
            } catch {}
          }}
        >
          {activeCards.map((card, i) => renderCard(card, i, true))}
          {activeCards.length === 0 && (
            <div className="spread-view__empty">
              No cards in this spread yet.
            </div>
          )}
        </div>

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

        <DeckManager
          cards={cards}
          spreadType={spreadType}
          onLoadDeck={onLoadDeck}
          userId={userId}
        />

        {collectionCards && collectionCards.length > 0 && (
          <>
            <div className="spread-view__separator">
              <span className="spread-view__separator-label">
                Dreamscape Collection
              </span>
            </div>
            <div className="spread-view__collection">
              {collectionCards
                .filter(cc => !cards.some(c => c.public_id === cc.public_id))
                .map((card) => (
                  <div
                    key={card.public_id}
                    className="spread-view__collection-card"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ ...card, fromCollection: true }));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title={card.cardName || "Dreamscape card"}
                  >
                    <img src={card.imageUrl} alt={card.cardName || ""} />
                    {card.cardName && <span className="spread-view__collection-name">{card.cardName}</span>}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SpreadView;

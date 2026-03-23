import React, { useState, useCallback, useEffect, useRef } from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";

import SPREAD_LAYOUTS from "./spread-layouts";
import DeckManager from "./deck-manager";
import CardBack from "./card-back";
import "./spread-view.css";

// Approximate card wrapper dimensions for layout-based collision math
const CARD_EL_W = 200;
const CARD_EL_H = 310;

// Compute slot center offsets (px from container center) from layout positions
function slotCenter(pos) {
  return {
    x: pos.offsetX * CARD_EL_W / 100,
    y: pos.offsetY * CARD_EL_H / 100,
  };
}

// Find closest slot to a drop position, excluding the source slot
function findClosestSlot(layout, activeCards, draggedIndex, delta) {
  const dragPos = layout.positions[draggedIndex];
  const src = slotCenter(dragPos);
  const dropX = src.x + delta.x;
  const dropY = src.y + delta.y;

  let closestIndex = -1;
  let closestDist = Infinity;

  layout.positions.forEach((pos, i) => {
    if (i === draggedIndex || i >= activeCards.length) return;
    const c = slotCenter(pos);
    const dist = Math.hypot(dropX - c.x, dropY - c.y);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
  });

  // Only match if within reasonable range (half the card width)
  return closestDist < CARD_EL_W ? closestIndex : -1;
}

const SPREAD_TYPES = Object.entries(SPREAD_LAYOUTS).map(([key, val]) => ({
  key,
  label: val.name,
  count: val.count,
}));

// ─── Draggable card wrapper ───
const DraggableCard = ({ id, children, style: externalStyle, className, onPointerDownCapture, ...rest }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  // Compose @dnd-kit drag transform with any existing CSS transform
  const dragTranslate = transform ? `translate(${transform.x}px, ${transform.y}px) ` : "";
  const baseTransform = externalStyle?.transform || "";

  const style = {
    ...externalStyle,
    transform: dragTranslate + baseTransform || undefined,
    zIndex: isDragging ? 9999 : externalStyle?.zIndex,
    cursor: isDragging ? "grabbing" : "grab",
    transition: isDragging ? "none" : externalStyle?.transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
      {...rest}
    >
      {children}
    </div>
  );
};

// ─── Droppable position slot ───
const DroppableSlot = ({ id, children, style, className, highlighted }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const showHighlight = highlighted || isOver;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className || ""}${showHighlight ? " spread-view__slot--over" : ""}`}
    >
      {children}
    </div>
  );
};

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
  const [activeDragId, setActiveDragId] = useState(null);
  const [suppressTransition, setSuppressTransition] = useState(false);
  const [hoverSlotIndex, setHoverSlotIndex] = useState(-1);

  const prevSpreadType = useRef(spreadType);
  const cardsContainerRef = useRef(null);
  const zCounterRef = useRef(100);

  const spreadConfig = SPREAD_TYPES.find((s) => s.key === spreadType) || SPREAD_TYPES[0];
  const maxActive = spreadConfig.count;
  const activeCards = cards.slice(0, maxActive);
  const remainingCards = maxActive < Infinity ? cards.slice(maxActive) : [];

  const layout = SPREAD_LAYOUTS[spreadType];
  const isFreeform = spreadType === "freeform";

  // ─── @dnd-kit sensors ───
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const bringToFront = useCallback((publicId) => {
    const nextZ = zCounterRef.current + 1;
    zCounterRef.current = nextZ;
    setZMap((prev) => ({ ...prev, [publicId]: nextZ }));
  }, []);

  // ─── @dnd-kit handlers ───
  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
    setHoverSlotIndex(-1);
    bringToFront(event.active.id);
  }, [bringToFront]);

  const handleDragMove = useCallback((event) => {
    if (isFreeform || !layout) { setHoverSlotIndex(-1); return; }
    const { active, delta } = event;
    const draggedIndex = activeCards.findIndex((c) => c.public_id === active.id);
    if (draggedIndex < 0) { setHoverSlotIndex(-1); return; }
    setHoverSlotIndex(findClosestSlot(layout, activeCards, draggedIndex, delta));
  }, [isFreeform, layout, activeCards]);

  const handleDragEnd = useCallback((event) => {
    const { active, delta } = event;
    setActiveDragId(null);
    setHoverSlotIndex(-1);

    if (!active) return;

    const draggedId = active.id;

    // Freeform: update position from drag delta
    if (isFreeform) {
      setPositionOverrides((prev) => {
        const existing = prev[draggedId] || { x: 0, y: 0 };
        return {
          ...prev,
          [draggedId]: {
            x: existing.x + delta.x,
            y: existing.y + delta.y,
          },
        };
      });
      return;
    }

    // Positioned spread: compute swap target from delta + layout positions
    // (bypasses @dnd-kit collision detection which gets confused by nested
    //  draggable-inside-droppable with CSS transforms)
    if (!layout || !onReorder) return;

    const draggedIndex = activeCards.findIndex((c) => c.public_id === draggedId);
    if (draggedIndex < 0) return;

    const targetIndex = findClosestSlot(layout, activeCards, draggedIndex, delta);

    if (targetIndex >= 0) {
      setSuppressTransition(true);
      const newCards = [...cards];
      const temp = newCards[draggedIndex];
      newCards[draggedIndex] = newCards[targetIndex];
      newCards[targetIndex] = temp;
      onReorder(newCards);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSuppressTransition(false);
        });
      });
    }
  }, [isFreeform, activeCards, cards, layout, onReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setHoverSlotIndex(-1);
  }, []);

  // ─── Double-click to flip ───
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

  // ─── Non-passive wheel for scaling/rotation ───
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

  // ─── 3D tilt effect on hover ───
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

  // ─── Reset overrides when spread type changes ───
  useEffect(() => {
    setPositionOverrides({});
    setScaleMap({});
    setRotationMap({});
    setFlippedIds(new Set());
  }, [spreadType]);

  // ─── Dealing animation ───
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

  // ─── Render card content ───
  const renderCardContent = (card, index, isActive) => {
    const isDreamscape = card.source === "dreamscape";
    const isDealing = isActive && dealingCards.has(index);
    const isDealt = isActive && dealtCards.has(index);
    const isFlipped = flippedIds.has(card.public_id);
    const position = isActive && !isFreeform && layout ? layout.positions[index] : null;

    const cardClasses = [
      "spread-view__card",
      isActive ? "spread-view__card--active" : "spread-view__card--remaining",
      isDealing ? "spread-view__card--dealing" : "",
      isDealt ? "spread-view__card--dealt" : "",
      isFlipped ? "spread-view__card--flipped" : "",
    ].filter(Boolean).join(" ");

    return (
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
        {position && !isFlipped && (
          <div className="spread-view__card-label">{position.label}</div>
        )}
      </div>
    );
  };

  const renderActiveCard = (card, index) => {
    const isDragging = activeDragId === card.public_id;
    const isDealing = dealingCards.has(index);
    const position = !isFreeform && layout ? layout.positions[index] : null;
    const isPositioned = !!position;
    const userScale = scaleMap[card.public_id] || 1;
    const userRotation = rotationMap[card.public_id] || 0;
    const zIndex = zMap[card.public_id] || (index + 1);
    const posOverride = positionOverrides[card.public_id];

    let wrapperStyle;
    if (posOverride) {
      // Freeform drag offset — translate from flow position, not absolute
      wrapperStyle = {
        transform: `translate(${posOverride.x}px, ${posOverride.y}px) rotate(${userRotation}deg) scale(${userScale})`,
        zIndex,
      };
    } else if (isPositioned) {
      const totalRotation = position.rotation + userRotation;
      wrapperStyle = {
        transform: `translate(calc(-50% + ${position.offsetX}%), calc(-50% + ${position.offsetY}%)) rotate(${totalRotation}deg) scale(${position.scale * userScale})`,
        transitionDelay: `${index * 150}ms`,
        animationDelay: isDealing ? `${index * 150}ms` : undefined,
        zIndex,
        ...(suppressTransition && { transition: "none" }),
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

    // For positioned spreads, wrap in a droppable slot for reorder
    if (isPositioned && !posOverride) {
      return (
        <DroppableSlot
          key={card.public_id}
          id={`slot-${index}`}
          style={wrapperStyle}
          className={wrapperClasses}
          highlighted={hoverSlotIndex === index}
        >
          <DraggableCard
            id={card.public_id}
            className="spread-view__card-draggable"
            data-public-id={card.public_id}
            onDoubleClick={(e) => handleDoubleClick(e, card.public_id)}
          >
            {renderCardContent(card, index, true)}
          </DraggableCard>
        </DroppableSlot>
      );
    }

    return (
      <DraggableCard
        key={card.public_id}
        id={card.public_id}
        style={wrapperStyle}
        className={wrapperClasses}
        data-public-id={card.public_id}
        onDoubleClick={(e) => handleDoubleClick(e, card.public_id)}
      >
        {renderCardContent(card, index, true)}
      </DraggableCard>
    );
  };

  const renderRemainingCard = (card, index) => {
    const globalIndex = activeCards.length + index;
    return (
      <div
        key={card.public_id}
        className="spread-view__card-wrapper"
        data-public-id={card.public_id}
      >
        {renderCardContent(card, globalIndex, false)}
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
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
            {activeCards.map((card, i) => renderActiveCard(card, i))}
            {/* Empty position slots for drops when spread has room */}
            {!isFreeform && layout && activeCards.length < maxActive && (
              Array.from({ length: maxActive - activeCards.length }, (_, i) => {
                const slotIndex = activeCards.length + i;
                const pos = layout.positions[slotIndex];
                if (!pos) return null;
                return (
                  <DroppableSlot
                    key={`empty-${slotIndex}`}
                    id={`slot-${slotIndex}`}
                    className="spread-view__empty-slot"
                    style={{
                      transform: `translate(calc(-50% + ${pos.offsetX}%), calc(-50% + ${pos.offsetY}%)) rotate(${pos.rotation}deg) scale(${pos.scale})`,
                    }}
                  >
                    <span className="spread-view__empty-slot-label">{pos.label}</span>
                    <span className="spread-view__empty-slot-hint">drop card</span>
                  </DroppableSlot>
                );
              })
            )}
            {activeCards.length === 0 && !layout && (
              <div className="spread-view__empty">
                No cards in this spread yet.
              </div>
            )}
          </div>

        </DndContext>

        {remainingCards.length > 0 && (
          <>
            <div className="spread-view__separator">
              <span className="spread-view__separator-label">
                Remaining Cards
              </span>
            </div>
            <div className="spread-view__remaining">
              {remainingCards.map((card, i) => renderRemainingCard(card, i))}
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
                    onClick={() => onAddCard && onAddCard(card)}
                    title={(card.cardName || "Dreamscape card") + " — click or drag to add"}
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

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { CloudinaryImage } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import { db } from "./db";
import CardBack from "./card-back";
import "./card-table.css";

const CLOUD_NAME = "dqm00mcjs";
const TAG = "carousel";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeScatter(count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const rangeX = 75;
    const rangeY = 75;
    const offsetX = 10;
    const offsetY = 10;

    const rawX = (Math.random() + Math.random() + Math.random()) / 3;
    const rawY = (Math.random() + Math.random() + Math.random()) / 3;

    const x = offsetX + rawX * rangeX;
    const y = offsetY + rawY * rangeY;
    const rotation = -15 + Math.random() * 30;
    const scale = 0.85 + Math.random() * 0.2;

    positions.push({ x, y, rotation, scale });
  }
  return positions;
}

function computeSpiral(count) {
  const positions = [];
  const goldenAngle = 137.508 * (Math.PI / 180);
  const centerX = 50;
  const centerY = 48;
  const maxRadius = 38;
  const sqrtTotal = Math.sqrt(count);

  for (let i = 0; i < count; i++) {
    const angle = i * goldenAngle;
    const radius = (Math.sqrt(i) / sqrtTotal) * maxRadius;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    const rotation = (angle * 180 / Math.PI) % 360 - 180;
    const scale = 1.05 - (i / count) * 0.35;
    positions.push({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)), rotation: rotation * 0.15, scale });
  }
  return positions;
}

function computeArc(count) {
  const positions = [];
  const arcDegrees = 140;
  const startAngle = -(arcDegrees / 2);
  const centerX = 50;
  const centerY = 110;
  const radius = 65;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angleDeg = startAngle + t * arcDegrees;
    const angleRad = angleDeg * (Math.PI / 180);
    const x = centerX + radius * Math.sin(angleRad);
    const y = centerY - radius * Math.cos(angleRad);
    const rotation = angleDeg * 0.4;
    const distFromCenter = Math.abs(t - 0.5) * 2;
    const scale = 1.0 - distFromCenter * 0.15;
    positions.push({ x: Math.max(2, Math.min(98, x)), y: Math.max(5, Math.min(85, y)), rotation, scale });
  }
  return positions;
}

const MODES = [
  { key: "chaos", label: "Chaos", icon: "\u2726", compute: computeScatter },
  { key: "vortex", label: "Vortex", icon: "\u25CE", compute: computeSpiral },
  { key: "oracle", label: "Oracle", icon: "\u2312", compute: computeArc },
];

const CardTable = forwardRef((props, ref) => {
  const [images, setImages] = useState(null);
  const [positions, setPositions] = useState([]);
  const [dealt, setDealt] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState("chaos");
  const [draggingIndex, setDraggingIndex] = useState(null);
  const dragRef = useRef({ active: false, index: null, offsetX: 0, offsetY: 0, fixedX: 0, fixedY: 0, el: null });
  const [collectedIds, setCollectedIds] = useState(new Set());
  const [flippedIds, setFlippedIds] = useState(new Set());
  const [zMap, setZMap] = useState({});
  const [scaleMap, setScaleMap] = useState({});
  const tableRef = useRef(null);
  const focusTimerRef = useRef(null);
  const dealTimerRef = useRef(null);
  const zCounterRef = useRef(1);
  const draggingIndexRef = useRef(null);
  const imagesRef = useRef(null);

  // Fetch Dreamscape cards + file URLs from InstantDB (live subscription)
  const { data: instantData } = db.useQuery({ cards: {}, $files: {} });
  const dreamscapeCards = instantData?.cards || [];
  const instantFiles = instantData?.$files || [];

  // Build path → signed URL map from $files
  const fileUrlMap = {};
  instantFiles.forEach((f) => { fileUrlMap[f.path] = f.url; });

  // Fetch Cloudinary images on mount, merge with Dreamscape cards
  useEffect(() => {
    let cancelled = false;
    async function fetchImages() {
      const response = await fetch(
        `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${TAG}.json`
      );
      const data = await response.json();
      const cloudinary = data.resources.map((img) => ({
        ...img,
        source: "cloudinary",
      }));
      // Dreamscape cards: look up fresh signed URL via imagePath
      const dreamscape = dreamscapeCards
        .filter((card) => card.imagePath && fileUrlMap[card.imagePath])
        .map((card) => ({
          public_id: card.id,
          source: "dreamscape",
          imageUrl: fileUrlMap[card.imagePath],
          cardName: card.name,
          cardDescription: card.description,
          cardKeywords: card.keywords,
        }));
      const merged = shuffle([...cloudinary, ...dreamscape]);
      if (!cancelled) {
        setImages(merged);
      }
    }
    fetchImages();
    return () => {
      cancelled = true;
    };
  }, [dreamscapeCards.length, instantFiles.length]);

  // Initialize z-counter when images load
  useEffect(() => {
    if (images) {
      zCounterRef.current = images.length + 1;
    }
  }, [images]);

  // Helper to bring a card to the front
  const bringToFront = useCallback((publicId) => {
    const nextZ = zCounterRef.current + 1;
    zCounterRef.current = nextZ;
    setZMap((prev) => ({ ...prev, [publicId]: nextZ }));
  }, []);

  // Compute positions when images load, mode changes, or window resizes
  const recomputePositions = useCallback(() => {
    if (images) {
      const modeConfig = MODES.find(m => m.key === mode) || MODES[0];
      setPositions(modeConfig.compute(images.length));
    }
  }, [images, mode]);

  useEffect(() => {
    recomputePositions();
  }, [recomputePositions]);

  useEffect(() => {
    window.addEventListener("resize", recomputePositions);
    return () => window.removeEventListener("resize", recomputePositions);
  }, [recomputePositions]);

  // Start dealing when user taps the deck
  const startDealing = useCallback(() => {
    if (!images || dealt) return;
    setDealt(true);
    setDealing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }, [images, dealt]);

  // Dealing animation timer
  useEffect(() => {
    if (images && images.length > 0 && dealing) {
      const totalDelay = 30 * images.length + 500;
      dealTimerRef.current = setTimeout(() => {
        setDealing(false);
      }, totalDelay);
      return () => clearTimeout(dealTimerRef.current);
    }
  }, [images, dealing]);

  // Shuffle: gather cards to center, re-shuffle images, then re-scatter
  const [shuffling, setShuffling] = useState(false);
  const handleShuffle = useCallback(() => {
    if (!images || shuffling) return;
    setShuffling(true);
    setPositions(images.map(() => ({ x: 50, y: 50, rotation: 0, scale: 0.6 })));
    setScaleMap({});
    setTimeout(() => {
      setImages(shuffle([...images]));
      setDealing(true);
      setShuffling(false);
    }, 800);
  }, [images, shuffling]);

  // Keep refs in sync for use in pointer event handlers
  draggingIndexRef.current = draggingIndex;
  imagesRef.current = images;

  // Free-drag cards on the table — uses refs + direct DOM for zero-lag movement
  const handlePointerDown = useCallback((e, index, publicId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    bringToFront(publicId);
    const el = e.currentTarget;
    const cardRect = el.getBoundingClientRect();
    // Store cursor offset from card's top-left corner
    dragRef.current = {
      active: false,
      index,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - cardRect.left,
      offsetY: e.clientY - cardRect.top,
      fixedX: cardRect.left,
      fixedY: cardRect.top,
      el,
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d.el) return;

      if (!d.active) {
        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;
        if (dx * dx + dy * dy < 64) return; // 8px threshold
        d.active = true;
        d.el.style.position = "fixed";
        d.el.style.zIndex = "1200";
        d.el.style.transition = "none";
        d.el.style.pointerEvents = "none";
        // Keep rotation/scale but drop the translate(-50%,-50%) since fixed uses direct pixel coords
        const currentTransform = d.el.style.transform.replace(/translate\([^)]*\)\s*/g, "");
        d.el.dataset.dragTransform = currentTransform;
        draggingIndexRef.current = index;
        setDraggingIndex(index);
      }

      d.fixedX = ev.clientX - d.offsetX;
      d.fixedY = ev.clientY - d.offsetY;
      d.el.style.left = `${d.fixedX}px`;
      d.el.style.top = `${d.fixedY}px`;
      d.el.style.transform = d.el.dataset.dragTransform || "";

      // Peek the dock open when cursor is near the bottom
      const dockEl = document.querySelector(".card-panel");
      if (dockEl) {
        const nearBottom = ev.clientY > window.innerHeight - 150;
        dockEl.classList.toggle("card-panel--peek", nearBottom);
      }
    };

    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Remove dock peek
      const dockEl = document.querySelector(".card-panel");
      if (dockEl) dockEl.classList.remove("card-panel--peek");
      const d = dragRef.current;

      if (d.active && d.el && tableRef.current) {
        // Convert final fixed position back to percentage for state
        const rect = tableRef.current.getBoundingClientRect();
        const cardW = d.el.offsetWidth;
        const cardH = d.el.offsetHeight;
        const centerX = d.fixedX + cardW / 2;
        const centerY = d.fixedY + cardH / 2;
        const pctX = ((centerX - rect.left) / rect.width) * 100;
        const pctY = ((centerY - rect.top) / rect.height) * 100;

        // Reset inline styles so React takes over again
        d.el.style.position = "";
        d.el.style.zIndex = "";
        d.el.style.transition = "";
        d.el.style.left = "";
        d.el.style.top = "";
        d.el.style.transform = "";
        d.el.style.pointerEvents = "";
        delete d.el.dataset.dragTransform;

        setPositions(prev => {
          const next = [...prev];
          next[index] = { ...next[index], x: pctX, y: pctY };
          return next;
        });

        // Check dock drop
        const imgs = imagesRef.current;
        if (imgs && props.onCardToDock) {
          const dockEl = document.querySelector(".card-panel__tray");
          if (dockEl) {
            const dockRect = dockEl.getBoundingClientRect();
            if (
              ev.clientX >= dockRect.left && ev.clientX <= dockRect.right &&
              ev.clientY >= dockRect.top && ev.clientY <= dockRect.bottom
            ) {
              const img = imgs[index];
              if (img) {
                const cardData = img.source === "dreamscape"
                  ? { public_id: img.public_id, imageUrl: img.imageUrl, cardName: img.cardName, cardDescription: img.cardDescription, source: "dreamscape", slideIndex: index }
                  : { public_id: img.public_id, cloud_name: CLOUD_NAME, slideIndex: index };
                props.onCardToDock(cardData);
              }
            }
          }
        }
      }

      dragRef.current = { active: false, index: null, offsetX: 0, offsetY: 0, fixedX: 0, fixedY: 0, el: null };
      draggingIndexRef.current = null;
      setDraggingIndex(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [bringToFront, props.onCardToDock]);

  // Drop-from-dock: only enable table as drop target when a dock drag is active
  // The `dockDragging` prop is set by the parent when a card is being dragged from the dock
  const handleDropZoneDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDropZoneDrop = useCallback((e) => {
    e.preventDefault();
    if (!tableRef.current) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));

      const rect = tableRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const idx = images.findIndex(img => img.public_id === data.public_id);

      if (data.fromDock) {
        // Returning card from dock to table
        if (idx === -1) return;
        setPositions(prev => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = { ...next[idx], x, y };
          }
          return next;
        });
        setCollectedIds(prev => {
          const next = new Set(prev);
          next.delete(data.public_id);
          return next;
        });
        bringToFront(data.public_id);
      } else if (data.fromCollection) {
        // Dragging from Dreamscape collection — card is already on table, just reposition + highlight
        if (idx === -1) return;
        setPositions(prev => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = { ...next[idx], x, y };
          }
          return next;
        });
        bringToFront(data.public_id);
        // Brief focus highlight
        setFocusedIndex(idx);
        setTimeout(() => setFocusedIndex(null), 1500);
      }
    } catch {
      // ignore
    }
  }, [images, bringToFront]);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    focusCard(slideIndex) {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
      setFocusedIndex(slideIndex);
      focusTimerRef.current = setTimeout(() => {
        setFocusedIndex(null);
        focusTimerRef.current = null;
      }, 1500);
    },
    setState(update) {
      if (update && typeof update.flash !== "undefined") {
        setFlash(update.flash);
      }
    },
    collectCard(publicId) {
      setCollectedIds(prev => new Set(prev).add(publicId));
    },
    uncollectCard(publicId) {
      setCollectedIds(prev => {
        const next = new Set(prev);
        next.delete(publicId);
        return next;
      });
    },
  }));

  // Non-passive wheel listener: scroll = scale, Shift+scroll = rotate
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const onWheel = (e) => {
      let cardEl = e.target.closest(".card-table__card");
      if (!cardEl) return;

      e.preventDefault();

      const publicId = cardEl.dataset.publicId;
      if (!publicId) return;

      if (e.shiftKey) {
        // Shift+scroll = rotate
        const rotDelta = e.deltaY < 0 ? -5 : 5;
        const imgs = imagesRef.current;
        if (!imgs) return;
        const idx = imgs.findIndex(img => img.public_id === publicId);
        if (idx === -1) return;
        setPositions((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = { ...next[idx], rotation: (next[idx].rotation || 0) + rotDelta };
          }
          return next;
        });
      } else {
        // Normal scroll = scale
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setScaleMap((prev) => {
          const current = prev[publicId] || 1;
          const next = Math.min(2.0, Math.max(0.5, current + delta));
          return { ...prev, [publicId]: next };
        });
      }
      bringToFront(publicId);
    };

    table.addEventListener("wheel", onWheel, { passive: false });
    return () => table.removeEventListener("wheel", onWheel);
  }, [bringToFront]);

  // 3D tilt effect — sets CSS custom properties on hover for GPU-accelerated transforms
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let activeCard = null;

    const onMove = (e) => {
      const cardEl = e.target.closest(".card-table__card");
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
      cardEl.style.setProperty("--tilt-x", `${(0.5 - y) * 15}deg`);
      cardEl.style.setProperty("--tilt-y", `${(x - 0.5) * 15}deg`);
      cardEl.style.setProperty("--light-x", `${x * 100}%`);
      cardEl.style.setProperty("--light-y", `${y * 100}%`);
    };

    const onLeave = (e) => {
      const cardEl = e.target.closest(".card-table__card");
      if (cardEl) {
        cardEl.style.removeProperty("--tilt-x");
        cardEl.style.removeProperty("--tilt-y");
        cardEl.style.removeProperty("--light-x");
        cardEl.style.removeProperty("--light-y");
      }
      if (activeCard === cardEl) activeCard = null;
    };

    table.addEventListener("mousemove", onMove);
    table.addEventListener("mouseleave", onLeave, true);
    return () => {
      table.removeEventListener("mousemove", onMove);
      table.removeEventListener("mouseleave", onLeave, true);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    };
  }, []);

  if (!images) return null;

  // Before dealing: show deck pile
  if (!dealt) {
    return (
      <div className="card-table" ref={tableRef}>
        <div className={`card-table__flash${flash ? " card-table__flash--active" : ""}`} />
        <div className="card-table__deck-pile" onClick={startDealing}>
          <div className="card-table__deck-stack">
            {[...Array(Math.min(6, images.length))].map((_, i) => (
              <div
                key={i}
                className="card-table__deck-card"
                style={{
                  transform: `translate(-50%, -50%) rotate(${(i - 2.5) * 2.5}deg)`,
                  top: `${50 - i * 1.5}%`,
                  left: "50%",
                  zIndex: i,
                }}
              >
                <CardBack width={160} />
              </div>
            ))}
          </div>
          <div className="card-table__deck-label">
            <span className="card-table__deck-label-icon">{"\u2726"}</span>
            <span className="card-table__deck-label-text">Tap to Deal</span>
            <span className="card-table__deck-label-count">{images.length} cards</span>
          </div>
        </div>
      </div>
    );
  }

  if (positions.length === 0) return null;

  return (
    <div
      className="card-table"
      ref={tableRef}
    >
      <div
        className={`card-table__flash${
          flash ? " card-table__flash--active" : ""
        }`}
      />
      {props.dockDragging && (
        <div
          className="card-table__drop-zone"
          onDragOver={handleDropZoneDragOver}
          onDrop={handleDropZoneDrop}
        />
      )}
      {/* Mode Switcher */}
      <div className="card-table__mode-switcher">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`card-table__mode-btn ${mode === m.key ? "card-table__mode-btn--active" : ""}`}
            onClick={() => setMode(m.key)}
            title={m.label}
          >
            <span className="card-table__mode-icon">{m.icon}</span>
            <span className="card-table__mode-label">{m.label}</span>
          </button>
        ))}
        <div className="card-table__mode-divider" />
        <button
          className={`card-table__mode-btn card-table__shuffle-btn${shuffling ? " card-table__shuffle-btn--active" : ""}`}
          onClick={handleShuffle}
          title="Shuffle"
          disabled={shuffling}
        >
          <span className="card-table__mode-icon">&#x2672;</span>
          <span className="card-table__mode-label">Shuffle</span>
        </button>
        <div className="card-table__mode-divider" />
        <button
          className="card-table__mode-btn"
          onClick={() => props.onSwitchToCarousel && props.onSwitchToCarousel()}
          title="Carousel"
        >
          <span className="card-table__mode-icon">&#x25C9;</span>
          <span className="card-table__mode-label">Carousel</span>
        </button>
      </div>
      {images.map((img, index) => {
        const pos = positions[index];
        if (!pos) return null;
        if (collectedIds.has(img.public_id)) return null;

        const isFocused = focusedIndex === index;
        const isDragging = draggingIndex === index;
        const isFlipped = flippedIds.has(img.public_id);
        const zIndex = isFocused || isDragging ? 100 : (zMap[img.public_id] || (index + 1));
        const isDreamscape = img.source === "dreamscape";
        const userScale = scaleMap[img.public_id] || 1;
        const combinedScale = pos.scale * userScale;

        const cardClasses = [
          "card-table__card",
          dealing ? "card-table__card--dealing" : "",
          isFocused ? "card-table__card--focused" : "",
          isDragging ? "card-table__card--dragging" : "",
          isDreamscape ? "card-table__card--dreamscape" : "",
          isFlipped ? "card-table__card--flipped" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const handleDoubleClick = (e) => {
          e.stopPropagation();
          setFlippedIds((prev) => {
            const next = new Set(prev);
            if (next.has(img.public_id)) {
              next.delete(img.public_id);
            } else {
              next.add(img.public_id);
            }
            return next;
          });
          bringToFront(img.public_id);
        };

        const cardStyle = {
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: `translate(-50%, -50%) rotate(${pos.rotation}deg) scale(${combinedScale})`,
          zIndex,
        };

        return (
          <div
            key={img.public_id}
            className={cardClasses}
            data-public-id={img.public_id}
            style={cardStyle}
            onPointerDown={(e) => handlePointerDown(e, index, img.public_id)}
            onDoubleClick={handleDoubleClick}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="card-table__card-inner">
              <span
                className="card-table__card-front"
                style={{
                  animationDelay: dealing ? `${index * 30}ms` : undefined,
                }}
              >
                {isDreamscape ? (
                  <img
                    src={img.imageUrl}
                    alt={img.cardName || "Dreamscape card"}
                    className="card-table__dreamscape-img"
                  />
                ) : (
                  <AdvancedImage
                    cldImg={
                      new CloudinaryImage(img.public_id, {
                        cloudName: CLOUD_NAME,
                      })
                    }
                    alt={img.public_id}
                  />
                )}
              </span>
              <div className="card-table__card-back">
                <CardBack />
              </div>
            </div>
            {isDreamscape && img.cardName && (
              <div className="card-table__card-label">{img.cardName}</div>
            )}
          </div>
        );
      })}
    </div>
  );
});

CardTable.displayName = "CardTable";

export default CardTable;

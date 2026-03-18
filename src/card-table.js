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
  const [dealing, setDealing] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState("chaos");
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
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

  // Dealing animation
  useEffect(() => {
    if (images && images.length > 0 && dealing) {
      const totalDelay = 80 * images.length + 800;
      dealTimerRef.current = setTimeout(() => {
        setDealing(false);
      }, totalDelay);
      return () => clearTimeout(dealTimerRef.current);
    }
  }, [images, dealing]);

  // Keep refs in sync for use in pointer event handlers
  draggingIndexRef.current = draggingIndex;
  imagesRef.current = images;

  // Free-drag cards on the table (pointer events only — no HTML5 drag)
  const handlePointerDown = useCallback((e, index, publicId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    bringToFront(publicId);
    setDragStart({ index, startX: e.clientX, startY: e.clientY });
  }, [bringToFront]);

  const handlePointerMove = useCallback((e) => {
    if (!dragStart || !tableRef.current) return;

    // Haven't committed to table-drag yet — check movement threshold
    if (draggingIndex === null) {
      const dx = e.clientX - dragStart.startX;
      const dy = e.clientY - dragStart.startY;
      if (Math.sqrt(dx * dx + dy * dy) < 10) return;
      // Commit to table-drag
      const rect = tableRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      setDragOffset({ x: mx - positions[dragStart.index].x, y: my - positions[dragStart.index].y });
      setDraggingIndex(dragStart.index);
      return;
    }

    // Already dragging — update position
    const rect = tableRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    setPositions(prev => {
      const next = [...prev];
      next[draggingIndex] = {
        ...next[draggingIndex],
        x: mx - dragOffset.x,
        y: my - dragOffset.y,
      };
      return next;
    });
  }, [dragStart, draggingIndex, dragOffset, positions]);

  const handlePointerUp = useCallback((e) => {
    const idx = draggingIndexRef.current;
    const imgs = imagesRef.current;
    // If we were actively dragging a card, check if released over dock area
    if (idx !== null && imgs && props.onCardToDock) {
      const dockEl = document.querySelector(".card-panel__tray");
      if (dockEl) {
        const dockRect = dockEl.getBoundingClientRect();
        if (
          e.clientX >= dockRect.left && e.clientX <= dockRect.right &&
          e.clientY >= dockRect.top && e.clientY <= dockRect.bottom
        ) {
          const img = imgs[idx];
          if (img) {
            const cardData = img.source === "dreamscape"
              ? { public_id: img.public_id, imageUrl: img.imageUrl, cardName: img.cardName, cardDescription: img.cardDescription, source: "dreamscape", slideIndex: idx }
              : { public_id: img.public_id, cloud_name: CLOUD_NAME, slideIndex: idx };
            props.onCardToDock(cardData);
          }
        }
      }
    }
    setDraggingIndex(null);
    setDragStart(null);
  }, [props.onCardToDock]);

  useEffect(() => {
    if (dragStart !== null) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [dragStart, handlePointerMove, handlePointerUp]);

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
      if (!data.fromDock) return;

      const rect = tableRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const idx = images.findIndex(img => img.public_id === data.public_id);
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

  // Non-passive wheel listener for card scaling (React 16 registers wheel as passive)
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const onWheel = (e) => {
      // Walk up from e.target to find a .card-table__card element
      let cardEl = e.target.closest(".card-table__card");
      if (!cardEl) return;

      e.preventDefault();

      const publicId = cardEl.dataset.publicId;
      if (!publicId) return;

      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setScaleMap((prev) => {
        const current = prev[publicId] || 1;
        const next = Math.min(2.0, Math.max(0.5, current + delta));
        return { ...prev, [publicId]: next };
      });
      bringToFront(publicId);
    };

    table.addEventListener("wheel", onWheel, { passive: false });
    return () => table.removeEventListener("wheel", onWheel);
  }, [bringToFront]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    };
  }, []);

  if (!images || positions.length === 0) return null;

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

        return (
          <div
            key={img.public_id}
            className={cardClasses}
            data-public-id={img.public_id}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `rotate(${pos.rotation}deg) scale(${combinedScale})`,
              zIndex,
              transition: isDragging ? "none" : undefined,
            }}
            onPointerDown={(e) => handlePointerDown(e, index, img.public_id)}
            onDoubleClick={handleDoubleClick}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="card-table__card-inner">
              <span
                className="card-table__card-front"
                style={{
                  animationDelay: dealing ? `${index * 80}ms` : undefined,
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

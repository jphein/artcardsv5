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
    // Cluster toward center using a gaussian-ish distribution
    // Mean at 47.5% (center of 10-85 range), spread organically
    const rangeX = 75; // 85 - 10
    const rangeY = 75;
    const offsetX = 10;
    const offsetY = 10;

    // Use sum of randoms for a bell-curve-like distribution centered in the range
    const rawX = (Math.random() + Math.random() + Math.random()) / 3;
    const rawY = (Math.random() + Math.random() + Math.random()) / 3;

    const x = offsetX + rawX * rangeX;
    const y = offsetY + rawY * rangeY;
    const rotation = -15 + Math.random() * 30; // -15 to +15
    const scale = 0.85 + Math.random() * 0.2; // 0.85 to 1.05

    positions.push({ x, y, rotation, scale });
  }
  return positions;
}

function computeSpiral(count) {
  const positions = [];
  const goldenAngle = 137.508 * (Math.PI / 180); // golden angle in radians
  const centerX = 50;
  const centerY = 48; // slightly above center for logo room
  // Scale factor so the spiral fits in the viewport
  const maxRadius = 38; // percentage units
  const sqrtTotal = Math.sqrt(count);

  for (let i = 0; i < count; i++) {
    const angle = i * goldenAngle;
    const radius = (Math.sqrt(i) / sqrtTotal) * maxRadius;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    // Rotation follows the tangent of the spiral
    const rotation = (angle * 180 / Math.PI) % 360 - 180;
    // Scale: center cards bigger, outer smaller
    const scale = 1.05 - (i / count) * 0.35;
    positions.push({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)), rotation: rotation * 0.15, scale });
  }
  return positions;
}

function computeArc(count) {
  const positions = [];
  const arcDegrees = 140; // total arc sweep
  const startAngle = -(arcDegrees / 2);
  const centerX = 50;
  const centerY = 110; // pivot point below viewport
  const radius = 65; // percentage units - large arc

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angleDeg = startAngle + t * arcDegrees;
    const angleRad = angleDeg * (Math.PI / 180);
    const x = centerX + radius * Math.sin(angleRad);
    const y = centerY - radius * Math.cos(angleRad);
    const rotation = angleDeg * 0.4; // cards tilt along the arc
    // Center cards slightly bigger
    const distFromCenter = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
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
  const focusTimerRef = useRef(null);
  const dealTimerRef = useRef(null);

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

  // Dealing animation: after all cards have staggered in, remove dealing state
  useEffect(() => {
    if (images && images.length > 0 && dealing) {
      const totalDelay = 80 * images.length + 800;
      dealTimerRef.current = setTimeout(() => {
        setDealing(false);
      }, totalDelay);
      return () => clearTimeout(dealTimerRef.current);
    }
  }, [images, dealing]);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    focusCard(slideIndex) {
      // Clear any existing focus timer
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
  }));

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    };
  }, []);

  if (!images || positions.length === 0) return null;

  return (
    <div className="card-table">
      <div
        className={`card-table__flash${
          flash ? " card-table__flash--active" : ""
        }`}
      />
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

        const isFocused = focusedIndex === index;
        const zIndex = isFocused ? 100 : index + 1;
        const isDreamscape = img.source === "dreamscape";

        const cardClasses = [
          "card-table__card",
          dealing ? "card-table__card--dealing" : "",
          isFocused ? "card-table__card--focused" : "",
          isDreamscape ? "card-table__card--dreamscape" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const handleDragStart = (e) => {
          const dragData = isDreamscape
            ? {
                public_id: img.public_id,
                imageUrl: img.imageUrl,
                cardName: img.cardName,
                cardDescription: img.cardDescription,
                source: "dreamscape",
                slideIndex: index,
              }
            : {
                public_id: img.public_id,
                cloud_name: CLOUD_NAME,
                slideIndex: index,
              };
          e.dataTransfer.setData("application/json", JSON.stringify(dragData));
          e.dataTransfer.effectAllowed = "copy";
        };

        return (
          <div
            key={img.public_id}
            className={cardClasses}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `rotate(${pos.rotation}deg) scale(${pos.scale})`,
              zIndex,
            }}
          >
            <span
              draggable
              onDragStart={handleDragStart}
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

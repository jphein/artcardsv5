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

function computePositions(count) {
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

const CardTable = forwardRef((props, ref) => {
  const [images, setImages] = useState(null);
  const [positions, setPositions] = useState([]);
  const [dealing, setDealing] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [flash, setFlash] = useState(false);
  const focusTimerRef = useRef(null);
  const dealTimerRef = useRef(null);

  // Fetch Dreamscape cards from InstantDB
  const { data: instantData } = db.useQuery({ cards: {} });
  const dreamscapeCards = instantData?.cards || [];

  // Fetch Cloudinary images on mount, merge with Dreamscape cards
  useEffect(() => {
    let cancelled = false;
    async function fetchImages() {
      const response = await fetch(
        `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${TAG}.json`
      );
      const data = await response.json();
      // Cloudinary images get their standard shape
      const cloudinary = data.resources.map((img) => ({
        ...img,
        source: "cloudinary",
      }));
      // Dreamscape cards get mapped to a compatible shape
      const dreamscape = dreamscapeCards.map((card) => ({
        public_id: card.id,
        source: "dreamscape",
        imageUrl: card.imageUrl,
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
  }, [dreamscapeCards.length]);

  // Compute positions when images load or window resizes
  const recomputePositions = useCallback(() => {
    if (images) {
      setPositions(computePositions(images.length));
    }
  }, [images]);

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

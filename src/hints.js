import React, { useState, useCallback, useRef, useEffect } from "react";
import "./hints.css";

const STORAGE_PREFIX = "artcards_hint_seen_";
const HINT_DURATION = 4000; // auto-dismiss after 4s
const DISMISS_ANIMATION = 500; // fade-out duration

const HINT_MESSAGES = {
  "card-hover": (
    <>
      Scroll to resize <span className="hint-tooltip__sep">&middot;</span> Shift+scroll to rotate
    </>
  ),
  "card-flip": "Double-tap to flip",
  "drag-to-dock": "Drop on dock to collect",
  "dock-click": "Click a card to find it on the table",
  "carousel-nav": (
    <>
      Swipe or use arrow keys <span className="hint-tooltip__sep">&middot;</span> Drag card to collect
    </>
  ),
};

function hasSeenHint(hintId) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + hintId) === "1";
  } catch {
    return false;
  }
}

function markHintSeen(hintId) {
  try {
    localStorage.setItem(STORAGE_PREFIX + hintId, "1");
  } catch {
    // localStorage unavailable
  }
}

export function useHints() {
  const [activeHints, setActiveHints] = useState([]);
  const timersRef = useRef({});

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => {
        clearTimeout(t.dismiss);
        clearTimeout(t.remove);
      });
    };
  }, []);

  const dismissHint = useCallback((hintId) => {
    // Start exit animation
    setActiveHints((prev) =>
      prev.map((h) => (h.id === hintId ? { ...h, exiting: true } : h))
    );
    // Remove after animation
    const removeTimer = setTimeout(() => {
      setActiveHints((prev) => prev.filter((h) => h.id !== hintId));
      delete timersRef.current[hintId];
    }, DISMISS_ANIMATION);

    if (timersRef.current[hintId]) {
      clearTimeout(timersRef.current[hintId].dismiss);
      timersRef.current[hintId].remove = removeTimer;
    }
  }, []);

  const showHint = useCallback(
    (hintId, position) => {
      if (hasSeenHint(hintId)) return;
      // Don't show duplicate
      setActiveHints((prev) => {
        if (prev.find((h) => h.id === hintId)) return prev;
        return prev;
      });

      markHintSeen(hintId);

      const message = HINT_MESSAGES[hintId];
      if (!message) return;

      const hint = {
        id: hintId,
        message,
        x: position?.x ?? window.innerWidth / 2,
        y: position?.y ?? window.innerHeight / 2,
        exiting: false,
      };

      setActiveHints((prev) => {
        if (prev.find((h) => h.id === hintId)) return prev;
        return [...prev, hint];
      });

      // Auto-dismiss
      const dismissTimer = setTimeout(() => {
        dismissHint(hintId);
      }, HINT_DURATION);

      timersRef.current[hintId] = { dismiss: dismissTimer, remove: null };
    },
    [dismissHint]
  );

  const HintOverlay = useCallback(() => {
    if (activeHints.length === 0) return null;

    return (
      <div className="hint-overlay">
        {activeHints.map((hint) => {
          // Position tooltip: try to center above the point, clamp to viewport
          const tooltipStyle = {
            left: `${Math.max(20, Math.min(hint.x, window.innerWidth - 20))}px`,
            top: `${Math.max(20, Math.min(hint.y - 20, window.innerHeight - 60))}px`,
            transform: "translate(-50%, -100%)",
          };

          return (
            <div
              key={hint.id}
              className={`hint-tooltip${hint.exiting ? " hint-tooltip--exiting" : ""}`}
              style={tooltipStyle}
            >
              {hint.message}
            </div>
          );
        })}
      </div>
    );
  }, [activeHints]);

  return { showHint, HintOverlay };
}

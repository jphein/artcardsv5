import React, { useState, useEffect, useCallback } from "react";
import "./help-overlay.css";

const STORAGE_KEY = "artcards_help_seen";

function hasSeenHelp() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markHelpSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage unavailable
  }
}

export default function HelpOverlay() {
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [pulse, setPulse] = useState(!hasSeenHelp());

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (pulse) {
      markHelpSeen();
      setPulse(false);
    }
  }, [pulse]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setOpen(false);
      setExiting(false);
    }, 300);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, handleClose]);

  return (
    <>
      <button
        className={`help-btn${pulse ? " help-btn--pulse" : ""}`}
        onClick={handleOpen}
        title="Help"
        style={{ pointerEvents: "auto" }}
      >
        ?
      </button>

      {open && (
        <>
          <div
            className={`help-backdrop${exiting ? " help-backdrop--exiting" : ""}`}
            onClick={handleClose}
          />
          <div className={`help-panel${exiting ? " help-panel--exiting" : ""}`}>
            <div className="help-panel__title">Interactions</div>

            {/* Table Mode */}
            <div className="help-section">
              <div className="help-section__header">
                <span className="help-section__icon">{"\u2726"}</span>
                <span className="help-section__title">Table</span>
              </div>
              <ul className="help-items">
                <li className="help-item">
                  <span className="help-item__action">Tap deck</span>
                  <span className="help-item__desc">Deal all cards onto the table</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Drag</span>
                  <span className="help-item__desc">Move cards freely</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Scroll</span>
                  <span className="help-item__desc">Resize card (0.5x to 2x)</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Shift + Scroll</span>
                  <span className="help-item__desc">Rotate card</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Double-click</span>
                  <span className="help-item__desc">Flip card over</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Drag to dock</span>
                  <span className="help-item__desc">Collect card into your hand</span>
                </li>
              </ul>
            </div>

            <div className="help-divider" />

            {/* Layouts */}
            <div className="help-section">
              <div className="help-section__header">
                <span className="help-section__icon">{"\u25CE"}</span>
                <span className="help-section__title">Layouts</span>
              </div>
              <ul className="help-items">
                <li className="help-item">
                  <span className="help-item__action">Chaos</span>
                  <span className="help-item__desc">Random scatter</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Vortex</span>
                  <span className="help-item__desc">Golden spiral</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Oracle</span>
                  <span className="help-item__desc">Arc spread</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Shuffle</span>
                  <span className="help-item__desc">Gather and re-deal cards</span>
                </li>
              </ul>
            </div>

            <div className="help-divider" />

            {/* Dock */}
            <div className="help-section">
              <div className="help-section__header">
                <span className="help-section__icon">{"\u2261"}</span>
                <span className="help-section__title">Dock</span>
              </div>
              <ul className="help-items">
                <li className="help-item">
                  <span className="help-item__action">Hand tab</span>
                  <span className="help-item__desc">Your collected cards</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Decks tab</span>
                  <span className="help-item__desc">Save, load, and publish decks</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Spread tab</span>
                  <span className="help-item__desc">Lay out cards in a reading spread</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Click card</span>
                  <span className="help-item__desc">Find it on the table</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Drag card out</span>
                  <span className="help-item__desc">Return to table</span>
                </li>
              </ul>
            </div>

            <div className="help-divider" />

            {/* Carousel Mode */}
            <div className="help-section">
              <div className="help-section__header">
                <span className="help-section__icon">{"\u25C9"}</span>
                <span className="help-section__title">Carousel</span>
              </div>
              <ul className="help-items">
                <li className="help-item">
                  <span className="help-item__action">{"\u2190"} {"\u2192"} / Swipe</span>
                  <span className="help-item__desc">Navigate cards</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Drag card</span>
                  <span className="help-item__desc">Collect to dock</span>
                </li>
              </ul>
            </div>

            <div className="help-divider" />

            {/* Keyboard */}
            <div className="help-section">
              <div className="help-section__header">
                <span className="help-section__icon">{"\u2328"}</span>
                <span className="help-section__title">Keyboard</span>
              </div>
              <ul className="help-items">
                <li className="help-item">
                  <span className="help-item__action">{"\u2190"} {"\u2192"}</span>
                  <span className="help-item__desc">Navigate carousel</span>
                </li>
                <li className="help-item">
                  <span className="help-item__action">Esc</span>
                  <span className="help-item__desc">Close overlays</span>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  );
}

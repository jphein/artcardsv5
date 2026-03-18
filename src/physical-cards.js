import React, { useState } from "react";
import "./physical-cards.css";

const SHOP_URL = "https://www.thegamecrafter.com/games/visionary-artcards";

function PhysicalCardsSeal() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`physical-seal ${expanded ? "physical-seal--expanded" : ""}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <span className="physical-seal__rune">✦</span>
      {expanded && (
        <div className="physical-seal__content">
          <div className="physical-seal__divider" />
          <p className="physical-seal__text">
            Hold these cards in your hands
          </p>
          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="physical-seal__link"
          >
            Visit Shop <span className="physical-seal__arrow">→</span>
          </a>
        </div>
      )}
    </div>
  );
}

function PhysicalCardsHint({ cardCount }) {
  if (cardCount < 3) return null;

  return (
    <a
      href={SHOP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="physical-hint"
    >
      <span className="physical-hint__star">✦</span>
      These cards exist as physical art
    </a>
  );
}

export { PhysicalCardsSeal, PhysicalCardsHint };
export default PhysicalCardsSeal;

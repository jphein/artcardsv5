import React, { useRef, useState, useEffect } from "react";
import FireApp from "./logo";
import Example from "./example";
import CardTable from "./card-table";
import CardPanel from "./panel";
import AuthButton from "./auth-button";
import PhysicalCardsSeal from "./physical-cards";
import Welcome from "./welcome";
import HelpOverlay from "./help-overlay";

const FullScreenButton = ({ autoFullscreen }) => {
  const appContainerRef = useRef(null);
  const cardTableRef = useRef(null);
  const cardPanelRef = useRef(null);
  const [dockDragging, setDockDragging] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  const requestFullscreen = () => {
    if (appContainerRef.current.requestFullscreen) {
      appContainerRef.current.requestFullscreen();
    } else if (appContainerRef.current.mozRequestFullScreen) {
      appContainerRef.current.mozRequestFullScreen();
    } else if (appContainerRef.current.webkitRequestFullscreen) {
      appContainerRef.current.webkitRequestFullscreen();
    } else if (appContainerRef.current.msRequestFullscreen) {
      appContainerRef.current.msRequestFullscreen();
    }
  };

  useEffect(() => {
    if (autoFullscreen) {
      requestFullscreen();
    }
  }, [autoFullscreen]);

  return (
    <div>
      <div ref={appContainerRef} className="app-container">
        <FireApp />
        {viewMode === "table" ? (
          <CardTable
            ref={cardTableRef}
            dockDragging={dockDragging}
            onCardToDock={(cardData) => {
              if (cardPanelRef.current) {
                cardPanelRef.current.addCard(cardData);
              }
            }}
            onSwitchToCarousel={() => setViewMode("carousel")}
          />
        ) : (
          <Example onSwitchToTable={() => setViewMode("table")} />
        )}
        <CardPanel
          ref={cardPanelRef}
          onNavigate={(slideIndex) => {
            if (cardTableRef.current) {
              cardTableRef.current.focusCard(slideIndex);
            }
          }}
          onCollect={(publicId) => {
            if (cardTableRef.current) {
              cardTableRef.current.collectCard(publicId);
            }
          }}
          onUncollect={(publicId) => {
            if (cardTableRef.current) {
              cardTableRef.current.uncollectCard(publicId);
            }
          }}
          onToggle={() => {}}
          onDockDragStart={() => setDockDragging(true)}
          onDockDragEnd={() => setDockDragging(false)}
        />
        <PhysicalCardsSeal />
        <Welcome />
        <HelpOverlay />
        <div
          className="top-bar"
          style={{
            position: "fixed",
            top: 14,
            left: 14,
            right: 14,
            zIndex: 1100,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <button
            onClick={requestFullscreen}
            style={{
              pointerEvents: "auto",
              color: "#c9a84c",
              backgroundColor: "rgba(26, 15, 0, 0.85)",
              border: "1px solid #a67c00",
              padding: "8px 14px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "1px",
              boxShadow: "0 0 10px rgba(201, 168, 76, 0.2)",
            }}
          >
            Fullscreen
          </button>
          <AuthButton />
        </div>
      </div>
    </div>
  );
};

export default FullScreenButton;

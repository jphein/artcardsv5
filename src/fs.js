import React, { useRef, useState, useCallback, useEffect } from "react";
import FireApp from "./logo";
import Example from "./example";
import CardTable from "./card-table";
import CardPanel from "./panel";
import CardCreator from "./card-creator";
import AuthButton from "./auth-button";
import PhysicalCardsSeal from "./physical-cards";
import HelpOverlay from "./help-overlay";
import SettingsMenu from "./settings-menu";
import usePreferences from "./use-preferences";
import { VERSION_HASH, VERSION_NAME } from "./version-info";

const FullScreenButton = ({ autoFullscreen }) => {
  const appContainerRef = useRef(null);
  const cardTableRef = useRef(null);
  const cardPanelRef = useRef(null);
  const [dockDragging, setDockDragging] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [prefs, setPref] = usePreferences();

  const requestFullscreen = useCallback(() => {
    if (appContainerRef.current.requestFullscreen) {
      appContainerRef.current.requestFullscreen();
    } else if (appContainerRef.current.mozRequestFullScreen) {
      appContainerRef.current.mozRequestFullScreen();
    } else if (appContainerRef.current.webkitRequestFullscreen) {
      appContainerRef.current.webkitRequestFullscreen();
    } else if (appContainerRef.current.msRequestFullscreen) {
      appContainerRef.current.msRequestFullscreen();
    }
  }, []);

  useEffect(() => {
    if (autoFullscreen) {
      requestFullscreen();
    }
  }, [autoFullscreen, requestFullscreen]);

  return (
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
      ) : viewMode === "create" ? (
        <CardCreator onSwitchToTable={() => setViewMode("table")} />
      ) : (
        <Example onSwitchToTable={() => setViewMode("table")} />
      )}
      {viewMode !== "create" && (
        <CardPanel
          ref={cardPanelRef}
          prefs={prefs}
          setPref={setPref}
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
      )}
      {viewMode !== "create" && <PhysicalCardsSeal />}

      <div className="top-bar" style={viewMode === "create" ? { display: "none" } : undefined}>
        <button className="top-bar__fullscreen" onClick={requestFullscreen}>
          Fullscreen
        </button>
        <div className="top-bar__right">
          {viewMode === "carousel" && (
            <button className="top-bar__fullscreen" onClick={() => setViewMode("table")}>
              {"\u2726"} Table
            </button>
          )}
          {viewMode === "create" ? (
            <button className="top-bar__fullscreen" onClick={() => setViewMode("table")}>
              {"\u2726"} Table
            </button>
          ) : (
            <button className="top-bar__fullscreen top-bar__dreambook" onClick={() => setViewMode("create")}>
              {"\u263D"} Dreambook
            </button>
          )}
          <SettingsMenu prefs={prefs} setPref={setPref} />
          <HelpOverlay />
          <AuthButton />
        </div>
      </div>
      <div className="version-seal">{VERSION_NAME} · {VERSION_HASH}</div>
    </div>
  );
};

export default FullScreenButton;

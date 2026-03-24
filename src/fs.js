import React, { useRef, useState, useCallback, useEffect, Suspense } from "react";
import FireAppBase from "./logo";
import CardTable from "./card-table";
import CardPanel from "./panel";
import AuthButton from "./auth-button";
import PhysicalCardsSealBase from "./physical-cards";
import SettingsMenu from "./settings-menu";
import usePreferences from "./use-preferences";
import { VERSION_HASH, VERSION_NAME } from "./version-info";

// Memoize prop-less components to prevent re-renders from parent state changes
const FireApp = React.memo(FireAppBase);
const PhysicalCardsSeal = React.memo(PhysicalCardsSealBase);

// Lazy-load non-critical components to reduce initial bundle size
const Example = React.lazy(() => import("./example"));
const CardCreator = React.lazy(() => import("./card-creator"));
const HelpOverlay = React.lazy(() => import("./help-overlay"));

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
      <Suspense fallback={<div className="card-table__loading">Loading...</div>}>
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
      </Suspense>
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
          <Suspense fallback={null}><HelpOverlay /></Suspense>
          <AuthButton />
        </div>
      </div>
      <div className="version-seal">{VERSION_NAME} · {VERSION_HASH}</div>
    </div>
  );
};

export default FullScreenButton;

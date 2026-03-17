import React, { useRef, useEffect } from "react";
import { config } from "react-spring";
import FireApp from "./logo";
import Example from "./example";
import CardPanel from "./panel";

const FullScreenButton = ({ autoFullscreen }) => {
  const appContainerRef = useRef(null);
  const carouselRef = useRef(null);

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
        <Example ref={carouselRef} />
        <CardPanel
          onNavigate={(slideIndex) => {
            if (carouselRef.current) {
              // Flash on, fast config, jump to slide
              carouselRef.current.setState({
                goToSlide: slideIndex,
                config: { tension: 1000, friction: 35 },
                flash: true
              });
              // Flash off + restore slow config
              setTimeout(() => {
                if (carouselRef.current) {
                  carouselRef.current.setState({ flash: false, config: config.slow });
                }
              }, 500);
            }
          }}
          onToggle={() => {}}
        />
      </div>
      <div
        style={{
          position: "fixed",
          top: "0%",
          left: "0%",
          margin: "2%",
          padding: "10px",
          backgroundColor: "transparent",
          borderRadius: "5px 0 0 0"
        }}
      >
        <button
          onClick={requestFullscreen}
          style={{
            color: "#c9a84c",
            backgroundColor: "rgba(26, 15, 0, 0.85)",
            border: "1px solid #a67c00",
            padding: "8px 14px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
            letterSpacing: "1px",
            boxShadow: "0 0 10px rgba(201, 168, 76, 0.2)"
          }}
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
};

export default FullScreenButton;

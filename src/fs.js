import React, { useRef, useEffect } from "react";
import FireApp from "./logo";
import Example from "./example";

const FullScreenButton = ({ autoFullscreen }) => {
  const appContainerRef = useRef(null);

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
      <div ref={appContainerRef}>
        <FireApp />
        <Example />
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
            color: "gray",
            backgroundColor: "#303030",
            border: "none",
            padding: "10px",
            borderRadius: "5px"
          }}
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
};

export default FullScreenButton;

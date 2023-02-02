import React, { useState } from "react";
import logo from "./logo.png"; // import your logo image

const FireApp = () => {
  const [isFire, setIsFire] = useState(false); // state to control the animation

  // Function to toggle the fire animation
  const toggleFire = () => {
    setIsFire(!isFire);
  };

  return (
    <>
      <div className="logo-container">
        <img
          src={logo}
          alt="logo"
          className={`logo ${isFire ? "fire" : ""}`} // set the className dynamically based on the isFire state
          onMouseEnter={toggleFire} // toggle the fire animation when the logo is hovered
          onMouseLeave={toggleFire} // toggle back to the original state when the cursor leaves the logo
        />
      </div>
    </>
  );
};
export default FireApp;

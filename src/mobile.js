import React, { useState, useEffect } from "react";
import FullScreenButton from "./fs";

const PhoneDetector = (props) => {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const checkIfPhone = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent)) {
        setIsPhone(true);
      }
    };
    checkIfPhone();
  }, []);

  return <>{isPhone ? <PhoneApp /> : <DefaultApp />}</>;
};

const DefaultApp = () => {
  return (
    <div className="App">
      <FullScreenButton />
    </div>
  );
};

const PhoneApp = () => {
  return (
    <div className="App">
      <FullScreenButton />
    </div>
  );
};

export default PhoneDetector;

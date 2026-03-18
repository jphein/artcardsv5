import React from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import "./logo.css";
import PhoneDetector from "./mobile";

function App() {
  return <PhoneDetector />;
}

const rootElement = document.getElementById("root");
createRoot(rootElement).render(<App />);

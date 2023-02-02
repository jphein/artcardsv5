import React from "react";
import ReactDOM from "react-dom";

import "./styles.css";
import "./logo.css";
import PhoneDetector from "./mobile";

function App() {
  return <PhoneDetector />;
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);

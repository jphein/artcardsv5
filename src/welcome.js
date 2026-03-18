import React, { useState, useEffect, useCallback } from "react";
import "./welcome.css";

const STORAGE_KEY = "artcards_welcome_seen";

function hasSeenWelcome() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markWelcomeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage unavailable
  }
}

const STEPS = [
  // Step 1: Hero
  () => (
    <div className="welcome-step" key="step-1">
      <h1 className="welcome-title">Welcome to Artcards</h1>
      <p className="welcome-subtitle">A magical card experience</p>
    </div>
  ),
  // Step 2: Features
  () => (
    <div className="welcome-step" key="step-2">
      <div className="welcome-features">
        <div className="welcome-feature">
          <span className="welcome-feature__icon">{"\uD83C\uDCCF"}</span>
          <span className="welcome-feature__text">Tap the deck to deal your cards</span>
        </div>
        <div className="welcome-feature">
          <span className="welcome-feature__icon">{"\u270B"}</span>
          <span className="welcome-feature__text">Drag cards to collect and arrange</span>
        </div>
        <div className="welcome-feature">
          <span className="welcome-feature__icon">{"\u2728"}</span>
          <span className="welcome-feature__text">Flip, resize, and rotate with gestures</span>
        </div>
      </div>
    </div>
  ),
  // Step 3: Begin
  null, // rendered directly in the component for the button
];

export default function Welcome() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [stepExiting, setStepExiting] = useState(false);

  useEffect(() => {
    if (!hasSeenWelcome()) {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    markWelcomeSeen();
    setExiting(true);
    setTimeout(() => setVisible(false), 500);
  }, []);

  const goToStep = useCallback(
    (newStep) => {
      if (newStep < 0 || newStep > 2) return;
      if (newStep === step) return;
      setStepExiting(true);
      setTimeout(() => {
        setStep(newStep);
        setStepExiting(false);
      }, 250);
    },
    [step]
  );

  const advance = useCallback(() => {
    if (step >= 2) {
      dismiss();
    } else {
      goToStep(step + 1);
    }
  }, [step, dismiss, goToStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (step > 0) goToStep(step - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      } else if (e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, step, advance, dismiss, goToStep]);

  if (!visible) return null;

  const renderStepContent = () => {
    if (stepExiting) {
      return <div className="welcome-step welcome-step--exiting" key={`exit-${step}`} />;
    }
    if (step === 0) return STEPS[0]();
    if (step === 1) return STEPS[1]();
    // Step 2: Begin
    return (
      <div className="welcome-step" key="step-3">
        <h1 className="welcome-title">Ready?</h1>
        <p className="welcome-subtitle" style={{ marginBottom: 24 }}>
          Your cards await
        </p>
        <button className="welcome-begin" onClick={dismiss}>
          Begin
        </button>
      </div>
    );
  };

  return (
    <div
      className={`welcome-overlay${exiting ? " welcome-overlay--exiting" : ""}`}
      onClick={advance}
    >
      <div className="welcome-card" onClick={(e) => e.stopPropagation()}>
        <button className="welcome-skip" onClick={dismiss}>
          Skip
        </button>

        {renderStepContent()}

        <div className="welcome-dots">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className={`welcome-dot${step === i ? " welcome-dot--active" : ""}`}
              onClick={() => goToStep(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

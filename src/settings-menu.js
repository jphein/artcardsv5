import React, { useState, useEffect, useRef, useCallback } from "react";
import "./settings-menu.css";

const SPEED_OPTIONS = [
  { key: "fast", label: "Fast" },
  { key: "normal", label: "Normal" },
  { key: "slow", label: "Slow" },
];

const SPREAD_OPTIONS = [
  { key: "single", label: "Single" },
  { key: "three", label: "Three" },
  { key: "four", label: "Four Elements" },
  { key: "five", label: "Five Cross" },
  { key: "freeform", label: "Freeform" },
];

export default function SettingsMenu({ prefs, setPref }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  return (
    <div className="settings-menu">
      <button
        className={`settings-menu__gear${open ? " settings-menu__gear--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Settings"
      >
        {"\u2699"}
      </button>

      {open && (
        <div className="settings-menu__backdrop" onClick={handleClose} />
      )}

      <div
        ref={panelRef}
        className={`settings-menu__panel${open ? " settings-menu__panel--open" : ""}`}
      >
        {/* Title */}
        <div className="settings-menu__title">
          <span className="settings-menu__title-icon">{"\u2726"}</span>
          <span className="settings-menu__title-text">Settings</span>
        </div>

        {/* Animation Speed */}
        <div className="settings-menu__row">
          <span className="settings-menu__label">Animation Speed</span>
          <div className="settings-menu__toggle-group">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`settings-menu__toggle-btn${
                  prefs.animationSpeed === opt.key
                    ? " settings-menu__toggle-btn--active"
                    : ""
                }`}
                onClick={() => setPref("animationSpeed", opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Deal */}
        <div className="settings-menu__row">
          <div className="settings-menu__switch-row">
            <span className="settings-menu__switch-label">Auto-Deal</span>
            <button
              className={`settings-menu__switch${
                prefs.autoDeal ? " settings-menu__switch--on" : ""
              }`}
              onClick={() => setPref("autoDeal", !prefs.autoDeal)}
              role="switch"
              aria-checked={prefs.autoDeal}
            />
          </div>
        </div>

        {/* Default Spread */}
        <div className="settings-menu__row">
          <span className="settings-menu__label">Default Spread</span>
          <select
            className="settings-menu__select"
            value={prefs.spreadType}
            onChange={(e) => setPref("spreadType", e.target.value)}
          >
            {SPREAD_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

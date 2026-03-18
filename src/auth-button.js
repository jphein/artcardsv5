import React, { useState } from "react";
import { db } from "./db";
import "./auth-button.css";

export function useCurrentUser() {
  return db.useAuth();
}

function AuthButton() {
  const { isLoading, user, error } = db.useAuth();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <div className="auth-btn auth-btn--loading">
        <span className="auth-btn__dot" />
      </div>
    );
  }

  if (user) {
    const display = user.email || "Signed in";
    return (
      <div className="auth-btn auth-btn--signed-in">
        <span className="auth-btn__email" title={display}>
          {display}
        </span>
        <button
          className="auth-btn__sign-out"
          onClick={() => db.auth.signOut()}
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        className="auth-btn auth-btn--sign-in"
        onClick={() => setShowForm(true)}
      >
        Sign In
      </button>
    );
  }

  const handleGoogleSignIn = () => {
    const url = db.auth.createAuthorizationURL({
      clientName: "google-web",
      redirectURL: window.location.href,
    });
    window.location.href = url;
  };

  // Magic code: step 1 — enter email (+ Google option)
  if (!sentEmail) {
    return (
      <div className="auth-btn auth-btn--form">
        <button
          className="auth-btn__google"
          onClick={handleGoogleSignIn}
        >
          Sign in with Google
        </button>
        <div className="auth-btn__divider">
          <span>or</span>
        </div>
        <input
          className="auth-btn__input"
          type="email"
          placeholder="Email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim()) {
              setAuthError(null);
              db.auth.sendMagicCode({ email: email.trim() }).then(() => {
                setSentEmail(email.trim());
              }).catch((err) => {
                setAuthError(err.body?.message || "Failed to send code");
              });
            }
            if (e.key === "Escape") {
              setShowForm(false);
              setEmail("");
            }
          }}
          autoFocus
        />
        <button
          className="auth-btn__send"
          onClick={() => {
            if (!email.trim()) return;
            setAuthError(null);
            db.auth.sendMagicCode({ email: email.trim() }).then(() => {
              setSentEmail(email.trim());
            }).catch((err) => {
              setAuthError(err.body?.message || "Failed to send code");
            });
          }}
        >
          Send Code
        </button>
        <button
          className="auth-btn__cancel"
          onClick={() => { setShowForm(false); setEmail(""); }}
        >
          &times;
        </button>
        {authError && <div className="auth-btn__error">{authError}</div>}
      </div>
    );
  }

  // Magic code: step 2 — enter code
  return (
    <div className="auth-btn auth-btn--form">
      <span className="auth-btn__sent-to">Code sent to {sentEmail}</span>
      <input
        className="auth-btn__input"
        type="text"
        placeholder="Enter code..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && code.trim()) {
            setAuthError(null);
            db.auth.signInWithMagicCode({ email: sentEmail, code: code.trim() }).catch((err) => {
              setAuthError(err.body?.message || "Invalid code");
            });
          }
          if (e.key === "Escape") {
            setSentEmail("");
            setCode("");
          }
        }}
        autoFocus
      />
      <button
        className="auth-btn__send"
        onClick={() => {
          if (!code.trim()) return;
          setAuthError(null);
          db.auth.signInWithMagicCode({ email: sentEmail, code: code.trim() }).catch((err) => {
            setAuthError(err.body?.message || "Invalid code");
          });
        }}
      >
        Verify
      </button>
      <button
        className="auth-btn__cancel"
        onClick={() => { setSentEmail(""); setCode(""); }}
      >
        Back
      </button>
      {authError && <div className="auth-btn__error">{authError}</div>}
    </div>
  );
}

export default AuthButton;

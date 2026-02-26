"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type AuthState =
  | { mode: "idle" }
  | { mode: "password" }
  | { mode: "unlock"; sessionId: string; code: string }
  | { mode: "approved" };

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<AuthState>({ mode: "idle" });
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth?action=check")
      .then((r) => r.json())
      .then((d) => setAuthed(d.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  // Poll for unlock approval
  useEffect(() => {
    if (state.mode !== "unlock") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/auth?action=poll&session_id=${(state as { mode: "unlock"; sessionId: string }).sessionId}`
        );
        const data = await res.json();
        if (data.status === "approved") {
          setState({ mode: "approved" });
          setAuthed(true);
        } else if (data.status === "denied" || data.status === "expired" || data.status === "not_found") {
          setError(data.status === "denied" ? "Access denied" : "Session expired");
          setState({ mode: "idle" });
        }
        setPollCount((c) => c + 1);
      } catch {
        /* retry */
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [state]);

  // Focus password input
  useEffect(() => {
    if (state.mode === "password") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.mode]);

  const handleUnlock = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock" }),
      });
      const data = await res.json();
      if (data.session_id) {
        setState({ mode: "unlock", sessionId: data.session_id, code: data.code });
        setPollCount(0);
      } else {
        setError(data.error || "Failed to start unlock");
      }
    } catch {
      setError("Observer unreachable");
    }
  }, []);

  const handlePassword = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "password", password }),
      });
      const data = await res.json();
      if (data.authenticated) {
        setAuthed(true);
      } else {
        setError("Invalid password");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Auth failed");
    }
  }, [password]);

  // Loading state
  if (authed === null) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "48px",
              color: "var(--green)",
              letterSpacing: "0.05em",
            }}
          >
            AXE
          </span>
          <div
            className="w-8 h-0.5"
            style={{ background: "var(--green)", animation: "fadeSlideIn 150ms ease forwards" }}
          />
        </div>
      </div>
    );
  }

  // Authenticated — show dashboard
  if (authed) {
    return <>{children}</>;
  }

  // Login gate
  return (
    <div
      className="flex flex-col items-center justify-center h-screen px-6"
      style={{ background: "var(--background)" }}
    >
      {/* Progress bar at top */}
      <div
        className="progress-bar fixed top-0 left-0 right-0"
        style={{
          transform: state.mode === "unlock" ? `scaleX(${Math.min(pollCount / 75, 0.95)})` : "scaleX(0)",
        }}
      />

      {/* Frosted glass card */}
      <div
        className="glass card-hover w-full max-w-sm rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--rule)" }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-6">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "40px",
              color: "var(--green)",
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            AXE LIVE
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.22em",
            }}
          >
            {state.mode === "idle" && "Authenticate to continue"}
            {state.mode === "password" && "Enter passphrase"}
            {state.mode === "unlock" && "Waiting for approval"}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--rule)" }} />

        {/* Content area */}
        <div className="px-8 py-6">
          {/* Idle — show two buttons */}
          {state.mode === "idle" && (
            <div className="flex flex-col gap-4">
              <button
                onClick={handleUnlock}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  background: "var(--green)",
                  color: "#0A0A0A",
                  border: "none",
                  borderRadius: "4px",
                  padding: "14px 24px",
                  minHeight: "48px",
                  cursor: "pointer",
                  transition: "all 150ms",
                  width: "100%",
                }}
              >
                Unlock
              </button>
              <button
                onClick={() => { setState({ mode: "password" }); setError(""); }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  background: "transparent",
                  color: "var(--foreground)",
                  border: "1px solid var(--rule)",
                  borderRadius: "4px",
                  padding: "14px 24px",
                  minHeight: "48px",
                  cursor: "pointer",
                  transition: "all 150ms",
                  width: "100%",
                }}
              >
                Password
              </button>
            </div>
          )}

          {/* Password mode */}
          {state.mode === "password" && (
            <div className="flex flex-col gap-4">
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePassword()}
                placeholder="Passphrase"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  background: "var(--background)",
                  border: "1px solid var(--rule)",
                  color: "var(--foreground)",
                  borderRadius: "4px",
                  padding: "12px 16px",
                  minHeight: "48px",
                  outline: "none",
                  transition: "border-color 150ms",
                  width: "100%",
                  textAlign: "center",
                  letterSpacing: "0.2em",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--green)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--rule)")}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setState({ mode: "idle" }); setPassword(""); setError(""); }}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    background: "transparent",
                    color: "var(--text-tertiary)",
                    border: "1px solid var(--rule)",
                    borderRadius: "4px",
                    padding: "12px 16px",
                    minHeight: "44px",
                    cursor: "pointer",
                    transition: "all 150ms",
                    flex: 1,
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handlePassword}
                  disabled={!password}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    background: password ? "var(--green)" : "var(--rule)",
                    color: password ? "#0A0A0A" : "var(--text-tertiary)",
                    border: "none",
                    borderRadius: "4px",
                    padding: "12px 16px",
                    minHeight: "44px",
                    cursor: password ? "pointer" : "default",
                    transition: "all 150ms",
                    flex: 2,
                  }}
                >
                  Enter
                </button>
              </div>
            </div>
          )}

          {/* Unlock mode — waiting */}
          {state.mode === "unlock" && (
            <div className="flex flex-col items-center gap-4">
              {/* Pulsing dot */}
              <div
                className="pulse-green"
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "var(--green)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                }}
              >
                Check your phone to approve
              </span>
              <span
                className="eyebrow"
                style={{ fontSize: "18px", letterSpacing: "0.3em" }}
              >
                {(state as { code: string }).code}
              </span>
              <button
                onClick={() => { setState({ mode: "idle" }); setError(""); }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  background: "transparent",
                  color: "var(--text-tertiary)",
                  border: "1px solid var(--rule)",
                  borderRadius: "4px",
                  padding: "10px 20px",
                  minHeight: "44px",
                  cursor: "pointer",
                  transition: "all 150ms",
                  marginTop: "8px",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="animate-fade-in mt-4 text-center"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#ff4444",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-6"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.22em",
        }}
      >
        Observer Auth
      </div>
    </div>
  );
}

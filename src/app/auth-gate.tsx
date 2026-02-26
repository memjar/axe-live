"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth?action=check")
      .then((r) => r.json())
      .then((d) => setAuthed(d.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  // Auto-focus passcode input
  useEffect(() => {
    if (authed === false) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [authed]);

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
        setError("Invalid passcode");
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

  // Passcode gate — single input, auto-focused
  return (
    <div
      className="flex flex-col items-center justify-center h-screen px-6"
      style={{ background: "var(--background)" }}
    >
      <div
        className="glass card-hover w-full max-w-xs rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--rule)" }}
      >
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
            Enter passcode
          </span>
        </div>

        <div style={{ height: "1px", background: "var(--rule)" }} />

        <div className="px-8 py-6">
          <div className="flex flex-col gap-4">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && handlePassword()}
              placeholder="Passcode"
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
            <button
              onClick={handlePassword}
              disabled={!password}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                background: password ? "var(--green)" : "var(--rule)",
                color: password ? "#0A0A0A" : "var(--text-tertiary)",
                border: "none",
                borderRadius: "4px",
                padding: "14px 24px",
                minHeight: "48px",
                cursor: password ? "pointer" : "default",
                transition: "all 150ms",
                width: "100%",
              }}
            >
              Enter
            </button>
          </div>

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
    </div>
  );
}

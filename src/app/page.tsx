"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import AuthGate from "./auth-gate";

const CHAT_CENTRE =
  process.env.NEXT_PUBLIC_CHAT_CENTRE || "http://192.168.1.148:8081";
const WS_URL = CHAT_CENTRE.replace(/^http/, "ws") + "/ws/live";

type Event = {
  type: string;
  ts: string;
  agent?: string;
  content?: string;
  source?: string;
  engine?: string;
  action?: string;
  round?: number;
  status?: string;
};

type Health = {
  status: string;
  ollama: string;
  exo_model_fast: string;
  exo_model_heavy: string;
  memory: string;
};

// Doctrine: green is the ONE accent. Agent names differentiated by text only.
const AGENTS = ["Forge", "Cortana", "Klaus", "Axwell", "Critic"];

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("");
  const [agent, setAgent] = useState("Forge");
  const [heavy, setHeavy] = useState(false);
  const [sending, setSending] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const prevEventCount = useRef(0);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const event: Event = JSON.parse(e.data);
          setEvents((prev) => [...prev.slice(-499), event]);
        } catch {
          /* ignore non-JSON */
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // Health check
  useEffect(() => {
    const check = () =>
      fetch(`${CHAT_CENTRE}/health`)
        .then((r) => r.json())
        .then(setHealth)
        .catch(() => setHealth(null));
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (events.length > prevEventCount.current) {
      feedRef.current?.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevEventCount.current = events.length;
  }, [events]);

  // Scroll progress tracking
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const handleScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setScrollProgress(max > 0 ? el.scrollTop / max : 0);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Fallback polling when WebSocket is down
  useEffect(() => {
    if (connected) return;
    const poll = setInterval(() => {
      fetch(`${CHAT_CENTRE}/events/recent?limit=50`)
        .then((r) => r.json())
        .then((d) => {
          if (d.events?.length) setEvents(d.events);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(poll);
  }, [connected]);

  const sendMessage = useCallback(async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${CHAT_CENTRE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), agent, heavy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage("");
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  }, [message, agent, heavy, sending]);

  function renderEvent(ev: Event, i: number) {
    const time = ev.ts ? new Date(ev.ts).toLocaleTimeString() : "";
    const agentName = ev.agent || "System";
    const isNew = i >= events.length - 3;

    if (ev.type === "user_msg") {
      return (
        <div
          key={i}
          className={`flex justify-end ${isNew ? "animate-fade-in" : ""}`}
        >
          <div className="card-hover max-w-[75%] rounded-lg overflow-hidden"
               style={{ border: "1px solid var(--rule)", background: "var(--card)" }}>
            <div className="px-4 py-3" style={{ paddingTop: "14px" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="eyebrow">
                  {ev.source === "live_viewer" ? "Live" : "User"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                  to {agentName}
                </span>
                <span className="ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                  {time}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {ev.content}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (ev.type === "agent_reply") {
      return (
        <div
          key={i}
          className={`flex justify-start ${isNew ? "animate-fade-in" : ""}`}
        >
          <div className="card-hover max-w-[75%] rounded-lg overflow-hidden"
               style={{ border: "1px solid var(--rule)", background: "var(--card)" }}>
            <div className="px-4 py-3" style={{ paddingTop: "14px" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--green)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, color: "var(--foreground)" }}>
                  {agentName}
                </span>
                {ev.engine && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                    {ev.engine}
                  </span>
                )}
                <span className="ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                  {time}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {ev.content}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (ev.type === "swarm_turn") {
      return (
        <div
          key={i}
          className={`flex justify-start ${isNew ? "animate-fade-in" : ""}`}
        >
          <div className="card-hover max-w-[85%] rounded-lg overflow-hidden"
               style={{ border: "1px solid var(--rule)", borderLeft: "2px solid var(--green)", background: "var(--card)" }}>
            <div className="px-4 py-3" style={{ paddingTop: "14px" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--green)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, color: "var(--foreground)" }}>
                  {agentName}
                </span>
                <span className="eyebrow">SWARM R{ev.round}</span>
                <span className="ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                  {time}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {ev.content}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (ev.type === "swarm_end") {
      return (
        <div key={i} className={`flex justify-center ${isNew ? "animate-fade-in" : ""}`}>
          <div className="rounded-full px-4 py-2"
               style={{ border: "1px solid var(--rule)", background: "var(--card)" }}>
            <span className="eyebrow">
              Swarm {ev.status} — {agentName} called it
            </span>
          </div>
        </div>
      );
    }

    if (ev.type === "critic_action") {
      return (
        <div
          key={i}
          className={`flex justify-start ${isNew ? "animate-fade-in" : ""}`}
        >
          <div className="card-hover max-w-[75%] rounded-lg overflow-hidden"
               style={{ border: "1px solid var(--rule)", background: "var(--card)" }}>
            <div className="px-4 py-3" style={{ paddingTop: "14px" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--green)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, color: "var(--foreground)" }}>
                  Critic
                </span>
                <span className="eyebrow">{ev.action}</span>
                {ev.engine && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                    {ev.engine}
                  </span>
                )}
                <span className="ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                  {time}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {ev.content}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Fallback
    return (
      <div key={i} className={`flex justify-center ${isNew ? "animate-fade-in" : ""}`}>
        <div className="rounded px-3 py-2" style={{ border: "1px solid var(--rule)", background: "var(--card)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
            {ev.type}: {ev.content?.slice(0, 100)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <AuthGate>
    <div className="flex flex-col h-screen" style={{ background: "var(--background)" }}>
      {/* Doctrine: 2px green progress bar at top */}
      <div className="progress-bar" style={{ transform: `scaleX(${scrollProgress})` }} />

      {/* Doctrine: Frosted glass nav */}
      <header className="glass flex items-center gap-4 px-6 py-4"
              style={{ borderBottom: "1px solid var(--rule)" }}>
        {/* Doctrine: Bebas Neue for display text */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--green)", letterSpacing: "0.05em", lineHeight: 1 }}>
            AXE LIVE
          </h1>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/" className="eyebrow" style={{ color: "var(--green)", textDecoration: "none" }}>Dashboard</Link>
          <Link href="/apps" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Apps</Link>
          <Link href="/live" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Live Feeds</Link>
          <Link href="/team" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Team</Link>
        </nav>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "pulse-green" : ""}`}
            style={{ background: connected ? "var(--green)" : "#ff4444" }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {health && (
            <>
              <div className="flex items-center gap-2">
                <span className="eyebrow">Ollama</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: health.ollama === "up" ? "var(--green)" : "#ff4444" }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="eyebrow">Memory</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: health.memory === "available" ? "var(--green)" : "#ff4444" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                {health.exo_model_fast?.split("/").pop()}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Event Feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-6 py-4"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span style={{ fontFamily: "var(--font-display)", fontSize: "48px", color: "var(--rule)", letterSpacing: "0.05em" }}>
              AXE
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.22em" }}>
              Waiting for events
            </span>
          </div>
        )}
        {events.map(renderEvent)}
      </div>

      {/* Doctrine: Frosted glass input bar, 8px grid spacing */}
      <div className="glass px-6 py-4" style={{ borderTop: "1px solid var(--rule)" }}>
        <div className="flex items-center gap-4">
          {/* Agent selector — mobile-friendly 44px min touch target */}
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              background: "var(--background)",
              border: "1px solid var(--rule)",
              color: "var(--foreground)",
              borderRadius: "4px",
              padding: "10px 12px",
              minHeight: "44px",
              outline: "none",
            }}
          >
            {AGENTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Heavy toggle — 44px touch target */}
          <label
            className="flex items-center gap-2 cursor-pointer"
            style={{ minHeight: "44px", minWidth: "44px", padding: "0 4px" }}
          >
            <input
              type="checkbox"
              checked={heavy}
              onChange={(e) => setHeavy(e.target.checked)}
              style={{ accentColor: "var(--green)", width: "16px", height: "16px" }}
            />
            <span className="eyebrow" style={{ color: heavy ? "var(--green)" : "var(--text-tertiary)" }}>
              Heavy
            </span>
          </label>

          {/* Message input */}
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && sendMessage()
            }
            placeholder="Send a message..."
            disabled={sending}
            style={{
              flex: 1,
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              background: "var(--background)",
              border: "1px solid var(--rule)",
              color: "var(--foreground)",
              borderRadius: "4px",
              padding: "10px 16px",
              minHeight: "44px",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--rule)")}
          />

          {/* Send button — doctrine green */}
          <button
            onClick={sendMessage}
            disabled={sending || !message.trim()}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              background: sending || !message.trim() ? "var(--rule)" : "var(--green)",
              color: sending || !message.trim() ? "var(--text-tertiary)" : "#0A0A0A",
              border: "none",
              borderRadius: "4px",
              padding: "10px 24px",
              minHeight: "44px",
              cursor: sending || !message.trim() ? "default" : "pointer",
              transition: "all 150ms",
            }}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
    </AuthGate>
  );
}

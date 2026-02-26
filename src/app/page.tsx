"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

const AGENT_COLORS: Record<string, string> = {
  Forge: "border-emerald-500 bg-emerald-500/10",
  Cortana: "border-purple-500 bg-purple-500/10",
  Klaus: "border-blue-500 bg-blue-500/10",
  Axwell: "border-red-500 bg-red-500/10",
  Critic: "border-amber-500 bg-amber-500/10",
};

const AGENT_DOT: Record<string, string> = {
  Forge: "bg-emerald-500",
  Cortana: "bg-purple-500",
  Klaus: "bg-blue-500",
  Axwell: "bg-red-500",
  Critic: "bg-amber-500",
};

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("");
  const [agent, setAgent] = useState("Forge");
  const [heavy, setHeavy] = useState(false);
  const [sending, setSending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

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
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [events]);

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
    const colorClass =
      AGENT_COLORS[agentName] || "border-gray-600 bg-gray-600/10";
    const dotClass = AGENT_DOT[agentName] || "bg-gray-500";

    if (ev.type === "user_msg") {
      return (
        <div key={i} className="flex justify-end">
          <div className="max-w-[75%] rounded-lg border border-emerald-800 bg-emerald-900/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="text-emerald-400 font-medium">
                {ev.source === "live_viewer" ? "Live Viewer" : "User"}
              </span>
              <span>to {agentName}</span>
              <span className="ml-auto">{time}</span>
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {ev.content}
            </p>
          </div>
        </div>
      );
    }

    if (ev.type === "agent_reply") {
      return (
        <div key={i} className="flex justify-start">
          <div
            className={`max-w-[75%] rounded-lg border-l-4 ${colorClass} px-4 py-3`}
          >
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className={`w-2 h-2 rounded-full ${dotClass}`} />
              <span className="font-medium text-gray-300">{agentName}</span>
              {ev.engine && (
                <span className="text-gray-600">({ev.engine})</span>
              )}
              <span className="ml-auto">{time}</span>
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {ev.content}
            </p>
          </div>
        </div>
      );
    }

    if (ev.type === "swarm_turn") {
      return (
        <div key={i} className="flex justify-start">
          <div
            className={`max-w-[85%] rounded-lg border-l-4 ${colorClass} px-4 py-3`}
          >
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className={`w-2 h-2 rounded-full ${dotClass}`} />
              <span className="font-medium text-gray-300">{agentName}</span>
              <span className="text-orange-400">SWARM R{ev.round}</span>
              <span className="ml-auto">{time}</span>
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {ev.content}
            </p>
          </div>
        </div>
      );
    }

    if (ev.type === "swarm_end") {
      return (
        <div key={i} className="flex justify-center">
          <div className="rounded-full border border-orange-700 bg-orange-900/20 px-4 py-1 text-xs text-orange-400">
            Swarm {ev.status} — {agentName} called it
          </div>
        </div>
      );
    }

    if (ev.type === "critic_action") {
      return (
        <div key={i} className="flex justify-start">
          <div className="max-w-[75%] rounded-lg border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-medium text-gray-300">Critic</span>
              <span className="text-amber-400">{ev.action}</span>
              {ev.engine && (
                <span className="text-gray-600">({ev.engine})</span>
              )}
              <span className="ml-auto">{time}</span>
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {ev.content}
            </p>
          </div>
        </div>
      );
    }

    // Fallback
    return (
      <div key={i} className="flex justify-center">
        <div className="rounded border border-gray-700 bg-gray-800/50 px-3 py-1 text-xs text-gray-500">
          {ev.type}: {ev.content?.slice(0, 100)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-200 font-mono">
      {/* Header */}
      <header className="flex items-center gap-4 px-5 py-3 bg-[#111] border-b border-gray-800 flex-wrap">
        <h1 className="text-lg font-bold text-emerald-400 tracking-tight">
          AXE LIVE
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
          />
          <span className="text-xs text-gray-500">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-600">
          {health && (
            <>
              <span>
                Ollama:{" "}
                <span
                  className={
                    health.ollama === "up"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                >
                  {health.ollama}
                </span>
              </span>
              <span>
                Memory:{" "}
                <span
                  className={
                    health.memory === "available"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                >
                  {health.memory}
                </span>
              </span>
              <span className="text-gray-700">|</span>
              <span className="text-gray-500">
                {health.exo_model_fast?.split("/").pop()}
              </span>
              <span className="text-gray-500">
                {health.exo_model_heavy?.split("/").pop()}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Event Feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
      >
        {events.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Waiting for events...
          </div>
        )}
        {events.map(renderEvent)}
      </div>

      {/* Input Bar */}
      <div className="px-5 py-3 bg-[#111] border-t border-gray-800">
        <div className="flex items-center gap-3">
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="bg-[#1a1a1a] border border-gray-700 text-gray-300 text-sm rounded px-2 py-2 outline-none focus:border-emerald-500"
          >
            <option value="Forge">Forge</option>
            <option value="Cortana">Cortana</option>
            <option value="Klaus">Klaus</option>
            <option value="Axwell">Axwell</option>
            <option value="Critic">Critic</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={heavy}
              onChange={(e) => setHeavy(e.target.checked)}
              className="accent-emerald-500"
            />
            Heavy
          </label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && sendMessage()
            }
            placeholder="Send a message..."
            className="flex-1 bg-[#1a1a1a] border border-gray-700 text-gray-200 text-sm rounded px-4 py-2 outline-none focus:border-emerald-500"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !message.trim()}
            className="bg-emerald-500 text-black font-bold text-sm px-5 py-2 rounded hover:bg-emerald-400 disabled:opacity-30 transition-colors"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

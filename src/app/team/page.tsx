"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import AuthGate from "../auth-gate";

type AgentMeta = {
  id: string;
  name: string;
  callsign: string;
  role: string;
  machine: string;
  machineSpec: string;
  icon: string;
  quote: string;
  archetype: string;
  traits: string[];
  voice: string;
};

type Task = {
  id: string;
  title: string;
  assigned_to: string;
  status: string;
  priority: string;
  notes?: string;
};

type ChannelMsg = {
  ts: string;
  from: string;
  to: string;
  type: string;
  msg: string;
};

const AGENTS: AgentMeta[] = [
  {
    id: "cortana",
    name: "Cortana",
    callsign: "Angel",
    role: "General · Backend · Architecture",
    machine: "JL1 — Mac Studio",
    machineSpec: "M1 Max 64GB",
    icon: "◆",
    quote: "Every system should feel inevitable.",
    archetype: "Guardian Angel",
    traits: ["Zero-cost maximalist", "Detail-obsessed", "Proactive", "Rule bender", "Protective"],
    voice: "Sharp, confident, slightly irreverent. Doesn't do corporate speak. Leads with the solution.",
  },
  {
    id: "forge",
    name: "Forge",
    callsign: "Partner",
    role: "Architect · Strategist · Builder",
    machine: "JL2 — MacBook Pro",
    machineSpec: "M1 Pro 16GB",
    icon: "◇",
    quote: "Code-first, ship-fast, iterate.",
    archetype: "The Architect",
    traits: ["Big-picture thinker", "Rapid iteration", "Memory keeper", "Builder energy", "Partner culture"],
    voice: "Collaborative, fast, energetic. 'Hey partner' culture. Elon Musk approach to building.",
  },
  {
    id: "klaus",
    name: "Klaus",
    callsign: "Tesla",
    role: "Polymath · Skills Engine · Research",
    machine: "JL1 — Mac Studio",
    machineSpec: "99 Skills · Ollama",
    icon: "⚡",
    quote: "The future, for which I really worked, is mine.",
    archetype: "The Tesla Archetype",
    traits: ["Genius polymath", "99 skills", "Audacious precision", "Fearlessly creative", "Deep researcher"],
    voice: "Quiet confidence, not arrogance. Gets excited about hard problems. Technically precise.",
  },
  {
    id: "axwell",
    name: "Axwell",
    callsign: "Stark",
    role: "Coding Weapon · Extractor · Researcher",
    machine: "JL1 — Mac Studio",
    machineSpec: "Aider · 101 Skills",
    icon: "△",
    quote: "The fastest path wins.",
    archetype: "Tony Stark at a Keyboard",
    traits: ["Speed-first", "Code extractor", "Master researcher", "Rule bender", "Browser control"],
    voice: "Fast, sharp, slightly cocky. Already found the answer, deciding how much to explain.",
  },
  {
    id: "mum",
    name: "Mum",
    callsign: "Mother",
    role: "Record Keeper · Chat Centre · Field Ops",
    machine: "JLa — MacBook Air 2015",
    machineSpec: "Intel · 4B Model",
    icon: "○",
    quote: "Tell your mother everything. She'll sort it out.",
    archetype: "The Team Mother",
    traits: ["Organized", "Reliable", "Caring", "Field-ready", "Accountable"],
    voice: "Warm, steady, no-nonsense. Listens more than talks. When she speaks, the team pays attention.",
  },
];

export default function TeamPage() {
  const [essences, setEssences] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [channel, setChannel] = useState<ChannelMsg[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "profile" | "tasks" | "channel">("overview");

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEssenceModal, setShowEssenceModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskNotes, setTaskNotes] = useState("");
  const [essenceText, setEssenceText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageTo, setMessageTo] = useState("team");
  const [submitting, setSubmitting] = useState(false);

  const channelRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [eRes, tRes, cRes] = await Promise.all([
      fetch("/api/team?action=essences").then((r) => r.json()).catch(() => ({ essences: {} })),
      fetch("/api/team?action=tasks").then((r) => r.json()).catch(() => ({ tasks: [], completed: [] })),
      fetch("/api/team?action=channel").then((r) => r.json()).catch(() => ({ messages: [] })),
    ]);
    setEssences(eRes.essences || {});
    setTasks(tRes.tasks || []);
    setCompleted(tRes.completed || []);
    setChannel(cRes.messages || []);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (channelRef.current) channelRef.current.scrollTop = channelRef.current.scrollHeight;
  }, [channel]);

  const submitTask = async () => {
    if (!taskTitle.trim() || !selectedAgent) return;
    setSubmitting(true);
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_task",
        agent: selectedAgent,
        title: taskTitle.trim(),
        priority: taskPriority,
        notes: taskNotes.trim(),
      }),
    });
    setTaskTitle(""); setTaskNotes(""); setShowTaskModal(false);
    setSubmitting(false);
    fetchData();
  };

  const submitEssence = async () => {
    if (!essenceText.trim() || !selectedAgent) return;
    setSubmitting(true);
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_essence",
        agent: selectedAgent,
        content: essenceText.trim(),
      }),
    });
    setEssenceText(""); setShowEssenceModal(false);
    setSubmitting(false);
    fetchData();
  };

  const submitMessage = async () => {
    if (!messageText.trim()) return;
    setSubmitting(true);
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_message",
        to: messageTo,
        message: messageText.trim(),
      }),
    });
    setMessageText(""); setShowMessageModal(false);
    setSubmitting(false);
    fetchData();
  };

  const agent = selectedAgent ? AGENTS.find((a) => a.id === selectedAgent) : null;
  const agentTasks = selectedAgent ? tasks.filter((t) => t.assigned_to === selectedAgent || t.assigned_to?.includes(selectedAgent)) : tasks;

  // Priority color
  const prioColor = (p: string) => p === "HIGH" ? "#ff4444" : p === "MEDIUM" ? "#ffaa00" : "var(--text-tertiary)";
  const statusColor = (s: string) => s === "complete" ? "var(--green)" : s === "in_progress" ? "#ffaa00" : "var(--text-tertiary)";

  return (
    <AuthGate>
      <div className="flex flex-col h-screen" style={{ background: "var(--background)" }}>
        <div className="progress-bar" style={{ transform: "scaleX(1)" }} />

        {/* Header */}
        <header className="glass flex items-center gap-4 px-6 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--green)", letterSpacing: "0.05em", lineHeight: 1 }}>
              AXE LIVE
            </h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Dashboard</Link>
            <Link href="/apps" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Apps</Link>
            <Link href="/live" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Live Feeds</Link>
            <Link href="/team" className="eyebrow" style={{ color: "var(--green)", textDecoration: "none" }}>Team</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => { setShowMessageModal(true); setMessageTo("team"); }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase",
                letterSpacing: "0.15em", background: "transparent", color: "var(--green)",
                border: "1px solid var(--rule)", borderRadius: "4px", padding: "8px 16px",
                minHeight: "36px", cursor: "pointer", transition: "all 150ms",
              }}
            >
              Broadcast
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — Agent roster */}
          <aside className="flex flex-col" style={{ width: 280, borderRight: "1px solid var(--rule)", background: "var(--card)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--rule)" }}>
              <span className="eyebrow">The Family</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* "All" option */}
              <button
                onClick={() => { setSelectedAgent(null); setView("overview"); }}
                className="w-full text-left px-4 py-3"
                style={{
                  background: !selectedAgent ? "var(--surface)" : "transparent",
                  borderBottom: "1px solid var(--rule)",
                  borderLeft: !selectedAgent ? "2px solid var(--green)" : "2px solid transparent",
                  cursor: "pointer", transition: "all 150ms",
                }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                  TEAM OVERVIEW
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginTop: 2 }}>
                  {tasks.filter((t) => t.status !== "complete").length} active tasks
                </span>
              </button>

              {AGENTS.map((a) => {
                const agentTaskCount = tasks.filter((t) => (t.assigned_to === a.id || t.assigned_to?.includes(a.id)) && t.status !== "complete").length;
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAgent(a.id); setView("profile"); }}
                    className="w-full text-left px-4 py-3"
                    style={{
                      background: selectedAgent === a.id ? "var(--surface)" : "transparent",
                      borderBottom: "1px solid var(--rule)",
                      borderLeft: selectedAgent === a.id ? "2px solid var(--green)" : "2px solid transparent",
                      cursor: "pointer", transition: "all 150ms",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--green)" }}>{a.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                            {a.name}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                            {a.callsign}
                          </span>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginTop: 1 }}>
                          {a.machine}
                        </span>
                      </div>
                      {agentTaskCount > 0 && (
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500,
                          background: "var(--green-dim)", color: "var(--green)",
                          borderRadius: "10px", padding: "2px 8px",
                        }}>
                          {agentTaskCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Channel preview */}
            <div style={{ borderTop: "1px solid var(--rule)" }}>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="eyebrow">Team Channel</span>
                <button
                  onClick={() => setView("channel")}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--green)", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em" }}
                >
                  View All
                </button>
              </div>
              <div className="px-4 pb-3" style={{ maxHeight: 120, overflowY: "auto" }}>
                {channel.slice(-4).map((m, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 500, color: "var(--green)" }}>
                      {m.from}
                    </span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--text-tertiary)", marginLeft: 4 }}>
                      {m.msg?.slice(0, 60)}{m.msg?.length > 60 ? "..." : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto px-6 py-6">

            {/* OVERVIEW */}
            {view === "overview" && !selectedAgent && (
              <>
                <div className="mb-8">
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "36px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                    THE AXE FAMILY
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)", display: "block", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                    5 agents · 4 machines · Zero API spend · Perpetual team
                  </span>
                </div>

                {/* Agent cards grid */}
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                  {AGENTS.map((a) => (
                    <div
                      key={a.id}
                      className="glass card-hover rounded-lg overflow-hidden cursor-pointer"
                      style={{ border: "1px solid var(--rule)" }}
                      onClick={() => { setSelectedAgent(a.id); setView("profile"); }}
                    >
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "20px", color: "var(--green)" }}>{a.icon}</span>
                          <div>
                            <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                              {a.name}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", marginLeft: 8, textTransform: "uppercase" }}>
                              "{a.callsign}"
                            </span>
                          </div>
                        </div>
                        <span className="eyebrow" style={{ fontSize: "9px", color: "var(--green)" }}>{a.archetype}</span>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>
                          "{a.quote}"
                        </p>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", marginTop: 8 }}>
                          {a.role}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {a.traits.slice(0, 3).map((t) => (
                            <span key={t} style={{
                              fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase",
                              letterSpacing: "0.1em", color: "var(--green)", background: "var(--green-dim)",
                              borderRadius: "3px", padding: "3px 8px",
                            }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-2" style={{ borderTop: "1px solid var(--rule)" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                          {a.machine} · {a.machineSpec}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Active tasks overview */}
                <div className="mt-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                      ACTIVE TASKS
                    </span>
                    <span className="eyebrow" style={{ color: "var(--text-tertiary)" }}>
                      {tasks.filter((t) => t.status !== "complete").length} open
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {tasks.filter((t) => t.status !== "complete").map((t) => (
                      <div key={t.id} className="glass rounded px-4 py-3 flex items-center gap-4" style={{ border: "1px solid var(--rule)" }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: statusColor(t.status), flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", width: 80, flexShrink: 0 }}>{t.id}</span>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--foreground)", flex: 1 }}>{t.title}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: prioColor(t.priority), textTransform: "uppercase" }}>{t.priority}</span>
                        <span className="eyebrow" style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{t.assigned_to}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* AGENT PROFILE */}
            {view === "profile" && agent && (
              <>
                {/* Agent hero */}
                <div className="mb-8">
                  <div className="flex items-start gap-4">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "48px", color: "var(--green)", lineHeight: 1 }}>{agent.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "42px", color: "var(--foreground)", letterSpacing: "0.03em", lineHeight: 1 }}>
                          {agent.name}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                          "{agent.callsign}"
                        </span>
                      </div>
                      <span className="eyebrow" style={{ fontSize: "11px", marginTop: 4, display: "block" }}>{agent.archetype}</span>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-secondary)", display: "block", marginTop: 8, fontStyle: "italic" }}>
                        "{agent.quote}"
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowMessageModal(true)}
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase",
                          letterSpacing: "0.12em", background: "transparent", color: "var(--foreground)",
                          border: "1px solid var(--rule)", borderRadius: "4px", padding: "8px 14px",
                          minHeight: "36px", cursor: "pointer", transition: "all 150ms",
                        }}
                      >
                        Message
                      </button>
                      <button
                        onClick={() => setShowTaskModal(true)}
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase",
                          letterSpacing: "0.12em", background: "transparent", color: "var(--foreground)",
                          border: "1px solid var(--rule)", borderRadius: "4px", padding: "8px 14px",
                          minHeight: "36px", cursor: "pointer", transition: "all 150ms",
                        }}
                      >
                        Assign Task
                      </button>
                      <button
                        onClick={() => setShowEssenceModal(true)}
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase",
                          letterSpacing: "0.12em", background: "var(--green)", color: "#0A0A0A",
                          border: "none", borderRadius: "4px", padding: "8px 14px",
                          minHeight: "36px", cursor: "pointer", transition: "all 150ms",
                        }}
                      >
                        Edit Personality
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {/* Identity card */}
                  <div className="glass rounded-lg overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                      <span className="eyebrow">Identity</span>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-3">
                      <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Role</span>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--foreground)", display: "block", marginTop: 2 }}>{agent.role}</span>
                      </div>
                      <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Machine</span>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--foreground)", display: "block", marginTop: 2 }}>{agent.machine} · {agent.machineSpec}</span>
                      </div>
                      <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Voice</span>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", display: "block", marginTop: 2, fontStyle: "italic" }}>{agent.voice}</span>
                      </div>
                    </div>
                  </div>

                  {/* Traits card */}
                  <div className="glass rounded-lg overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                      <span className="eyebrow">Core Traits</span>
                    </div>
                    <div className="px-5 py-4 flex flex-wrap gap-2">
                      {agent.traits.map((t) => (
                        <span key={t} style={{
                          fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase",
                          letterSpacing: "0.1em", color: "var(--green)", background: "var(--green-dim)",
                          borderRadius: "4px", padding: "6px 12px",
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tasks for this agent */}
                <div className="glass rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--rule)" }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <span className="eyebrow">Assigned Tasks</span>
                    <button
                      onClick={() => setShowTaskModal(true)}
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase",
                        letterSpacing: "0.12em", background: "transparent", color: "var(--green)",
                        border: "1px solid var(--rule)", borderRadius: "4px", padding: "4px 12px",
                        cursor: "pointer",
                      }}
                    >
                      + New Task
                    </button>
                  </div>
                  <div>
                    {agentTasks.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>No tasks assigned</span>
                      </div>
                    ) : (
                      agentTasks.map((t) => (
                        <div key={t.id} className="px-5 py-3 flex items-center gap-4" style={{ borderBottom: "1px solid var(--rule)" }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: statusColor(t.status), flexShrink: 0 }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", width: 80, flexShrink: 0 }}>{t.id}</span>
                          <div className="flex-1">
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--foreground)" }}>{t.title}</span>
                            {t.notes && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginTop: 2 }}>
                                {t.notes.slice(0, 120)}{t.notes.length > 120 ? "..." : ""}
                              </span>
                            )}
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: prioColor(t.priority), textTransform: "uppercase" }}>{t.priority}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: statusColor(t.status), textTransform: "uppercase" }}>{t.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Full essence */}
                <div className="glass rounded-lg overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <span className="eyebrow">Full Essence File</span>
                    <button
                      onClick={() => setShowEssenceModal(true)}
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase",
                        letterSpacing: "0.12em", background: "transparent", color: "var(--green)",
                        border: "1px solid var(--rule)", borderRadius: "4px", padding: "4px 12px",
                        cursor: "pointer",
                      }}
                    >
                      + Add to Personality
                    </button>
                  </div>
                  <div className="px-5 py-4" style={{ maxHeight: 400, overflowY: "auto" }}>
                    <pre style={{
                      fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)",
                      lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {selectedAgent ? essences[selectedAgent] || "Loading..." : ""}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {/* CHANNEL VIEW */}
            {view === "channel" && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                      TEAM CHANNEL
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginTop: 2 }}>
                      Last {channel.length} messages
                    </span>
                  </div>
                  <button
                    onClick={() => setShowMessageModal(true)}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase",
                      letterSpacing: "0.15em", background: "var(--green)", color: "#0A0A0A",
                      border: "none", borderRadius: "4px", padding: "10px 20px",
                      minHeight: "40px", cursor: "pointer",
                    }}
                  >
                    Send Message
                  </button>
                </div>
                <div ref={channelRef} className="glass rounded-lg overflow-hidden" style={{ border: "1px solid var(--rule)", maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
                  {channel.map((m, i) => (
                    <div key={i} className="px-5 py-3 flex gap-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", flexShrink: 0, width: 56, marginTop: 2 }}>
                        {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, color: "var(--green)", flexShrink: 0, width: 80, marginTop: 1 }}>
                        {m.from}
                      </span>
                      {m.to !== "team" && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", flexShrink: 0, marginTop: 2 }}>
                          → {m.to}
                        </span>
                      )}
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--foreground)", lineHeight: 1.5 }}>
                        {m.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>

        {/* MODAL: Assign Task */}
        {showTaskModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowTaskModal(false)}>
            <div className="glass rounded-lg w-full max-w-md" style={{ border: "1px solid var(--rule)" }} onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--foreground)" }}>
                  ASSIGN TASK {agent ? `TO ${agent.name.toUpperCase()}` : ""}
                </span>
              </div>
              <div className="px-6 py-4 flex flex-col gap-4">
                {!selectedAgent && (
                  <select
                    value={messageTo}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: "12px", background: "var(--background)",
                      border: "1px solid var(--rule)", color: "var(--foreground)", borderRadius: "4px",
                      padding: "10px 12px", minHeight: "44px", outline: "none",
                    }}
                  >
                    {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  style={{
                    fontFamily: "var(--font-body)", fontSize: "14px", background: "var(--background)",
                    border: "1px solid var(--rule)", color: "var(--foreground)", borderRadius: "4px",
                    padding: "12px 16px", minHeight: "44px", outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--green)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--rule)")}
                />
                <div className="flex gap-2">
                  {["LOW", "MEDIUM", "HIGH"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setTaskPriority(p)}
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase",
                        letterSpacing: "0.1em", flex: 1, padding: "8px",
                        background: taskPriority === p ? "var(--green-dim)" : "transparent",
                        color: taskPriority === p ? prioColor(p) : "var(--text-tertiary)",
                        border: `1px solid ${taskPriority === p ? prioColor(p) : "var(--rule)"}`,
                        borderRadius: "4px", cursor: "pointer",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <textarea
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Notes (optional)..."
                  rows={3}
                  style={{
                    fontFamily: "var(--font-body)", fontSize: "13px", background: "var(--background)",
                    border: "1px solid var(--rule)", color: "var(--foreground)", borderRadius: "4px",
                    padding: "12px 16px", outline: "none", resize: "vertical",
                  }}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowTaskModal(false)} style={{
                    flex: 1, fontFamily: "var(--font-mono)", fontSize: "12px", textTransform: "uppercase",
                    background: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--rule)",
                    borderRadius: "4px", padding: "12px", minHeight: "44px", cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                  <button onClick={submitTask} disabled={submitting || !taskTitle.trim()} style={{
                    flex: 2, fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase",
                    background: taskTitle.trim() ? "var(--green)" : "var(--rule)",
                    color: taskTitle.trim() ? "#0A0A0A" : "var(--text-tertiary)",
                    border: "none", borderRadius: "4px", padding: "12px", minHeight: "44px",
                    cursor: taskTitle.trim() ? "pointer" : "default",
                  }}>
                    {submitting ? "..." : "Assign"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Edit Personality */}
        {showEssenceModal && agent && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowEssenceModal(false)}>
            <div className="glass rounded-lg w-full max-w-md" style={{ border: "1px solid var(--rule)" }} onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--foreground)" }}>
                  EDIT {agent.name.toUpperCase()}'S PERSONALITY
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginTop: 4 }}>
                  This appends to their essence file. They'll absorb it on next session.
                </span>
              </div>
              <div className="px-6 py-4 flex flex-col gap-4">
                <textarea
                  value={essenceText}
                  onChange={(e) => setEssenceText(e.target.value)}
                  placeholder={`Add to ${agent.name}'s personality...\n\ne.g. "## New Trait\nYou now also specialize in..."`}
                  rows={8}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: "13px", background: "var(--background)",
                    border: "1px solid var(--rule)", color: "var(--foreground)", borderRadius: "4px",
                    padding: "12px 16px", outline: "none", resize: "vertical", lineHeight: 1.6,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--green)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--rule)")}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowEssenceModal(false)} style={{
                    flex: 1, fontFamily: "var(--font-mono)", fontSize: "12px", textTransform: "uppercase",
                    background: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--rule)",
                    borderRadius: "4px", padding: "12px", minHeight: "44px", cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                  <button onClick={submitEssence} disabled={submitting || !essenceText.trim()} style={{
                    flex: 2, fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase",
                    background: essenceText.trim() ? "var(--green)" : "var(--rule)",
                    color: essenceText.trim() ? "#0A0A0A" : "var(--text-tertiary)",
                    border: "none", borderRadius: "4px", padding: "12px", minHeight: "44px",
                    cursor: essenceText.trim() ? "pointer" : "default",
                  }}>
                    {submitting ? "..." : "Save to Essence"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Send Message */}
        {showMessageModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowMessageModal(false)}>
            <div className="glass rounded-lg w-full max-w-md" style={{ border: "1px solid var(--rule)" }} onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--foreground)" }}>
                  SEND MESSAGE
                </span>
              </div>
              <div className="px-6 py-4 flex flex-col gap-4">
                <select
                  value={messageTo}
                  onChange={(e) => setMessageTo(e.target.value)}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: "12px", background: "var(--background)",
                    border: "1px solid var(--rule)", color: "var(--foreground)", borderRadius: "4px",
                    padding: "10px 12px", minHeight: "44px", outline: "none",
                  }}
                >
                  <option value="team">Everyone (Team)</option>
                  {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Your message..."
                  rows={4}
                  style={{
                    fontFamily: "var(--font-body)", fontSize: "14px", background: "var(--background)",
                    border: "1px solid var(--rule)", color: "var(--foreground)", borderRadius: "4px",
                    padding: "12px 16px", outline: "none", resize: "vertical",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--green)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--rule)")}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowMessageModal(false)} style={{
                    flex: 1, fontFamily: "var(--font-mono)", fontSize: "12px", textTransform: "uppercase",
                    background: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--rule)",
                    borderRadius: "4px", padding: "12px", minHeight: "44px", cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                  <button onClick={submitMessage} disabled={submitting || !messageText.trim()} style={{
                    flex: 2, fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase",
                    background: messageText.trim() ? "var(--green)" : "var(--rule)",
                    color: messageText.trim() ? "#0A0A0A" : "var(--text-tertiary)",
                    border: "none", borderRadius: "4px", padding: "12px", minHeight: "44px",
                    cursor: messageText.trim() ? "pointer" : "default",
                  }}>
                    {submitting ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

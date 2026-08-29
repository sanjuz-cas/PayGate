import React, { useState, useEffect, useRef, useCallback } from "react";
import "./kaam.css";
import { api } from "../api/client";
import type { KaamSessionState, SyntheticDocumentData } from "./types";
import { DEFAULT_SYNTHETIC_DOCUMENT } from "./types";

// ── Icons (inline SVG to avoid extra deps) ──────────────────────────────
const Icon = {
  ArrowUpRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H7M17 7V17"/>
    </svg>
  ),
  Check: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ChevronRight: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  ChevronLeft: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronDown: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Sparkles: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
  Lock: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  MapPin: ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  FileText: ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Shield: ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Clipboard: ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  Upload: ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  Pencil: ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  X: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  RotateCcw: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
    </svg>
  ),
  Zap: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Info: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  Paperclip: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  Bot: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
};

// ── Journey step config ─────────────────────────────────────────────────
const STEPS = [
  { label: "Understand",    note: "Your request" },
  { label: "Requirements",  note: "What to keep ready" },
  { label: "Address proof", note: "Choose a document" },
  { label: "Verification",  note: "A careful check" },
  { label: "Preparation",   note: "Your application" },
  { label: "Ready",         note: "Next steps" },
];
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

const CAPABILITIES = [
  { name: "Passport Rules",       cost: "₹0.10",  icon: "📜" },
  { name: "Document Verification",cost: "₹0.25",  icon: "🔎" },
  { name: "Form Assistant",       cost: "₹0.20",  icon: "📋" },
];

// ── Sub-components ──────────────────────────────────────────────────────

function Logo({ dark = false, onClick }: { dark?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="k-logo"
      onClick={onClick}
      aria-label="Kaam home"
    >
      <span
        className="k-logo-mark"
        style={dark ? { background: "#f5d667", color: "#152e37" } : {}}
      >
        k
      </span>
      <span
        className="k-logo-name"
        style={dark ? { color: "#f7f1e5" } : {}}
      >
        kaam
      </span>
    </button>
  );
}

function SiteHeader({
  view,
  onNavigate,
  onSwitchToPayGate,
}: {
  view: string;
  onNavigate: (v: "home" | "journey" | "providers") => void;
  onSwitchToPayGate: () => void;
}) {
  const onJourney = view === "journey";
  return (
    <header className="k-header">
      <div className="k-header-inner">
        <Logo onClick={() => onNavigate("home")} />
        <nav className="k-header-nav">
          <button
            type="button"
            className={`k-nav-link ${view === "how" ? "active" : ""}`}
            onClick={() => onNavigate("providers")}
          >
            How Kaam works
          </button>
          <button
            type="button"
            className={`k-nav-link ${view === "providers" ? "active" : ""}`}
            onClick={() => onNavigate("providers")}
          >
            For providers
          </button>
          <span className="k-header-badge">
            <Icon.Lock size={12} /> Synthetic demo
          </span>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {onJourney ? (
            <button
              type="button"
              className="k-btn k-btn-ghost"
              onClick={() => onNavigate("home")}
              style={{ fontSize: "0.875rem", fontWeight: 600 }}
            >
              Exit demo <Icon.X size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="k-btn k-btn-primary"
              onClick={() => onNavigate("journey")}
            >
              Try the demo <Icon.ArrowUpRight />
            </button>
          )}
          <button
            type="button"
            onClick={onSwitchToPayGate}
            style={{
              background: "none",
              border: "1px solid #d9d4c8",
              borderRadius: 9999,
              padding: "0.375rem 0.875rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#788383",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            PayGate ↗
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer({ onNavigate }: { onNavigate: (v: "home" | "journey" | "providers") => void }) {
  return (
    <footer className="k-footer">
      <div className="k-footer-inner">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Logo onClick={() => onNavigate("home")} />
          <span style={{ fontSize: "0.75rem", color: "var(--k-dim)" }}>Make the next step clear.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.75rem", color: "var(--k-dim)" }}>
          <button type="button" className="k-btn-ghost k-nav-link" onClick={() => onNavigate("providers")}>How it works</button>
          <span>Built for public good · Powered by PayGate</span>
        </div>
      </div>
    </footer>
  );
}

function CapabilityStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "grid", gap: compact ? "0.5rem" : "0.75rem", gridTemplateColumns: compact ? "1fr" : undefined }}>
      {!compact && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
          {CAPABILITIES.map((cap) => (
            <div key={cap.name} className="k-cap-row">
              <div className="k-cap-icon-wrap">{cap.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--k-ink2)" }}>{cap.name}</p>
              </div>
              <span className="k-cap-cost">{cap.cost}</span>
            </div>
          ))}
        </div>
      )}
      {compact && CAPABILITIES.map((cap) => (
        <div key={cap.name} className="k-cap-row">
          <div className="k-cap-icon-wrap" style={{ width: 28, height: 28, fontSize: "0.875rem" }}>{cap.icon}</div>
          <span style={{ flex: 1, fontSize: "0.6875rem", fontWeight: 600, color: "var(--k-ink2)" }}>{cap.name}</span>
          <span className="k-cap-cost">{cap.cost}</span>
        </div>
      ))}
    </div>
  );
}

// ── Home Page ───────────────────────────────────────────────────────────
function HomePage({ onStart }: { onStart: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("Renew my passport. My address has changed.");
  const [showDetails, setShowDetails] = useState(false);

  return (
    <main style={{ flex: 1 }}>
      {/* Hero */}
      <div className="k-hero">
        <div className="k-hero-glow" />
        <div className="k-hero-grid">
          <div>
            <div className="k-hero-eyebrow k-rise">
              <span className="k-hero-line" />
              <span className="k-wordmark">A calmer way through public work</span>
            </div>
            <h1 className="k-hero-h1 k-rise k-rise-1">
              The next step<br />
              <span>is clearer now.</span>
            </h1>
            <p className="k-hero-desc k-rise k-rise-2">
              Kaam turns complicated government work into a short, guided path. Tell us what changed. We'll help you understand what to do next.
            </p>
            <div className="k-hero-cta k-rise k-rise-3">
              <button
                type="button"
                className="k-btn k-btn-primary"
                onClick={() => onStart(prompt)}
              >
                Start with a real-life task <Icon.ArrowUpRight />
              </button>
              <button type="button" className="k-btn-link" style={{ color: "var(--k-ink2)" }}>
                See how it works <Icon.ChevronRight size={14} />
              </button>
            </div>
            <div className="k-hero-note k-rise k-rise-4">
              <Icon.Lock size={12} />
              No login. No live submission. Just a guided demo.
            </div>
          </div>

          {/* Card widget */}
          <div className="k-hero-card-wrap k-drift">
            <div className="k-dot-grid" />
            <div className="k-hero-card-outer">
              <div className="k-hero-card-inner">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span className="k-wordmark">Start anywhere</span>
                    <h2 style={{ marginTop: "0.5rem", fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--k-ink)" }}>
                      What are you trying to get done?
                    </h2>
                  </div>
                  <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--k-ink)", color: "var(--k-gold)" }}>
                    <Icon.Sparkles size={16} />
                  </span>
                </div>

                <label htmlFor="home-prompt" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                  Describe what you need
                </label>
                <textarea
                  id="home-prompt"
                  className="k-task-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />

                <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--k-muted)" }}>
                    A synthetic example with a clear outcome.
                  </span>
                  <button
                    type="button"
                    className="k-btn k-btn-gold"
                    onClick={() => onStart(prompt)}
                    style={{ flexShrink: 0 }}
                  >
                    Continue <Icon.ChevronRight size={12} />
                  </button>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--k-border2)", paddingTop: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 600, color: "var(--k-ink3)" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Icon.Info size={12} /> What happens in this demo?
                    </span>
                    <span style={{ transform: showDetails ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <Icon.ChevronDown size={14} />
                    </span>
                  </button>
                  {showDetails && (
                    <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", lineHeight: 1.6, color: "var(--k-muted)" }}>
                      Kaam reads the situation, finds the relevant requirements, and checks a sample address proof. It never connects to a government system.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="k-hero-card-badge">
              <p className="badge-label">Typical first step</p>
              <p className="badge-text">Know what to keep ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* How strip */}
      <section className="k-strip">
        <div className="k-strip-inner">
          <div>
            <span className="k-wordmark">One small task</span>
            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: "0.75rem", fontSize: "1.875rem", lineHeight: 1.2, letterSpacing: "-0.04em", color: "var(--k-ink)" }}>
              No portals to learn.<br />No maze to remember.
            </h2>
          </div>
          <div className="k-strip-steps">
            {[
              { num: "01", title: "Say it plainly", desc: "Start with the thing you need, in your own words." },
              { num: "02", title: "See the why", desc: "Every requirement comes with a plain-language reason." },
              { num: "03", title: "Leave ready", desc: "Finish with a plan you can actually act on." },
            ].map((s) => (
              <div key={s.num}>
                <span className="k-mono" style={{ fontSize: "1.5rem", color: "var(--k-amber)" }}>{s.num}</span>
                <h3 style={{ marginTop: "0.5rem", fontWeight: 700, color: "var(--k-ink2)" }}>{s.title}</h3>
                <p style={{ marginTop: "0.375rem", fontSize: "0.875rem", lineHeight: 1.5, color: "var(--k-dim)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Budget section */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "5rem 2rem" }}>
        <div style={{ display: "grid", gap: "3rem", alignItems: "end" }}>
          <div>
            <span className="k-wordmark">A little more transparent</span>
            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: "1rem", fontSize: "clamp(2rem,4vw,3rem)", lineHeight: 1.05, letterSpacing: "-0.05em", color: "var(--k-ink)" }}>
              Good help should<br />show its work.
            </h2>
            <p style={{ marginTop: "1.25rem", maxWidth: 460, lineHeight: 1.75, color: "var(--k-ink3)" }}>
              Kaam is powered by small, focused capabilities. You can see what ran and exactly what each one cost.
            </p>
          </div>
          <div style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--k-border)", background: "var(--k-cream)", padding: "1.25rem 1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--k-ink2)" }}>A sample task budget</span>
              <span className="k-info-pill">₹2.00 available</span>
            </div>
            <CapabilityStrip />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--k-border2)", marginTop: "1.25rem", paddingTop: "1.25rem" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--k-muted)" }}>Estimated use for this task</span>
              <span className="k-mono" style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--k-ink)" }}>₹0.55</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-xl)", background: "var(--k-ink)", padding: "3rem", color: "var(--k-cream)" }}>
          <div style={{ position: "absolute", right: "-3.5rem", top: "-5rem", width: 256, height: 256, borderRadius: "50%", border: "38px solid rgba(245,214,103,.2)" }} />
          <div style={{ position: "relative", maxWidth: 650 }}>
            <span className="k-wordmark" style={{ color: "rgba(245,214,103,.7)" }}>Built around people, not paperwork</span>
            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: "1rem", fontSize: "clamp(2rem,4vw,3rem)", lineHeight: 1.15, letterSpacing: "-0.05em" }}>
              Start with the one thing you need to do.
            </h2>
            <button
              type="button"
              className="k-btn k-btn-gold"
              style={{ marginTop: "2rem", padding: "0.75rem 1.25rem", fontSize: "0.875rem" }}
              onClick={() => onStart(prompt)}
            >
              Try the passport demo <Icon.ArrowUpRight />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

// ── Journey Rail ────────────────────────────────────────────────────────
function JourneyRail({
  current,
  totalSpent,
}: {
  current: StepIndex;
  totalSpent: number;
}) {
  const pct = Math.min((totalSpent / 2.0) * 100, 100);
  return (
    <aside className="k-rail">
      <div className="k-rail-sticky">
        <span className="k-wordmark">Your path</span>
        <ol>
          {STEPS.map((step, idx) => {
            const done = idx < current;
            const active = idx === current;
            const state = done ? "done" : active ? "active" : "future";
            return (
              <li key={step.label} className="k-rail-item">
                {idx < STEPS.length - 1 && (
                  <span
                    className="k-rail-line"
                    style={{ background: done ? "var(--k-amber)" : "var(--k-border)" }}
                  />
                )}
                <span className={`k-rail-dot ${state}`}>
                  {done ? <Icon.Check size={10} /> : idx + 1}
                </span>
                <div>
                  <p className={`k-rail-label-main ${state}`}>{step.label}</p>
                  <p className="k-rail-label-sub">{step.note}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="k-budget-box">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Icon.Zap size={14} />
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--k-ink2)" }}>Task budget</p>
          </div>
          <p className="k-budget-amount">₹2.00</p>
          <div className="k-budget-bar">
            <div className="k-budget-fill" style={{ width: `${pct}%` }} />
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--k-muted)" }}>₹0.55 estimated for this path</p>
        </div>
      </div>
    </aside>
  );
}

// ── Journey Page ────────────────────────────────────────────────────────
function JourneyPage({
  session,
  onReset,
  onExecuteCheckRequirements,
  onSelectDocument,
  onExecuteVerifyDocument,
  onExecutePrepareForm,
}: {
  session: KaamSessionState;
  onReset: () => void;
  onExecuteCheckRequirements: () => Promise<void>;
  onSelectDocument: (doc: SyntheticDocumentData) => void;
  onExecuteVerifyDocument: () => Promise<void>;
  onExecutePrepareForm: () => Promise<void>;
}) {
  const [current, setCurrent] = useState<StepIndex>(0);
  const [proofChoice, setProofChoice] = useState<"sample" | "upload" | null>(null);
  const [uploadedName, setUploadedName] = useState("");
  const [verifyPhase, setVerifyPhase] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [name, setName] = useState("Arjun Menon");
  const [address, setAddress] = useState("12 Lake View Road, Kochi, Kerala 682001");
  const [apiError, setApiError] = useState("");

  // Sync step with session
  useEffect(() => {
    if (session.step === "understanding") setCurrent(0);
    else if (session.step === "requirements") setCurrent(1);
    else if (session.step === "document_selection") setCurrent(2);
    else if (session.step === "verification") setCurrent(3);
    else if (session.step === "form_preparation") setCurrent(4);
  }, [session.step]);

  // Simulate verification phases
  useEffect(() => {
    if (session.isExecuting && session.activeCapability === "document_verification") {
      setVerifyPhase(0);
      const timers = [350, 700, 1050].map((d, i) =>
        window.setTimeout(() => setVerifyPhase(i + 1), d)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [session.isExecuting, session.activeCapability]);

  const isBusy = session.isExecuting;
  const pct = ((current + 1) / STEPS.length) * 100;

  const titles = [
    "Let's understand the change.",
    "Here's what the passport office will need.",
    "One address proof is enough for this path.",
    "A careful check, then you're on your way.",
    "Your application details, made legible.",
    "You're ready for the next step.",
  ];
  const descs = [
    "You want to reissue your passport because your current address changed. We'll map that to the right kind of application — without sending anything anywhere.",
    "For a reissue after an address change, keep your current passport and one recent address proof. We'll use a sample bill so you can see the complete path.",
    "Choose the sample electricity bill to keep going, or attach your own file. This demo reads only local, synthetic data.",
    "We look for the details that matter: your name, service address, and a recent bill date. This is a demo check, not an official submission.",
    "We've organized the details into a simple preview. Review them once, then take the final step on the official portal when you're ready.",
    "Your path is clear. You know what to keep ready, what was checked, and where the official handoff happens.",
  ];

  const handleNext = async () => {
    setApiError("");
    if (current === 0) {
      await onExecuteCheckRequirements();
    } else if (current === 1) {
      setCurrent(2);
    } else if (current === 2) {
      setCurrent(3);
    } else if (current === 3 && session.step === "verification") {
      setCurrent(4);
    } else if (current === 4) {
      await onExecutePrepareForm();
    } else {
      setCurrent((v) => Math.min(5, v + 1) as StepIndex);
    }
  };

  const handleRunVerification = async () => {
    if (proofChoice === "sample") {
      onSelectDocument(DEFAULT_SYNTHETIC_DOCUMENT);
    }
    setApiError("");
    await onExecuteVerifyDocument();
  };

  const canNext =
    !isBusy &&
    !(current === 2 && !proofChoice) &&
    !(current === 3 && session.step !== "verification");

  const verifyState =
    session.isExecuting && session.activeCapability === "document_verification"
      ? "running"
      : session.step === "verification"
      ? "success"
      : "idle";

  return (
    <div className="k-journey">
      <div className="k-journey-main">
        <JourneyRail current={current} totalSpent={session.totalSpentInr} />

        <div className="k-journey-content">
          {/* Mobile progress */}
          <div className="k-mobile-progress">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="k-wordmark">Step {String(current + 1).padStart(2, "0")} / 06</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--k-muted)" }}>{STEPS[current].label}</span>
            </div>
            <div className="k-mobile-bar">
              <div className="k-mobile-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Top nav row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button" className="k-btn-link" onClick={onReset} style={{ fontSize: "0.75rem" }}>
              <Icon.ChevronLeft size={14} /> Start over
            </button>
            <button type="button" className="k-btn-link" onClick={onReset} style={{ fontSize: "0.75rem" }}>
              <Icon.RotateCcw size={12} /> Reset demo
            </button>
          </div>

          {/* Step heading */}
          <div className="k-rise" key={current} style={{ marginTop: "2.5rem" }}>
            <span className="k-synthetic-tag">
              <Icon.Sparkles size={10} /> Synthetic demo data
            </span>
            <h1 className="k-step-heading">{titles[current]}</h1>
            <p className="k-step-desc">{descs[current]}</p>
          </div>

          {/* Error */}
          {(apiError || session.errorMessage) && (
            <div className="k-error-box" style={{ marginTop: "1.5rem" }}>
              <span>{apiError || session.errorMessage}</span>
              <button
                type="button"
                className="k-btn-ghost"
                onClick={() => setApiError("")}
                style={{ padding: "0.25rem" }}
              >
                <Icon.X size={14} />
              </button>
            </div>
          )}

          {/* ── Step 0: Understand ─────────────────────────────────────── */}
          {current === 0 && (
            <div className="k-card" style={{ marginTop: "2.5rem" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "0.75rem", background: "var(--k-ink)", color: "var(--k-gold)", flexShrink: 0 }}>
                  <Icon.MapPin size={18} />
                </span>
                <div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--k-ink)" }}>The task we're mapping</p>
                  <p style={{ marginTop: "0.5rem", fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.03em", color: "var(--k-ink2)" }}>
                    {session.userPrompt}
                  </p>
                  <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.625, color: "var(--k-dim)" }}>
                    That usually means a passport reissue with an address update. We'll stay with you through the prep work.
                  </p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", borderTop: "1px solid var(--k-border)", marginTop: "1.75rem", paddingTop: "1.25rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--k-cream)", padding: "0.875rem" }}>
                  <p style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--k-muted)" }}>Applicant</p>
                  <p style={{ marginTop: "0.25rem", fontWeight: 600, color: "var(--k-ink2)" }}>Arjun Menon</p>
                </div>
                <div style={{ borderRadius: "0.75rem", background: "var(--k-cream)", padding: "0.875rem" }}>
                  <p style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--k-muted)" }}>New city</p>
                  <p style={{ marginTop: "0.25rem", fontWeight: 600, color: "var(--k-ink2)" }}>Kochi, Kerala</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Requirements ───────────────────────────────────── */}
          {current === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "2.5rem" }}>
              {[
                { label: "Current passport", note: "The passport being reissued" },
                { label: "One recent address proof", note: "Electricity, water, gas, or bank statement" },
                { label: "A little time to review", note: "The official application still happens on the government portal" },
              ].map((req) => (
                <div key={req.label} className="k-req-item">
                  <span className="k-req-icon"><Icon.FileText size={18} /></span>
                  <div>
                    <p style={{ fontWeight: 700, color: "var(--k-ink2)" }}>{req.label}</p>
                    <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--k-muted)" }}>{req.note}</p>
                  </div>
                  <span style={{ marginLeft: "auto", color: "var(--k-amber)", flexShrink: 0 }}>
                    <Icon.Check size={14} />
                  </span>
                </div>
              ))}
              <div className="k-info-box" style={{ marginTop: "0.5rem" }}>
                <strong>Why this list?</strong> The address proof connects your name to where you live now. We'll show a synthetic example next.
              </div>
            </div>
          )}

          {/* ── Step 2: Document Selection ─────────────────────────────── */}
          {current === 2 && (
            <div style={{ marginTop: "2.5rem" }}>
              <div className="k-doc-grid">
                <button
                  type="button"
                  className={`k-doc-btn ${proofChoice === "sample" ? "selected" : ""}`}
                  onClick={() => { setProofChoice("sample"); setUploadedName(""); }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="k-req-icon"><Icon.FileText size={18} /></span>
                    {proofChoice === "sample" && (
                      <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--k-amber)", color: "#fff" }}>
                        <Icon.Check size={12} />
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: "1.5rem", fontWeight: 700, color: "var(--k-ink)" }}>Use the sample bill</p>
                  <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", lineHeight: 1.5, color: "var(--k-dim)" }}>
                    A fictional KSEB electricity bill for Arjun's Kochi address.
                  </p>
                </button>
                <label
                  className={`k-doc-btn ${proofChoice === "upload" ? "selected" : ""}`}
                  style={{ display: "block", cursor: "pointer" }}
                >
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setProofChoice("upload"); setUploadedName(f.name); }
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="k-req-icon"><Icon.Upload size={18} /></span>
                    {proofChoice === "upload" && (
                      <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--k-amber)", color: "#fff" }}>
                        <Icon.Check size={12} />
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: "1.5rem", fontWeight: 700, color: "var(--k-ink)" }}>Choose a document</p>
                  <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", lineHeight: 1.5, color: "var(--k-dim)" }}>
                    Upload a PDF or image. It stays in this demo.
                  </p>
                </label>
              </div>
              {proofChoice && (
                <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", borderRadius: "var(--r-md)", border: "1px solid #cbd9c5", background: "#e6f0e1", padding: "1rem" }}>
                  <Icon.Paperclip size={14} />
                  <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--k-green)" }}>Selected for verification</p>
                    <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--k-green2)" }}>
                      {uploadedName || "KSEB_electricity_bill_demo.pdf"}
                    </p>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", fontSize: "0.75rem", lineHeight: 1.5, color: "var(--k-muted)" }}>
                <Icon.Lock size={12} />
                <span>Your file is used only to illustrate this path. Nothing is uploaded to a government system.</span>
              </div>
            </div>
          )}

          {/* ── Step 3: Verification ───────────────────────────────────── */}
          {current === 3 && (
            <div className="k-card" style={{ marginTop: "2.5rem" }}>
              {verifyState === "idle" && (
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                    <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "0.75rem", background: "var(--k-gold)", color: "var(--k-ink)", flexShrink: 0 }}>
                      <Icon.Shield size={18} />
                    </span>
                    <div>
                      <p style={{ fontWeight: 700, color: "var(--k-ink)" }}>Ready for a document check</p>
                      <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", lineHeight: 1.625, color: "var(--k-dim)" }}>
                        We'll look for the name, service address, and bill date in the selected synthetic document.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="k-btn k-btn-primary"
                    style={{ marginTop: "1.75rem" }}
                    onClick={handleRunVerification}
                    disabled={isBusy}
                  >
                    Check this document <Icon.ArrowUpRight />
                  </button>
                </div>
              )}
              {verifyState === "running" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span className="k-pulse" style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "50%", background: "var(--k-gold)", color: "var(--k-ink)", flexShrink: 0 }}>
                      <Icon.Shield size={18} />
                    </span>
                    <div>
                      <p style={{ fontWeight: 700, color: "var(--k-ink)" }}>Checking your document…</p>
                      <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "var(--k-dim)" }}>
                        A focused capability is working through the few details that matter.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: "1px solid var(--k-border)", marginTop: "1.5rem", paddingTop: "1.25rem" }}>
                    {["Finding verification capability…", "DocumentCheck found", "Checking task budget… Approved", "Verifying document…"].map((line, i) => (
                      <div key={line} className="k-verify-step" style={{ opacity: i <= verifyPhase ? 1 : 0.35 }}>
                        <span className={`k-verify-dot ${i < verifyPhase ? "done" : i === verifyPhase ? "active" : "pending"}`}>
                          {i < verifyPhase ? <Icon.Check size={10} /> : <span className="k-blink" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />}
                        </span>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {verifyState === "success" && (
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                    <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "50%", background: "var(--k-green3)", color: "var(--k-green)", flexShrink: 0 }}>
                      <Icon.Check size={18} />
                    </span>
                    <div>
                      <p style={{ fontWeight: 700, color: "var(--k-green)" }}>This looks right for the demo.</p>
                      <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", lineHeight: 1.625, color: "var(--k-green2)" }}>
                        Name and address match the task. The bill is recent enough for this example.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", borderTop: "1px solid var(--k-border)", marginTop: "1.5rem", paddingTop: "1.25rem" }}>
                    {["Arjun Menon", "Kochi address", "Recent bill"].map((label) => (
                      <div key={label} className="k-check-line">
                        <span className="k-check-dot"><Icon.Check size={10} /></span>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Form Preparation ───────────────────────────────── */}
          {current === 4 && (
            <div style={{ marginTop: "2.5rem" }}>
              <div className="k-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span className="k-wordmark">Application preview</span>
                    <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "var(--k-muted)" }}>Edit the synthetic details if you like.</p>
                  </div>
                  <Icon.Pencil size={18} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--k-ink3)" }}>
                    Applicant name
                    <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--k-ink3)" }}>
                    New address
                    <input className="k-input" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="k-info-box" style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
                <Icon.Info size={14} />
                <span>This preview is for planning only. Kaam will never submit these details for you in this demo.</span>
              </div>
            </div>
          )}

          {/* ── Step 5: Ready ─────────────────────────────────────────── */}
          {current === 5 && (
            <div style={{ marginTop: "2.5rem" }}>
              <div className="k-success-card">
                <div className="k-success-ring" />
                <div style={{ position: "relative" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: "50%", background: "var(--k-gold)", color: "var(--k-ink)" }}>
                    <Icon.Check size={24} />
                  </span>
                  <h2 className="k-serif" style={{ marginTop: "1.75rem", fontSize: "clamp(2rem,5vw,3rem)", lineHeight: 1.1, letterSpacing: "-0.05em" }}>
                    You're ready.
                  </h2>
                  <p style={{ marginTop: "1rem", maxWidth: 530, fontSize: "0.9375rem", lineHeight: 1.75, color: "#b9c6c4" }}>
                    Your address change is understood, the right proof is clear, and your details are organized. The final application belongs on the official passport portal.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginTop: "2rem" }}>
                    {["Task understood", "Proof checked", "Details prepared"].map((l) => (
                      <div key={l} style={{ borderRadius: "0.75rem", border: "1px solid #44616a", padding: "0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#d5e0dc" }}>
                        <Icon.Check size={14} />
                        <div style={{ marginTop: "0.5rem" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWhy(!showWhy)}
                    style={{ marginTop: "2.25rem", display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #44616a", paddingTop: "1.25rem", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 600, color: "var(--k-gold)", borderColor: "#44616a", borderTopStyle: "solid", borderTopWidth: 1 }}
                  >
                    <span>How Kaam worked</span>
                    <span style={{ transform: showWhy ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <Icon.ChevronDown size={14} />
                    </span>
                  </button>
                  {showWhy && (
                    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem", lineHeight: 1.625, color: "#b9c6c4" }}>
                      <p><strong style={{ color: "var(--k-cream)" }}>Understood:</strong> mapped your words to a passport reissue after an address change.</p>
                      <p><strong style={{ color: "var(--k-cream)" }}>Found:</strong> surfaced one current passport and one recent address proof.</p>
                      <p><strong style={{ color: "var(--k-cream)" }}>Checked:</strong> read the synthetic bill and matched the key details.</p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" className="k-btn k-btn-gold" style={{ padding: "0.75rem 1.25rem", fontSize: "0.875rem" }} onClick={onReset}>
                  Run it again <Icon.RotateCcw size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Nav row */}
          {current < 5 && (
            <div className="k-nav-row">
              <button
                type="button"
                className="k-btn-link"
                onClick={() => setCurrent((v) => Math.max(0, v - 1) as StepIndex)}
                disabled={current === 0 || isBusy}
                style={{ opacity: current === 0 || isBusy ? 0.35 : 1 }}
              >
                <Icon.ChevronLeft size={14} /> Back
              </button>
              <button
                type="button"
                className="k-btn k-btn-primary"
                onClick={handleNext}
                disabled={!canNext}
              >
                {isBusy ? (
                  <><span className="k-spinner" /> Working…</>
                ) : current === 4 ? (
                  <>See your next step <Icon.ChevronRight size={14} /></>
                ) : (
                  <>Continue <Icon.ChevronRight size={14} /></>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right aside */}
        <aside className="k-aside">
          <div className="k-aside-sticky">
            <div className="k-card">
              <span className="k-wordmark">In this demo</span>
              <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.625, color: "var(--k-ink3)" }}>
                A fictional passport reissue for <strong style={{ color: "var(--k-ink2)" }}>Arjun Menon</strong>, moving to a new address in Kochi.
              </p>
              <div style={{ marginTop: "1.25rem", borderRadius: "0.75rem", background: "var(--k-cream)", padding: "0.875rem" }}>
                <span className="k-synthetic-tag"><Icon.Sparkles size={10} /> Synthetic demo data</span>
                <p style={{ marginTop: "0.75rem", fontSize: "0.6875rem", lineHeight: 1.5, color: "var(--k-muted)" }}>
                  No official credentials. No live systems. No real document processing.
                </p>
              </div>

              <div className="k-ledger">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="k-wordmark">What ran</span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--k-muted)" }}>This demo</span>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  {CAPABILITIES.map((cap) => (
                    <div key={cap.name} className="k-ledger-row">
                      <span style={{ color: "var(--k-ink3)" }}>{cap.name}</span>
                      <span className="k-mono" style={{ color: "var(--k-amber)" }}>{cap.cost}</span>
                    </div>
                  ))}
                  <div className="k-ledger-total">
                    <span>Total</span>
                    <span className="k-mono">₹0.55</span>
                  </div>
                </div>
                <p style={{ marginTop: "1rem", fontSize: "0.625rem", lineHeight: 1.5, color: "var(--k-muted)" }}>
                  Infrastructure by <strong style={{ color: "var(--k-ink2)" }}>PayGate</strong>.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Autonomous Agent Overlay ─────────────────────────────────────────────
interface AgentStep {
  stepNumber: number;
  modelReasoning: string;
  toolCall?: { name: string; input: Record<string, unknown> };
  toolResult?: { success: boolean; txid?: string; error?: string };
  status: "running" | "completed";
}

interface PendingDecision {
  id: string;
  message: string;
}

function AgentOverlay({
  steps,
  pendingDecision,
  isStreaming,
  onClose,
  onDecision,
}: {
  steps: AgentStep[];
  pendingDecision: PendingDecision | null;
  isStreaming: boolean;
  onClose: () => void;
  onDecision: (allowed: boolean) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [steps.length]);

  return (
    <div className="k-overlay">
      <div className="k-overlay-header">
        <div className="k-overlay-title">
          <span className={`k-overlay-dot ${isStreaming ? "" : "idle"}`} />
          <Icon.Bot size={13} />
          <span>Autonomous Agent</span>
          {isStreaming && <span className="k-spinner" />}
          {!isStreaming && steps.length === 0 && (
            <span style={{ fontSize: "0.6875rem", color: "#475569", fontWeight: 400 }}>— ready</span>
          )}
          {!isStreaming && steps.length > 0 && (
            <span style={{ fontSize: "0.6875rem", color: "#34d399", fontWeight: 400 }}>— {steps.length} steps complete</span>
          )}
        </div>
        <button
          type="button"
          className="k-btn-ghost"
          onClick={onClose}
          style={{ color: "#94a3b8", padding: "0.25rem" }}
        >
          <Icon.X size={14} />
        </button>
      </div>
      <div className="k-overlay-body" ref={bodyRef}>
        {steps.length === 0 && !pendingDecision && (
          <div className="k-overlay-idle">
            {isStreaming ? "Agent is starting…" : "Agent is ready. Start a task to see autonomous steps here."}
          </div>
        )}
        {steps.map((step) => (
          <div key={step.stepNumber} className="k-agent-step">
            <div className="k-agent-step-header">
              <span className={`k-agent-num ${step.status === "running" ? "running" : "done"}`}>
                {step.status === "running" ? "…" : <Icon.Check size={8} />}
              </span>
              <span>Step {step.stepNumber}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.5625rem", color: "#334155" }}>
                {step.status === "running" ? "in progress" : "done"}
              </span>
            </div>
            {step.modelReasoning && (
              <p className="k-agent-reasoning">{step.modelReasoning}</p>
            )}
            {step.toolCall && (
              <div className="k-agent-tool-row">
                <span style={{ color: "#64748b" }}>tool:</span>
                <span className="k-agent-tool-name">{step.toolCall.name}</span>
                {step.toolResult && (
                  <span className={step.toolResult.success ? "k-agent-tool-ok" : "k-agent-tool-err"}>
                    {step.toolResult.success ? "✓ ok" : `✗ ${step.toolResult.error}`}
                  </span>
                )}
                {step.toolResult?.txid && (
                  <span style={{ color: "#475569" }}>· tx:{step.toolResult.txid.slice(-8)}</span>
                )}
              </div>
            )}
            <hr className="k-agent-divider" />
          </div>
        ))}
        {pendingDecision && (
          <div className="k-decision-prompt">
            <div className="k-decision-title">
              ⚠ Critical action required
            </div>
            <p className="k-decision-msg">{pendingDecision.message}</p>
            <div className="k-decision-btns">
              <button type="button" className="k-dec-approve" onClick={() => onDecision(true)}>
                Approve
              </button>
              <button type="button" className="k-dec-deny" onClick={() => onDecision(false)}>
                Deny
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────
interface KaamAppProps {
  onSwitchToPayGate: () => void;
}

const INITIAL_SESSION: KaamSessionState = {
  step: "landing",
  userPrompt: "Renew my passport. My address has changed.",
  interpretedGoal: "Passport reissue + change of current address",
  taskBudgetInr: 2.0,
  totalSpentInr: 0,
  selectedDocument: DEFAULT_SYNTHETIC_DOCUMENT,
  capabilitiesUsed: [],
  isExecuting: false,
  simulatedErrorState: "none",
  isLiveApi: true,
};

export function KaamApp({ onSwitchToPayGate }: KaamAppProps) {
  const [view, setView] = useState<"home" | "journey" | "providers">("home");
  const [session, setSession] = useState<KaamSessionState>(INITIAL_SESSION);

  // Overlay state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE autonomous stream
  const startAutonomousTask = useCallback((taskPrompt: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setAgentSteps([]);
    setPendingDecision(null);
    setIsStreaming(true);
    setOverlayOpen(true);

    const es = new EventSource(
      `/actions/kaam/stream?taskDescription=${encodeURIComponent(taskPrompt)}`
    );
    eventSourceRef.current = es;

    es.addEventListener("started", () => {
      setIsStreaming(true);
    });

    es.addEventListener("step_started", (e: MessageEvent) => {
      const step = JSON.parse(e.data) as AgentStep;
      setAgentSteps((prev) => {
        const exists = prev.find((s) => s.stepNumber === step.stepNumber);
        if (exists) return prev;
        return [...prev, { ...step, status: "running" }];
      });
    });

    es.addEventListener("step_completed", (e: MessageEvent) => {
      const step = JSON.parse(e.data) as AgentStep;
      setAgentSteps((prev) =>
        prev.map((s) =>
          s.stepNumber === step.stepNumber ? { ...step, status: "completed" } : s
        )
      );
    });

    es.addEventListener("critical_prompt", (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      setPendingDecision(payload);
    });

    es.addEventListener("final_answer", () => {
      setIsStreaming(false);
      es.close();
    });

    es.addEventListener("done", () => {
      setIsStreaming(false);
      es.close();
    });

    es.addEventListener("error_event", () => {
      setIsStreaming(false);
      es.close();
    });

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
    };
  }, []);

  const handleDecision = useCallback(async (allowed: boolean) => {
    if (!pendingDecision) return;
    try {
      await fetch("/actions/kaam/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: allowed ? "approve" : "deny", decisionId: pendingDecision.id }),
      });
    } catch {
      // ignore
    }
    setPendingDecision(null);
  }, [pendingDecision]);

  function handleStartTask(prompt: string) {
    setSession((prev) => ({
      ...prev,
      userPrompt: prompt,
      interpretedGoal: "Passport reissue + change of current address",
      step: "understanding",
      totalSpentInr: 0,
    }));
    setView("journey");
    startAutonomousTask(prompt);
  }

  function handleReset() {
    setSession({ ...INITIAL_SESSION });
    setView("home");
    setAgentSteps([]);
    setPendingDecision(null);
    setIsStreaming(false);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  async function handleExecuteCheckRequirements() {
    setSession((prev) => ({ ...prev, isExecuting: true, activeCapability: "passport_requirement_lookup" }));
    try {
      const result = await api.getPassportRequirements("reissue_address_change");
      await new Promise((r) => setTimeout(r, 600));
      setSession((prev) => ({
        ...prev,
        isExecuting: false,
        step: "requirements",
        totalSpentInr: prev.totalSpentInr + 0.1,
        requirements: result,
        capabilitiesUsed: [
          ...prev.capabilitiesUsed,
          {
            capabilityName: "passport_requirement_lookup",
            displayName: "Passport Rules & Requirements",
            priceInr: "₹0.10",
            priceUsdc: 0.0012,
            status: "completed",
            executedAt: new Date().toISOString(),
            resultSummary: "Mandatory address proof requirement identified",
            reasonSelected: "Kaam discovered PassportRules to verify documentation checklist.",
          },
        ],
      }));
    } catch {
      await new Promise((r) => setTimeout(r, 700));
      setSession((prev) => ({
        ...prev,
        isExecuting: false,
        step: "requirements",
        totalSpentInr: prev.totalSpentInr + 0.1,
        requirements: {
          serviceType: "reissue_address_change",
          summary: "Passport reissue requested due to change in current residential address.",
          mandatoryDocumentRequired: "Proof of Current Address is mandatory.",
          acceptableProofTypes: ["Electricity Bill (within last 3 months)", "Bank Account Statement / Passbook", "Registered Rent Agreement", "Water Bill", "Telephone / Broadband Bill"],
          disclaimer: "Demo guidance based on synthetic rules.",
          estimatedFeeInr: 0.1,
        },
        capabilitiesUsed: [...prev.capabilitiesUsed, { capabilityName: "passport_requirement_lookup", displayName: "Passport Rules", priceInr: "₹0.10", priceUsdc: 0.0012, status: "completed", executedAt: new Date().toISOString(), resultSummary: "Requirements identified", reasonSelected: "" }],
      }));
    }
  }

  function handleSelectDocument(doc: SyntheticDocumentData) {
    setSession((prev) => ({ ...prev, selectedDocument: doc }));
  }

  async function handleExecuteVerifyDocument() {
    setSession((prev) => ({ ...prev, isExecuting: true, activeCapability: "document_verification" }));
    try {
      const result = await api.verifyDocument({
        documentType: session.selectedDocument.documentType,
        rawText: session.selectedDocument.rawText,
      });
      await new Promise((r) => setTimeout(r, 1400));
      setSession((prev) => ({
        ...prev,
        isExecuting: false,
        step: "verification",
        totalSpentInr: prev.totalSpentInr + 0.25,
        verificationResult: result,
        capabilitiesUsed: [...prev.capabilitiesUsed, { capabilityName: "document_verification", displayName: "Document & Address Verification", priceInr: "₹0.25", priceUsdc: 0.003, status: "completed", executedAt: new Date().toISOString(), resultSummary: "Address proof confirmed with 98% confidence", reasonSelected: "" }],
      }));
    } catch {
      await new Promise((r) => setTimeout(r, 1400));
      setSession((prev) => ({
        ...prev,
        isExecuting: false,
        step: "verification",
        totalSpentInr: prev.totalSpentInr + 0.25,
        verificationResult: { valid: true, confidence: 0.98, detectedName: "Arjun Menon", detectedAddress: "12 Lake View Road, Kochi, Kerala 682001", detectedDate: "15 August 2026", readable: true, addressInfoPresent: true, issues: [], capabilityUsed: "document_verification", reasonForSelection: "" },
        capabilitiesUsed: [...prev.capabilitiesUsed, { capabilityName: "document_verification", displayName: "Document & Address Verification", priceInr: "₹0.25", priceUsdc: 0.003, status: "completed", executedAt: new Date().toISOString(), resultSummary: "Address proof confirmed", reasonSelected: "" }],
      }));
    }
  }

  async function handleExecutePrepareForm() {
    setSession((prev) => ({ ...prev, isExecuting: true, activeCapability: "passport_form_assistance" }));
    try {
      const result = await api.passportFormAssist({
        applicantName: session.selectedDocument.name,
        currentAddress: session.selectedDocument.address,
        serviceType: "Passport Reissue",
        reissueReason: "Change of Address",
        verifiedDocumentType: `${session.selectedDocument.documentTypeLabel} — Verified`,
      });
      await new Promise((r) => setTimeout(r, 700));
      setSession((prev) => ({
        ...prev,
        isExecuting: false,
        step: "form_preparation",
        totalSpentInr: prev.totalSpentInr + 0.2,
        formDraft: result,
        capabilitiesUsed: [...prev.capabilitiesUsed, { capabilityName: "passport_form_assistance", displayName: "Passport Form Assistant", priceInr: "₹0.20", priceUsdc: 0.0025, status: "completed", executedAt: new Date().toISOString(), resultSummary: "Synthetic application draft structured", reasonSelected: "" }],
      }));
    } catch {
      await new Promise((r) => setTimeout(r, 700));
      setSession((prev) => ({
        ...prev,
        isExecuting: false,
        step: "form_preparation",
        totalSpentInr: prev.totalSpentInr + 0.2,
        formDraft: { applicationId: `KAAM-${Date.now().toString(36).toUpperCase()}`, status: "ready_for_review", serviceTypeDisplay: "Passport Reissue", reasonDisplay: "Change of Address", applicantName: session.selectedDocument.name, currentAddressFormatted: session.selectedDocument.address, supportingDocumentDisplay: `${session.selectedDocument.documentTypeLabel} — Verified`, preparedAt: new Date().toISOString(), nextStepInstructions: "Review and submit through the official Passport Seva process.", disclaimer: "Kaam does not interact with live government systems." },
        capabilitiesUsed: [...prev.capabilitiesUsed, { capabilityName: "passport_form_assistance", displayName: "Passport Form Assistant", priceInr: "₹0.20", priceUsdc: 0.0025, status: "completed", executedAt: new Date().toISOString(), resultSummary: "Application draft prepared", reasonSelected: "" }],
      }));
    }
  }

  function handleNavigate(v: "home" | "journey" | "providers") {
    if (v === "journey") {
      handleStartTask(session.userPrompt || "Renew my passport. My address has changed.");
    } else {
      setView(v);
    }
  }

  return (
    <div className="k-page k-grain">
      <SiteHeader view={view} onNavigate={handleNavigate} onSwitchToPayGate={onSwitchToPayGate} />

      {view === "home" && <HomePage onStart={handleStartTask} />}
      {view === "journey" && (
        <JourneyPage
          session={session}
          onReset={handleReset}
          onExecuteCheckRequirements={handleExecuteCheckRequirements}
          onSelectDocument={handleSelectDocument}
          onExecuteVerifyDocument={handleExecuteVerifyDocument}
          onExecutePrepareForm={handleExecutePrepareForm}
        />
      )}
      {view === "providers" && (
        <main style={{ flex: 1, maxWidth: 1240, margin: "0 auto", padding: "4rem 2rem" }}>
          <span className="k-wordmark">For people who know how to do one thing well</span>
          <h1 className="k-serif" style={{ marginTop: "1.25rem", fontSize: "clamp(3.2rem,7vw,6rem)", lineHeight: 0.92, letterSpacing: "-0.06em", color: "var(--k-ink)" }}>
            Make useful<br /><span style={{ color: "var(--k-amber)" }}>capabilities.</span>
          </h1>
          <p style={{ marginTop: "1.75rem", maxWidth: 560, fontSize: "1.0625rem", lineHeight: 1.75, color: "var(--k-ink3)" }}>
            Kaam is a capability marketplace for careful, focused work: rules, documents, forms, translation, and the thousand small bridges public systems need.
          </p>
        </main>
      )}

      <Footer onNavigate={handleNavigate} />

      {/* Autonomous Agent Overlay */}
      {overlayOpen && (
        <AgentOverlay
          steps={agentSteps}
          pendingDecision={pendingDecision}
          isStreaming={isStreaming}
          onClose={() => setOverlayOpen(false)}
          onDecision={handleDecision}
        />
      )}

      {/* Overlay toggle when closed */}
      {!overlayOpen && (agentSteps.length > 0 || isStreaming) && (
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          style={{
            position: "fixed",
            bottom: "1.25rem",
            right: "1.25rem",
            zIndex: 190,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1rem",
            borderRadius: "9999px",
            background: "rgba(15,24,40,0.97)",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
            fontSize: "0.8125rem",
            fontWeight: 700,
            fontFamily: "var(--font-sans)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: isStreaming ? "#10b981" : "#64748b" }} />
          Agent {isStreaming ? "running" : "done"} · {agentSteps.length} steps
        </button>
      )}
    </div>
  );
}

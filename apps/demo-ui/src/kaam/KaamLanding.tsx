import React, { useState } from "react";

interface KaamLandingProps {
  onStartTask: (prompt: string) => void;
  onQuickDemo: () => void;
}

export function KaamLanding({ onStartTask, onQuickDemo }: KaamLandingProps) {
  const [prompt, setPrompt] = useState("Renew my passport. My address has changed.");

  const presets = [
    "Renew my passport. My address has changed.",
    "Passport reissue for change of residential address",
    "Update address on Indian passport with electricity bill",
  ];

  return (
    <div className="kaam-hero-container">
      {/* Ambient Tagline Badge */}
      <div className="kaam-hero-tagline-badge">
        <span>🇮🇳</span>
        <span>AI Citizen Assistant for Public Services</span>
      </div>

      {/* Main Hero Title */}
      <h1 className="kaam-hero-title">
        Get the government<br />
        <span>work done.</span>
      </h1>

      {/* Hero Subtitle */}
      <p className="kaam-hero-subtitle">
        Tell Kaam what you're trying to accomplish. It figures out the work, finds the specialized capabilities it needs, and helps you finish.
      </p>

      {/* Hero Task Input Card */}
      <div className="kaam-input-card">
        <label htmlFor="kaam-task-input" className="kaam-input-label">
          What do you need to get done?
        </label>
        <textarea
          id="kaam-task-input"
          className="kaam-hero-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Renew my passport. My address has changed."
          rows={3}
        />

        <div className="kaam-input-actions">
          <div className="kaam-preset-pills">
            <span className="kaam-preset-label">Demo Preset:</span>
            <button
              type="button"
              className="kaam-preset-chip"
              onClick={() => setPrompt("Renew my passport. My address has changed.")}
            >
              Passport Reissue (Address Change)
            </button>
          </div>

          <button
            type="button"
            className="kaam-start-btn"
            onClick={() => onStartTask(prompt)}
          >
            <span>Start</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 1-Click Instant Evaluator Mode */}
      <div className="kaam-quick-launcher">
        <button
          type="button"
          className="kaam-quick-demo-btn"
          onClick={onQuickDemo}
        >
          <span>⚡ Try Passport Demo (1-Click)</span>
        </button>
      </div>

      {/* Before Kaam vs With Kaam Comparison */}
      <div className="kaam-comparison-section">
        <h3 className="kaam-section-heading">Why Kaam?</h3>
        <div className="kaam-comparison-grid">
          {/* Without Kaam */}
          <div className="kaam-comparison-card">
            <div className="kaam-comparison-title" style={{ color: "#f43f5e" }}>
              <span>✕</span>
              <span>Without Kaam</span>
            </div>
            <ul className="kaam-comparison-list">
              <li className="kaam-comparison-item">
                <span className="icon-bad">✕</span> Find obscure government rulebooks
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-bad">✕</span> Decode complex circulars &amp; clauses
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-bad">✕</span> Buy expensive monthly SaaS tools
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-bad">✕</span> Risk document rejection &amp; rework
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-bad">✕</span> Manually coordinate next steps
              </li>
            </ul>
          </div>

          {/* With Kaam */}
          <div className="kaam-comparison-card positive">
            <div className="kaam-comparison-title" style={{ color: "#34d399" }}>
              <span>✓</span>
              <span>With Kaam</span>
            </div>
            <ul className="kaam-comparison-list">
              <li className="kaam-comparison-item">
                <span className="icon-good">✓</span> Tell Kaam your goal in plain language
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-good">✓</span> Agent discovers exact specialized tools
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-good">✓</span> Pay-per-use (~₹0.55 total, no subscriptions)
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-good">✓</span> Automated document check &amp; form draft
              </li>
              <li className="kaam-comparison-item">
                <span className="icon-good">✓</span> Ready for official submission in minutes
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

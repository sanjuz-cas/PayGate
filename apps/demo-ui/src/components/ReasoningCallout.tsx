import React, { useState } from "react";

interface ReasoningCalloutProps {
  reason: string;
  evaluatedAt?: string;
  defaultExpanded?: boolean;
}

export function ReasoningCallout({ reason, evaluatedAt, defaultExpanded = false }: ReasoningCalloutProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!reason) return null;

  return (
    <div className="reasoning-callout">
      <div
        className="reasoning-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
      >
        <div className="reasoning-title">
          <span className="reasoning-icon">🧠</span>
          <span className="reasoning-label">Agent Autonomous Reasoning</span>
        </div>
        <span className="reasoning-toggle">{expanded ? "Hide rationale ▲" : "Show rationale ▼"}</span>
      </div>

      {expanded && (
        <div className="reasoning-body">
          <p className="reasoning-text">&ldquo;{reason}&rdquo;</p>
          {evaluatedAt && (
            <span className="reasoning-time">
              Evaluated at {new Date(evaluatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

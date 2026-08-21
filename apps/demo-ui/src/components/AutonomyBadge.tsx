import React from "react";

interface AutonomyBadgeProps {
  decision?: "unlock" | "ignore" | "defer" | string;
  confidence?: number;
  compact?: boolean;
}

export function AutonomyBadge({ decision, confidence = 1, compact = false }: AutonomyBadgeProps) {
  if (!decision) return null;

  const percent = Math.round(confidence * 100);

  if (decision === "unlock") {
    return (
      <span className={`autonomy-badge autonomy-badge--unlock ${compact ? "is-compact" : ""}`}>
        <span className="autonomy-badge-icon">🛡️</span>
        <span className="autonomy-badge-text">
          {compact ? "AUTO-UNLOCK" : `AUTO-UNLOCKED (${percent}%)`}
        </span>
      </span>
    );
  }

  if (decision === "ignore") {
    return (
      <span className={`autonomy-badge autonomy-badge--ignore ${compact ? "is-compact" : ""}`}>
        <span className="autonomy-badge-icon">🚫</span>
        <span className="autonomy-badge-text">
          {compact ? "SPAM IGNORED" : `SPAM IGNORED (${percent}%)`}
        </span>
      </span>
    );
  }

  return (
    <span className={`autonomy-badge autonomy-badge--defer ${compact ? "is-compact" : ""}`}>
      <span className="autonomy-badge-icon">⏳</span>
      <span className="autonomy-badge-text">
        {compact ? "DEFERRED" : `DEFERRED (${percent}%)`}
      </span>
    </span>
  );
}

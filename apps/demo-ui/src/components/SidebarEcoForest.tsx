import React, { useEffect, useRef, useState } from "react";
import { ECO_CAUSE_ADDRESS } from "@juicebag-mail/shared";

interface SidebarEcoForestProps {
  treesCount: number;
  totalUsd?: number;
  lastEvent?: any;
  onViewImpact?: () => void;
}

export function SidebarEcoForest({
  treesCount,
  totalUsd,
  lastEvent,
  onViewImpact,
}: SidebarEcoForestProps) {
  const [showSprout, setShowSprout] = useState(false);
  const prevCountRef = useRef(treesCount);

  useEffect(() => {
    if (treesCount > prevCountRef.current && prevCountRef.current > 0) {
      setShowSprout(true);
      const timer = setTimeout(() => setShowSprout(false), 3000);
      prevCountRef.current = treesCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = treesCount;
  }, [treesCount]);

  useEffect(() => {
    if (lastEvent?.type === "eco.contribution" || lastEvent?.type === "letter.sent") {
      setShowSprout(true);
      const timer = setTimeout(() => setShowSprout(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  const calculatedUsd = totalUsd !== undefined ? totalUsd : treesCount * 0.01;

  return (
    <div className="eco-travel-card" onClick={onViewImpact} role="button" tabIndex={0}>
      {/* Full-bleed background image */}
      <img className="eco-travel-card__bg" src="/ecogpt_bg.jpg" alt="EcoGPT Forest" />

      {/* Gradient overlay for text readability */}
      <div className="eco-travel-card__overlay" />

      {/* Top: title left, arrow right */}
      <div className="eco-travel-card__header">
        <div>
          <div className="eco-travel-card__title"><span className="eco-travel-card__title-green">EcoGPT</span></div>
        </div>
        <div className="eco-travel-card__arrow-circle">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 10L10 4M10 4H5M10 4V9" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Sprout animation */}
      {showSprout && (
        <div className="eco-travel-card__sprout">
          <span className="eco-sprout-emoji">🌱</span>
          <span className="eco-sprout-leaf">🍃</span>
        </div>
      )}

      {/* Bottom CTA */}
      <a
        href={`https://testnet.explorer.perawallet.app/address/${ECO_CAUSE_ADDRESS}`}
        target="_blank"
        rel="noreferrer"
        className="eco-travel-card__cta"
        onClick={(e) => e.stopPropagation()}
      >
        View on Explorer
      </a>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";

interface NavEcoTreeBadgeProps {
  treesCount: number;
  lastEvent?: any;
  onClick: () => void;
}

export function NavEcoTreeBadge({
  treesCount,
  lastEvent,
  onClick,
}: NavEcoTreeBadgeProps) {
  const [isGrowing, setIsGrowing] = useState(false);
  const [growthStage, setGrowthStage] = useState<"idle" | "sprout" | "sapling" | "tree">("idle");
  const [showToast, setShowToast] = useState(false);
  const prevCountRef = useRef(treesCount);

  const triggerGrowthAnimation = () => {
    setIsGrowing(true);
    setShowToast(true);
    setGrowthStage("sprout");

    const t1 = setTimeout(() => setGrowthStage("sapling"), 600);
    const t2 = setTimeout(() => setGrowthStage("tree"), 1400);
    const t3 = setTimeout(() => {
      setIsGrowing(false);
      setGrowthStage("idle");
      setShowToast(false);
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  useEffect(() => {
    if (treesCount > prevCountRef.current && prevCountRef.current > 0) {
      triggerGrowthAnimation();
    }
    prevCountRef.current = treesCount;
  }, [treesCount]);

  useEffect(() => {
    if (lastEvent?.type === "eco.contribution" || lastEvent?.type === "letter.sent") {
      triggerGrowthAnimation();
    }
  }, [lastEvent]);

  const renderTreeIcon = () => {
    if (isGrowing) {
      if (growthStage === "sprout") return "🌱";
      if (growthStage === "sapling") return "🌿";
      return "🌲";
    }
    return treesCount > 0 ? "🌲" : "🌱";
  };

  return (
    <div className="nav-tree-badge-container">
      {/* Floating Growth Toast Notification */}
      {showToast && (
        <div className="nav-tree-growth-toast">
          <span className="toast-leaf">🍃</span>
          <span className="toast-text">+1 Tree Planted!</span>
          <span className="toast-sparkle">✨</span>
        </div>
      )}

      {/* Main Interactive Pill Button */}
      <button
        type="button"
        className={`nav-eco-tree-btn ${isGrowing ? "is-growing-active" : ""}`}
        onClick={onClick}
        title="EcoGPT Tree-Planting Micropayment Rail (Click to view Impact)"
      >
        {isGrowing && (
          <>
            <span className="tree-aura-ring ring-1" />
            <span className="tree-aura-ring ring-2" />
          </>
        )}

        <div className={`nav-tree-avatar ${isGrowing ? `stage-${growthStage}` : ""}`}>
          <span className="tree-emoji-icon">{renderTreeIcon()}</span>
          {isGrowing && <span className="tree-sparkle-burst">✨</span>}
        </div>

        <div className="nav-tree-info">
          <span className="nav-tree-count">
            {treesCount} {treesCount === 1 ? "Tree" : "Trees"}
          </span>
          <span className="nav-tree-sub">EcoGPT</span>
        </div>
      </button>
    </div>
  );
}

import React, { useState } from "react";
import type { AgentState } from "@juicebag-mail/shared";

interface SidebarProps {
  activePage: string;
  onSelectPage: (page: any) => void;
  agentState?: AgentState | null;
  unreadInboundCount: number;
  guardrailBlocked?: boolean;
}

export function Sidebar({
  activePage,
  onSelectPage,
  agentState,
  unreadInboundCount,
  guardrailBlocked,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const agentName = agentState?.registration?.agentName ?? "Acme Filing Agent";
  const mailboxId = agentState?.registration?.mailboxId ?? "x402...7f3a";
  const displayId = mailboxId.length > 12 ? `${mailboxId.slice(0, 6)}...${mailboxId.slice(-4)}` : mailboxId;

  const navItems: Array<{ id: string; label: string; icon: string; badge?: number; alert?: boolean }> = [
    { id: "agent", label: "Overview", icon: "🏠", badge: unreadInboundCount > 0 ? unreadInboundCount : undefined },
    { id: "send", label: "Send Letter", icon: "✉️" },
    { id: "guardrails", label: "Guardrails & Ledger", icon: "🛡️", alert: guardrailBlocked },
    { id: "ops", label: "Postal Ops Hub", icon: "🏢" },
  ];

  return (
    <aside className={`app-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
      {/* Top Group: Network Badge + Primary Navigation Links */}
      <div className="sidebar-upper-wrap">
        {/* Top Section: Algorand Network Pill Dropdown */}
        <div className="sidebar-top-section">
          <div className="sidebar-protocol-badge" title="Algorand TestNet x402">
            <span className="protocol-dot">●</span>
            {!isCollapsed && (
              <>
                <span className="protocol-text">Algorand TestNet</span>
                <span className="protocol-tag">x402</span>
                <span className="dropdown-caret">▾</span>
              </>
            )}
          </div>
        </div>

        {/* Primary Navigation Links */}
        <nav className="sidebar-nav-group">
          {navItems.map((item) => {
            const isActive = activePage === item.id || (activePage === "hero" && item.id === "agent");
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? "is-active" : ""}`}
                onClick={() => onSelectPage(item.id)}
                title={item.label}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {item.badge !== undefined && (
                  <span className="sidebar-badge">{item.badge}</span>
                )}
                {item.alert && (
                  <span className="sidebar-alert-dot" title="Guardrail Alert">!</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Secondary & System Items */}
      <div className="sidebar-footer-group">
        <div className="sidebar-secondary-links">
          <button type="button" className="sidebar-nav-item secondary" title="Settings">
            <span className="sidebar-nav-icon">⚙️</span>
            {!isCollapsed && <span className="sidebar-nav-label">Settings</span>}
          </button>
          <button type="button" className="sidebar-nav-item secondary" title="Integrations">
            <span className="sidebar-nav-icon">⇄</span>
            {!isCollapsed && <span className="sidebar-nav-label">Integrations</span>}
          </button>
          <div className="sidebar-theme-picker">
            <button type="button" className="sidebar-nav-item secondary theme-btn" title="Theme">
              <span className="sidebar-nav-icon">☼</span>
              {!isCollapsed && (
                <>
                  <span className="sidebar-nav-label">Light Mode</span>
                  <span className="sidebar-caret">▾</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* User / Agent Profile Badge with Green Online Dot */}
        <div className="sidebar-user-card" title={`Agent: ${agentName}`}>
          <div className="user-avatar-wrap">
            <div className="user-avatar-initials">
              {agentName.slice(0, 2).toUpperCase()}
            </div>
            <span className="user-online-dot">●</span>
          </div>
          {!isCollapsed && (
            <div className="user-card-meta">
              <div className="user-card-name">{agentName}</div>
              <div className="user-card-id">Agent ID: {displayId}</div>
            </div>
          )}
          {!isCollapsed && <span className="user-card-caret">▾</span>}
        </div>
      </div>
    </aside>
  );
}

import React, { useEffect, useState } from "react";
import {
  ALGORAND_EXPLORER_BASE_URL,
  type EcoStats,
} from "@juicebag-mail/shared";
import { api } from "../api/client.js";

interface EcoImpactWidgetProps {
  onRefreshTrigger?: number;
}

export function EcoImpactWidget({ onRefreshTrigger = 0 }: EcoImpactWidgetProps) {
  const [stats, setStats] = useState<EcoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await api.getEcoStats();
      setStats(data);
    } catch (err) {
      console.warn("[eco-widget] Failed to load eco stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [onRefreshTrigger]);

  const treesPlanted = stats?.totalTreesPlanted ?? 0;
  const totalUsd = stats?.totalContributedUsd ?? 0;
  const recent = stats?.recentContributions ?? [];

  return (
    <div className="eco-impact-widget">
      {/* Top Banner Header */}
      <div className="eco-widget-header">
        <div className="eco-header-title-wrap">
          <span className="eco-tree-icon" role="img" aria-label="tree">
            🌲
          </span>
          <div>
            <div className="eco-widget-title">EcoGPT Impact Rail</div>
            <div className="eco-widget-subtitle">
              Automated On-Chain Tree Planting per Action
            </div>
          </div>
        </div>
        <div className="eco-badge-live">
          <span className="eco-pulsing-dot" />
          <span>Algorand TestNet Rail</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="eco-stats-grid">
        <div className="eco-stat-card primary">
          <div className="eco-stat-label">Trees Planted</div>
          <div className="eco-stat-value">
            <span className="eco-counter-num">{loading ? "..." : treesPlanted}</span>
            <span className="eco-stat-unit">Trees</span>
          </div>
          <div className="eco-stat-subtext">
            1 Tree funded per sent or unlocked letter
          </div>
        </div>

        <div className="eco-stat-card">
          <div className="eco-stat-label">Total Contribution</div>
          <div className="eco-stat-value">
            <span className="eco-counter-num">
              ${loading ? "0.00" : totalUsd.toFixed(2)}
            </span>
            <span className="eco-stat-unit">USDC</span>
          </div>
          <div className="eco-stat-subtext">
            Direct $0.01 micro-donations
          </div>
        </div>

        <div className="eco-stat-card">
          <div className="eco-stat-label">Cause Wallet</div>
          <div className="eco-stat-value wallet-addr">
            {stats?.causeAddress ? (
              <a
                href={`https://testnet.explorer.perawallet.app/address/${stats.causeAddress}`}
                target="_blank"
                rel="noreferrer"
                className="eco-wallet-link"
                title="View Cause Wallet on Pera Explorer"
              >
                {stats.causeAddress.slice(0, 6)}...{stats.causeAddress.slice(-4)} ↗
              </a>
            ) : (
              "..."
            )}
          </div>
          <div className="eco-stat-subtext">Verified Tree-Planting Org</div>
        </div>
      </div>

      {/* Collapsible Ledger of Proofs */}
      <div className="eco-ledger-section">
        <button
          type="button"
          className="eco-toggle-ledger-btn"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>
            {isExpanded ? "▼ Hide On-Chain Impact Ledger" : "▶ View On-Chain Impact Ledger"} (
            {recent.length} Verified {recent.length === 1 ? "Tx" : "Txs"})
          </span>
          <span className="eco-ledger-count-tag">
            {treesPlanted} 🌲 Planted
          </span>
        </button>

        {isExpanded && (
          <div className="eco-tx-ledger-table-wrap">
            {recent.length === 0 ? (
              <div className="eco-empty-ledger">
                No tree contributions yet. Send a letter to plant your first tree!
              </div>
            ) : (
              <table className="eco-ledger-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Trees</th>
                    <th>Amount</th>
                    <th>On-Chain TxID</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="eco-action-chip">
                          {tx.action === "send-letter" ? "✉️ Send Letter" : "🔓 Unlock Mail"}
                        </span>
                      </td>
                      <td className="eco-trees-col">+{tx.treesCount} 🌲</td>
                      <td className="eco-amt-col">${tx.amountUsd.toFixed(2)} USDC</td>
                      <td>
                        <a
                          href={`${ALGORAND_EXPLORER_BASE_URL}${tx.txid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="eco-tx-hash-link"
                          title="Verify on Pera Explorer"
                        >
                          {tx.txid.slice(0, 8)}...{tx.txid.slice(-6)} ↗
                        </a>
                      </td>
                      <td className="eco-time-col">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

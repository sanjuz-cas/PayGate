import React, { useState, useRef, useEffect } from "react";
import { api } from "../api/client";
import type { AgentState, AgentGuardrail } from "@juicebag-mail/shared";

interface Message {
  id: string;
  sender: "user" | "agent" | "system";
  text: string;
  toolCall?: {
    name: string;
    input: any;
    output?: any;
    txid?: string;
  };
  timestamp: string;
}

interface AgentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  agentState?: AgentState | null;
  onStateRefresh: () => void;
  hideFloatingLauncher?: boolean;
}

export function AgentChatDrawer({
  isOpen,
  onClose,
  onOpen,
  agentState,
  onStateRefresh,
  hideFloatingLauncher,
}: AgentChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_welcome",
      sender: "agent",
      text: "Hello! I am your PayGate Autonomous Mail Agent. I can manage your physical mailbox, evaluate inbound scans, enforce daily spending guardrails, and execute x402 on-chain payments.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const addMessage = (msg: Omit<Message, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleCommand = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    addMessage({ sender: "user", text: trimmed });
    setInput("");
    setIsThinking(true);

    const lower = trimmed.toLowerCase();

    try {
      if (lower.includes("budget") || lower.includes("spend") || lower.includes("cap") || lower.includes("guardrail")) {
        const spendData = await api.getSpendStatus();
        const g = spendData.guardrail;
        addMessage({
          sender: "agent",
          text: `Spending Guardrail Status:\n• 24h Spend: $${g.currentSpendUsdc.toFixed(2)} USDC\n• Daily Cap: $${g.dailyCapUsdc.toFixed(2)} USDC\n• Remaining Budget: $${g.remainingUsdc.toFixed(2)} USDC\n• Status: ${g.blocked ? "🛑 BUDGET BLOCKED" : "✅ ACTIVE & PROTECTED"}`,
        });
      } else if (lower.includes("lower cap") || lower.includes("0.05") || lower.includes("trigger block")) {
        const res = await api.setDailyCap(0.05);
        onStateRefresh();
        addMessage({
          sender: "agent",
          text: `Adjusted daily spending cap to $0.05 USDC. The next autonomous unlock attempt ($0.20 USDC) will be blocked by the safety guardrail!`,
          toolCall: {
            name: "set_daily_cap",
            input: { dailyCapUsdc: 0.05 },
            output: res.guardrail,
          },
        });
      } else if (lower.includes("reset cap") || lower.includes("5.00") || lower.includes("default cap")) {
        const res = await api.setDailyCap(5.0);
        onStateRefresh();
        addMessage({
          sender: "agent",
          text: `Reset daily spending cap to $5.00 USDC default limit. Guardrail headroom restored.`,
          toolCall: {
            name: "set_daily_cap",
            input: { dailyCapUsdc: 5.0 },
            output: res.guardrail,
          },
        });
      } else if (lower.includes("check mail") || lower.includes("inbox") || lower.includes("urgent") || lower.includes("unlock")) {
        const state = await api.getAgentState();
        const pending = state.inboundLetters.filter((l) => l.agentStatus === "pending");
        if (pending.length === 0) {
          addMessage({
            sender: "agent",
            text: `Inbox is clear! No pending inbound letters found.`,
            toolCall: {
              name: "list_inbox",
              input: {},
              output: { totalLetters: state.inboundLetters.length },
            },
          });
        } else {
          const target = pending[0];
          addMessage({
            sender: "agent",
            text: `Found pending letter from "${target.fromName}" (${target.envelopeSummary}). Evaluating priority rules...`,
            toolCall: {
              name: "evaluate_inbound_letter",
              input: { letterId: target.id, from: target.fromName },
            },
          });

          // Attempt unlock
          try {
            const unlockRes = await api.unlockLetter(target.id, "usdc");
            onStateRefresh();
            addMessage({
              sender: "agent",
              text: `Successfully unlocked letter from "${target.fromName}"! Payment settled on Algorand TestNet ($0.20 USDC).`,
              toolCall: {
                name: "unlock_inbound_letter",
                input: { letterId: target.id },
                output: { status: "unlocked" },
                txid: unlockRes.inboundLetters.find((l) => l.id === target.id)?.unlockPaymentTxid ?? undefined,
              },
            });
          } catch (err: any) {
            addMessage({
              sender: "agent",
              text: `Unlock halted: ${err.message || "Payment blocked by guardrail or network error."}`,
            });
          }
        }
      } else {
        // Fallback natural language helper
        addMessage({
          sender: "agent",
          text: `I understood: "${trimmed}". You can ask me to check your budget, inspect pending mail, trigger spending cap changes, or simulate automated physical mail sending!`,
        });
      }
    } catch (err: any) {
      addMessage({
        sender: "agent",
        text: `Error executing command: ${err.message || "Unknown error"}`,
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleCommand(input);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && !hideFloatingLauncher && (
        <button
          type="button"
          className="chat-floating-launcher"
          onClick={onOpen ?? onClose}
          aria-label="Open AI Mail Agent Chat"
        >
          <span className="launcher-icon">🤖</span>
          <span className="launcher-text">Agent Assistant</span>
        </button>
      )}

      {/* Slide-out Panel Overlay */}
      {isOpen && (
        <div className="chat-drawer-backdrop" onClick={onClose}>
          <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="chat-drawer-header">
              <div className="chat-header-info">
                <span className="chat-avatar">🤖</span>
                <div>
                  <h3 className="chat-title">PayGate Agent Assistant</h3>
                  <span className="chat-status">● Algorand x402 Active</span>
                </div>
              </div>
              <button
                type="button"
                className="chat-close-button"
                onClick={onClose}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="chat-chips-bar">
              <button
                type="button"
                className="chat-chip"
                onClick={() => void handleCommand("Check my budget and spend status")}
              >
                📊 Check Budget
              </button>
              <button
                type="button"
                className="chat-chip"
                onClick={() => void handleCommand("Check mail and unlock urgent letters")}
              >
                📬 Triage Inbound Mail
              </button>
              <button
                type="button"
                className="chat-chip chat-chip--danger"
                onClick={() => void handleCommand("Trigger block with $0.05 cap")}
              >
                🛑 Force Block ($0.05)
              </button>
              <button
                type="button"
                className="chat-chip"
                onClick={() => void handleCommand("Reset cap to $5.00")}
              >
                🔄 Reset Cap ($5)
              </button>
            </div>

            {/* Message Feed */}
            <div className="chat-messages-container">
              {messages.map((m) => (
                <div key={m.id} className={`chat-bubble-wrap chat-bubble-wrap--${m.sender}`}>
                  <div className={`chat-bubble chat-bubble--${m.sender}`}>
                    <div className="chat-bubble-text">{m.text}</div>

                    {/* Tool Call Card */}
                    {m.toolCall && (
                      <div className="chat-tool-card">
                        <div className="chat-tool-name">
                          <span>⚡ MCP Tool:</span> <code>{m.toolCall.name}()</code>
                        </div>
                        {m.toolCall.txid && (
                          <div className="chat-tool-tx">
                            <span>Tx: </span>
                            <a
                              href={`https://testnet.explorer.perawallet.app/tx/${m.toolCall.txid}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {m.toolCall.txid.slice(0, 12)}... ↗
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <span className="chat-bubble-time">{m.timestamp}</span>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="chat-bubble-wrap chat-bubble-wrap--agent">
                  <div className="chat-bubble chat-bubble--agent is-thinking">
                    <span className="thinking-dot">●</span>
                    <span className="thinking-dot">●</span>
                    <span className="thinking-dot">●</span>
                    <span className="thinking-label">Evaluating x402 rules...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleFormSubmit} className="chat-input-form">
              <input
                type="text"
                placeholder="Ask agent to check budget, triage mail..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isThinking}
                className="chat-input"
              />
              <button
                type="submit"
                disabled={isThinking || !input.trim()}
                className="chat-send-btn"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

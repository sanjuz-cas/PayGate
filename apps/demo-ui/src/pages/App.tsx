import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useState,
} from "react";

import {
  ALGORAND_EXPLORER_BASE_URL,
  ALGORAND_MAINNET_EXPLORER_BASE_URL,
  ALGORAND_MAINNET_QUANTOZ,
  ROUTE_PRICES,
  ROUTE_PRICES_EURD_DISPLAY,
} from "@juicebag-mail/shared";
import type {
  Address,
  AgentRegistrationInput,
  AgentState,
  AgentSendLetterInput,
  InternalInboundLetterScanExtractResponse,
  ServiceState,
} from "@juicebag-mail/shared";

type ModalContent =
  | { kind: "agent-inbound"; letter: AgentState["inboundLetters"][number] }
  | { kind: "agent-outbound"; letter: AgentState["outboundLetters"][number] }
  | { kind: "service-inbound"; letter: ServiceState["inboundLetters"][number] }
  | { kind: "service-outbound"; letter: ServiceState["outboundLetters"][number] };

type InboundMode = "text" | "scan";
type InboundFormState = {
  mailboxId: string;
  fromName: string;
  envelopeSummary: string;
  ocrText: string;
  scanDraftId: string;
  scanFileName: string;
};

import { api } from "../api/client";
import demoLetterImageUrl from "../../demo_assets/letter_demo.jpg";
import { useAgentEvents } from "../hooks/useAgentEvents";
import { usePollingResource } from "../hooks/usePollingResource";

const initialRegistration: AgentRegistrationInput = {
  agentName: "Acme Filing Agent",
  entityType: "company",
  legalIdentity: {
    name: "Acme GmbH",
    street1: "Musterstrasse 1",
    postalCode: "10115",
    city: "Berlin",
    country: "DE",
  },
  currency: "usdc",
};

const initialLetter: AgentSendLetterInput = {
  recipient: {
    name: "Finanzamt Berlin",
    street1: "Finanzstrasse 5",
    postalCode: "10117",
    city: "Berlin",
    country: "DE",
  },
  subject: "Request for clarification",
  bodyMarkdown:
    "Dear Finanzamt,\n\nPlease share the status of our filing.\n\nBest regards,\nAcme Filing Agent",
  currency: "usdc",
};

export function App() {
  const [agentStateInterval, setAgentStateInterval] = useState(3_000);
  const agent = usePollingResource(api.getAgentState, agentStateInterval);
  const agentBalances = usePollingResource(api.getAgentBalances, 2_000);
  const service = usePollingResource(api.getServiceState, 8_000);
  const serviceBalances = usePollingResource(api.getServiceBalances, 2_000);
  const liveAgentEvent = useAgentEvents();

  useEffect(() => {
    if (agent.data?.registration && agentStateInterval !== 8_000) {
      setAgentStateInterval(8_000);
    }
  }, [agent.data?.registration, agentStateInterval]);

  const [currency, setCurrency] = useState<"usdc" | "eurd">("usdc");

  const [registrationForm, setRegistrationForm] =
    useState<AgentRegistrationInput>(initialRegistration);
  const [letterForm, setLetterForm] = useState<AgentSendLetterInput>(initialLetter);
  const [inboundMode, setInboundMode] = useState<InboundMode>("text");
  const [inboundForm, setInboundForm] = useState<InboundFormState>({
    mailboxId: "",
    fromName: "Finanzamt Berlin",
    envelopeSummary: "Musterstrasse 1, 10115 Berlin",
    ocrText:
      "Sehr geehrte Damen und Herren,\n\nwir bitten um eine kurze Rückmeldung.\n",
    scanDraftId: "",
    scanFileName: "",
  });
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [sentToPrinterIds, setSentToPrinterIds] = useState<Set<string>>(new Set());
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());
  const [actionResults, setActionResults] = useState<Record<string, "success" | "error">>({});
  const [modal, setModal] = useState<ModalContent | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  const deferredInbound = useDeferredValue(agent.data?.inboundLetters ?? []);
  const deferredOutbound = useDeferredValue(agent.data?.outboundLetters ?? []);
  const deferredServiceInbound = useDeferredValue(service.data?.inboundLetters ?? []);
  const deferredServiceOutbound = useDeferredValue(service.data?.outboundLetters ?? []);

  const defaultMailboxId =
    agent.data?.registration?.mailboxId ?? service.data?.agents[0]?.mailboxId ?? "";
  const inboundMailboxId = inboundForm.mailboxId || defaultMailboxId;
  const canSubmitInbound =
    inboundMailboxId.length > 0 &&
    (inboundMode === "text" || inboundForm.scanDraftId.length > 0);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultScan() {
      try {
        const response = await fetch(demoLetterImageUrl);
        const blob = await response.blob();
        if (!response.ok) {
          throw new Error("Failed to load bundled demo letter");
        }

        if (!cancelled) {
          setScanFile((current) => current ?? new File([blob], "letter_demo.jpg", { type: blob.type || "image/jpeg" }));
        }
      } catch (error) {
        if (!cancelled) {
          setUiError(error instanceof Error ? error.message : "Failed to load demo letter");
        }
      }
    }

    void loadDefaultScan();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction<T>(actionKey: string, task: () => Promise<T>) {
    setBusyActions((prev) => new Set([...prev, actionKey]));
    let succeeded = false;
    let value: T | undefined;
    try {
      value = await task();
      succeeded = true;
      setUiError(null);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusyActions((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
    setActionResults((prev) => ({ ...prev, [actionKey]: succeeded ? "success" : "error" }));
    setTimeout(() => {
      setActionResults((prev) => {
        const { [actionKey]: _, ...rest } = prev;
        return rest;
      });
    }, 3_000);
    if (succeeded) {
      void Promise.all([agent.refresh(), service.refresh()]);
    }

    return value;
  }

  function clearScanDraft() {
    setInboundForm((current) => ({
      ...current,
      scanDraftId: "",
      scanFileName: "",
    }));
  }

  function applyExtractedScan(result: InternalInboundLetterScanExtractResponse) {
    setInboundForm((current) => ({
      ...current,
      fromName: result.fromName,
      envelopeSummary: result.envelopeSummary,
      ocrText: result.ocrText,
      scanDraftId: result.scanDraftId,
      scanFileName: result.scanFileName,
    }));
  }

  async function handleScanExtract() {
    const mailboxId = inboundForm.mailboxId || defaultMailboxId;
    if (!mailboxId) {
      setUiError("Choose a mailbox before extracting a scan.");
      return;
    }

    if (!scanFile) {
      setUiError("Choose a PNG or JPEG scan first.");
      return;
    }

    const result = await runAction("extract-scan", () =>
      api.extractInboundLetterFromScan({
        mailboxId,
        scan: scanFile,
      }),
    );

    if (result) {
      applyExtractedScan(result);
    }
  }

  const currentAgentEvent = liveAgentEvent ?? (agent.data?.lastEvent ? {
    id: "snapshot",
    ...agent.data.lastEvent,
  } : null);

  const currentServiceEvent = service.data?.lastEvent ?? null;
  const displayedBalances: AgentState["balances"] =
    agentBalances.data ?? agent.data?.balances ?? {
      algo: 0,
      usdc: 0,
      eurd: 0,
      address: "",
    };
  const eurdEnabled = service.data?.paymentOptions.eurd ?? false;
  const selectedCurrency: "usdc" | "eurd" = eurdEnabled ? currency : "usdc";

  useEffect(() => {
    if (!eurdEnabled && currency === "eurd") {
      setCurrency("usdc");
    }
  }, [currency, eurdEnabled]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Algorand x402 Hackathon Demo</p>
          <h1>Juicebag Mail Dash</h1>
          <p className="hero-copy">
            Your juicebag keeps nagging about &ldquo;paper mail&rdquo; from Finanzamt, and it is definitely not an email? 
            <br></br>
            Juicebag Mail to rescue!
          </p>
        </div>
        <div className="price-strip">
          <div className="currency-toggle-wrap">
            <div className="currency-toggle" role="group" aria-label="Payment token">
              <button
                className={selectedCurrency === "usdc" ? "currency-toggle-button is-active" : "currency-toggle-button"}
                aria-pressed={selectedCurrency === "usdc"}
                onClick={() => setCurrency("usdc")}
                type="button"
              >
                <span className="currency-toggle-label">USDC</span>
                <span className="currency-toggle-meta">Testnet</span>
              </button>
              <button
                className={selectedCurrency === "eurd" ? "currency-toggle-button is-active" : "currency-toggle-button"}
                aria-disabled={!eurdEnabled}
                aria-pressed={selectedCurrency === "eurd"}
                disabled={!eurdEnabled}
                onClick={() => setCurrency("eurd")}
                title={eurdEnabled ? "Pay with EURD on Algorand mainnet" : "EURD unavailable at startup"}
                type="button"
              >
                <span className="currency-toggle-label">EURD</span>
                <span className="currency-toggle-meta">{eurdEnabled ? "Mainnet" : "Unavailable"}</span>
              </button>
            </div>
            {!eurdEnabled ? (
              <p className="currency-toggle-note">EURD facilitator was unavailable at startup, so payments stay on USDC.</p>
            ) : null}
          </div>
          <PricePill icon="📮" label="Register" value={selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.registration : ROUTE_PRICES.registration} />
          <PricePill icon="✉️" label="Send letter" value={selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter} />
          <PricePill icon="📬" label="Receive mail" value={selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock} />
        </div>
      </header>

      <main className="pane-grid">
        <section className="pane pane-agent">
          <PaneHeader
            title="Agent Console"
            subtitle="Wallet, mailbox identity, inbox, and x402 outcomes."
          />

          <div className="summary-grid">
            <MetricCard label="ALGO balance" symbol="ALGO" value={displayedBalances.algo.toFixed(3)} />
            <MetricCard label="USDC balance" symbol="USDC" value={displayedBalances.usdc.toFixed(3)} />
            <MetricCard label="EURD balance" symbol="EURD" value={displayedBalances.eurd.toFixed(2)} />
            <MetricCard label="Total sent" value={String(agent.data?.outboundLetters.length ?? 0)} />
            <MetricCard
              label="Total received"
              value={String(agent.data?.inboundLetters.filter((l) => l.agentStatus !== "ignored").length ?? 0)}
            />
          </div>

          <div className="mailbox-strip">
            <span className="mailbox-label">Mailbox ID</span>
            <span className="mailbox-value">
              {agent.data?.registration?.mailboxId ?? "Not registered"}
            </span>
          </div>

          <Card title="My address">
            {agent.data?.registration ? (
              <div className="identity-card">
                <p>{agent.data.registration.agentName}</p>
                <p>{agent.data.registration.legalIdentity.name}</p>
                <p>{agent.data.registration.legalIdentity.street1}</p>
                <p>
                  {agent.data.registration.legalIdentity.postalCode}{" "}
                  {agent.data.registration.legalIdentity.city}
                </p>
                <p>{agent.data.registration.legalIdentity.country}</p>
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runAction("register", () => api.registerAgent({ ...registrationForm, currency: selectedCurrency }));
                }}
              >
                <LabeledInput
                  label="Agent Name"
                  value={registrationForm.agentName}
                  onChange={(value) =>
                    setRegistrationForm((current) => ({ ...current, agentName: value }))
                  }
                />
                <LabeledInput
                  label="Legal Name"
                  value={registrationForm.legalIdentity.name}
                  onChange={(value) =>
                    setRegistrationForm((current) => ({
                      ...current,
                      legalIdentity: { ...current.legalIdentity, name: value },
                    }))
                  }
                />
                <LabeledInput
                  label="Street"
                  value={registrationForm.legalIdentity.street1}
                  onChange={(value) =>
                    setRegistrationForm((current) => ({
                      ...current,
                      legalIdentity: { ...current.legalIdentity, street1: value },
                    }))
                  }
                />
                <div className="split-fields">
                  <LabeledInput
                    label="Postal Code"
                    value={registrationForm.legalIdentity.postalCode}
                    onChange={(value) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        legalIdentity: { ...current.legalIdentity, postalCode: value },
                      }))
                    }
                  />
                  <LabeledInput
                    label="City"
                    value={registrationForm.legalIdentity.city}
                    onChange={(value) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        legalIdentity: { ...current.legalIdentity, city: value },
                      }))
                    }
                  />
                </div>
                <ActionButton
                  label={busyActions.has("register") ? "Registering..." : `Register Mailbox (${selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.registration : ROUTE_PRICES.registration})`}
                  disabled={busyActions.has("register")}
                />
              </form>
            )}
          </Card>

          <Card title="Send Letter">
            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction("send-letter", () => api.sendLetter({ ...letterForm, currency: selectedCurrency }));
              }}
            >
              <LabeledInput
                label="Recipient"
                value={letterForm.recipient.name}
                onChange={(value) =>
                  setLetterForm((current) => ({
                    ...current,
                    recipient: { ...current.recipient, name: value },
                  }))
                }
              />
              <LabeledInput
                label="Street"
                value={letterForm.recipient.street1}
                onChange={(value) =>
                  setLetterForm((current) => ({
                    ...current,
                    recipient: { ...current.recipient, street1: value },
                  }))
                }
              />
              <LabeledInput
                label="Subject"
                value={letterForm.subject}
                onChange={(value) =>
                  setLetterForm((current) => ({ ...current, subject: value }))
                }
              />
              <label className="field">
                <span>Body</span>
                <textarea
                  rows={5}
                  value={letterForm.bodyMarkdown}
                  onChange={(event) =>
                    setLetterForm((current) => ({
                      ...current,
                      bodyMarkdown: event.target.value,
                    }))
                  }
                />
              </label>
              <ActionButton
                label={busyActions.has("send-letter") ? "Sending..." : `Send letter (${selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter})`}
                disabled={busyActions.has("send-letter") || !agent.data?.registration}
              />
            </form>
          </Card>

          <Card title="Inbound Mail">
            <Table
              columns={["From", "Status", "Received", "Action"]}
              onRowClick={(id) => {
                const letter = agent.data?.inboundLetters.find((l) => l.id === id);
                if (letter) setModal({ kind: "agent-inbound", letter });
              }}
              rows={deferredInbound.map((letter: AgentState["inboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.fromName}</strong>
                    <small>{letter.envelopeSummary}</small>
                  </div>,
                  <StatusBadge status={letter.agentStatus} />,
                  new Date(letter.receivedAt).toLocaleString(),
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    {letter.agentStatus !== "received" && (
                      <button
                        className="ghost-button"
                        disabled={busyActions.has(`unlock-${letter.id}`)}
                        onClick={() =>
                          void runAction(`unlock-${letter.id}`, () =>
                            api.unlockLetter(letter.id, selectedCurrency),
                          )
                        }
                      >
                        Get full ({selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock})
                      </button>
                    )}
                    {letter.agentStatus === "pending" && (
                      <button
                        className="ghost-button"
                        disabled={busyActions.has(`ignore-${letter.id}`)}
                        onClick={() =>
                          void runAction(`ignore-${letter.id}`, () =>
                            api.ignoreLetter(letter.id),
                          )
                        }
                      >
                        Ignore
                      </button>
                    )}
                  </div>,
                ],
              }))}
              emptyMessage="No inbound letters yet."
            />
          </Card>

          <Card title="Outbound Mail">
            <Table
              columns={["Subject", "Status", "Created", "Txid"]}
              onRowClick={(id) => {
                const letter = agent.data?.outboundLetters.find((l) => l.id === id);
                if (letter) setModal({ kind: "agent-outbound", letter });
              }}
              rows={deferredOutbound.map((letter: AgentState["outboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.subject}</strong>
                    <small>{letter.recipient.name}</small>
                  </div>,
                  <StatusBadge status={letter.status} />,
                  new Date(letter.createdAt).toLocaleString(),
                  <span onClick={(e) => e.stopPropagation()}>
                    <TxLink txid={letter.paymentTxid ?? undefined} />
                  </span>,
                ],
              }))}
              emptyMessage="No outbound letters yet."
            />
          </Card>

          <EventCard
            title="Latest Agent x402 Event"
            message={currentAgentEvent?.message ?? "Waiting for the first agent event."}
            txid={currentAgentEvent && "txid" in currentAgentEvent ? currentAgentEvent.txid : undefined}
            network={currentAgentEvent && "network" in currentAgentEvent ? currentAgentEvent.network as string | undefined : undefined}
          />
        </section>

        <section className="pane pane-ops">
          <PaneHeader
            title="Juicebag Mail service console"
            subtitle="Registered mailboxes, inbound ingestion, and operator-only state."
          />

          <div className="summary-grid">
            <MetricCard
              label="Registered"
              value={String(service.data?.counters.registeredAgents ?? 0)}
            />
            <MetricCard
              label="Pending Inbound"
              value={String(service.data?.counters.pendingInboundLetters ?? 0)}
            />
            <MetricCard
              label="Queued Outbound"
              value={String(service.data?.counters.queuedOutboundLetters ?? 0)}
            />
            <MetricCard label="USDC balance" symbol="USDC" value={(serviceBalances.data?.usdc ?? 0).toFixed(3)} />
            <MetricCard label="EURD balance" symbol="EURD" value={(serviceBalances.data?.eurd ?? 0).toFixed(2)} />
            <MetricCard label="Total sent" value={String(service.data?.outboundLetters.length ?? 0)} />
            <MetricCard label="Total received" value={String(service.data?.inboundLetters.length ?? 0)} />
          </div>

          <Card title="Ingest Inbound Letter">
            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction("ingest", () =>
                  api.ingestInboundLetter({
                    mailboxId: inboundMailboxId,
                    fromName: inboundForm.fromName,
                    pageCount: 1,
                    envelopeSummary: inboundForm.envelopeSummary,
                    ocrText: inboundForm.ocrText,
                    scanDraftId:
                      inboundMode === "scan" ? inboundForm.scanDraftId || undefined : undefined,
                    scanFileName:
                      inboundMode === "scan" ? inboundForm.scanFileName || undefined : undefined,
                  }),
                );
              }}
            >
              <LabeledInput
                label="Mailbox Id"
                value={inboundMailboxId}
                onChange={(value) =>
                  setInboundForm((current) => ({
                    ...current,
                    mailboxId: value,
                    scanDraftId:
                      value !== (current.mailboxId || defaultMailboxId) ? "" : current.scanDraftId,
                    scanFileName:
                      value !== (current.mailboxId || defaultMailboxId) ? "" : current.scanFileName,
                  }))
                }
              />
              <label className="field">
                <span>Input mode</span>
                <div className="mode-toggle" role="tablist" aria-label="Inbound ingest mode">
                  <button
                    className={inboundMode === "text" ? "mode-toggle-button is-active" : "mode-toggle-button"}
                    onClick={() => setInboundMode("text")}
                    type="button"
                  >
                    Text
                  </button>
                  <button
                    className={inboundMode === "scan" ? "mode-toggle-button is-active" : "mode-toggle-button"}
                    onClick={() => setInboundMode("scan")}
                    type="button"
                  >
                    Scan
                  </button>
                </div>
              </label>
              {inboundMode === "scan" && (
                <>
                  <label className="field">
                    <span>Scan image</span>
                    <input
                      accept="image/png,image/jpeg"
                      type="file"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null;
                        setScanFile(nextFile);
                        clearScanDraft();
                      }}
                    />
                    {scanFile && <small className="muted">{scanFile.name}</small>}
                  </label>
                  <div className="scan-actions">
                    <button
                      className="ghost-button"
                      disabled={busyActions.has("extract-scan") || !scanFile || !inboundMailboxId}
                      onClick={() => void handleScanExtract()}
                      type="button"
                    >
                      {busyActions.has("extract-scan") ? "Extracting..." :
                        actionResults["extract-scan"] === "success" ? "✓ Extracted" :
                        actionResults["extract-scan"] === "error" ? "✗ Extract failed" :
                        "Extract from Scan"}
                    </button>
                    <span className="muted inline-note">
                      Upload an image, review the OCR, then ingest the letter.
                    </span>
                  </div>
                  {inboundForm.scanDraftId && (
                    <div className="scan-draft-card">
                      <strong>OCR ready for review</strong>
                      <small>
                        Stored as {inboundForm.scanFileName} for mailbox {inboundMailboxId}.
                      </small>
                    </div>
                  )}
                </>
              )}
              <LabeledInput
                label="From"
                value={inboundForm.fromName}
                onChange={(value) =>
                  setInboundForm((current) => ({ ...current, fromName: value }))
                }
              />
              <LabeledInput
                label="Sender address"
                value={inboundForm.envelopeSummary}
                onChange={(value) =>
                  setInboundForm((current) => ({
                    ...current,
                    envelopeSummary: value,
                  }))
                }
              />
              <label className="field">
                <span>Letter text</span>
                <textarea
                  rows={5}
                  value={inboundForm.ocrText}
                  onChange={(event) =>
                    setInboundForm((current) => ({
                      ...current,
                      ocrText: event.target.value,
                    }))
                  }
                />
              </label>
              <ActionButton
                label={
                  busyActions.has("ingest") ? "Ingesting..." :
                  actionResults["ingest"] === "success" ? "✓ Ingested!" :
                  actionResults["ingest"] === "error" ? "✗ Failed" :
                  "Ingest Mail"
                }
                result={actionResults["ingest"]}
                disabled={busyActions.has("ingest") || !canSubmitInbound}
              />
            </form>
          </Card>

          <Card title="Registered Agents">
            <Table
              columns={["Agent", "Mailbox", "Webhook"]}
              rows={(service.data?.agents ?? []).map((row: ServiceState["agents"][number]) => ({
                key: row.id,
                cells: [row.displayName, row.mailboxId, row.webhookUrl],
              }))}
              emptyMessage="No registered agents yet."
            />
          </Card>

          <Card title="Inbound Queue">
            <Table
              columns={["From", "Status", "Received", "Txid"]}
              onRowClick={(id) => {
                const letter = service.data?.inboundLetters.find((l) => l.id === id);
                if (letter) setModal({ kind: "service-inbound", letter });
              }}
              rows={deferredServiceInbound.map((letter: ServiceState["inboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.fromName}</strong>
                    <small>{letter.envelopeSummary}</small>
                  </div>,
                  <StatusBadge status={letter.status} />,
                  new Date(letter.receivedAt).toLocaleString(),
                  <span onClick={(e) => e.stopPropagation()}>
                    <TxLink txid={letter.unlockPaymentTxid ?? undefined} />
                  </span>,
                ],
              }))}
              emptyMessage="No inbound letters yet."
            />
          </Card>

          <Card title="Outbound Queue">
            <Table
              columns={["Subject", "Status", "Created", "Action"]}
              onRowClick={(id) => {
                const letter = service.data?.outboundLetters.find((l) => l.id === id);
                if (letter) setModal({ kind: "service-outbound", letter });
              }}
              rows={deferredServiceOutbound.map((letter: ServiceState["outboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.subject}</strong>
                    <small>{letter.recipient.name}</small>
                  </div>,
                  <StatusBadge status={letter.status} />,
                  new Date(letter.createdAt).toLocaleString(),
                  letter.status === "queued" ? (
                    sentToPrinterIds.has(letter.id) ? (
                      <button
                        className="ghost-button"
                        disabled={busyActions.has(`mark-${letter.id}`)}
                        onClick={(e) => {
                          e.stopPropagation();
                          void runAction(`mark-${letter.id}`, () =>
                            api.markOutboundSent(letter.id),
                          ).then(() => {
                            setSentToPrinterIds((prev) => {
                              const next = new Set(prev);
                              next.delete(letter.id);
                              return next;
                            });
                          });
                        }}
                      >
                        {busyActions.has(`mark-${letter.id}`) ? "Marking..." : "Mark sent"}
                      </button>
                    ) : (
                      <button
                        className="ghost-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSentToPrinterIds((prev) => new Set([...prev, letter.id]));
                        }}
                      >
                        Send to printer
                      </button>
                    )
                  ) : null,
                ],
              }))}
              emptyMessage="No outbound letters yet."
            />
          </Card>

          <EventCard
            title="Latest Ops x402 Event"
            message={currentServiceEvent?.message ?? "Waiting for the first service event."}
            txid={currentServiceEvent?.txid}
            network={currentServiceEvent?.network}
          />
        </section>
      </main>

      {(agent.error || service.error || uiError) && (
        <footer className="error-strip">
          {agent.error && <span>Agent: {agent.error}</span>}
          {service.error && <span>Service: {service.error}</span>}
          {uiError && <span>UI: {uiError}</span>}
        </footer>
      )}

      {modal && (
        <Modal
          title={
            modal.kind === "agent-inbound" || modal.kind === "service-inbound"
              ? modal.letter.fromName
              : modal.letter.subject
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "agent-inbound" && (
            <>
              <ModalField label="Sender address" value={modal.letter.envelopeSummary} />
              <ModalField label="Status" value={modal.letter.agentStatus} />
              <ModalField label="Received" value={new Date(modal.letter.receivedAt).toLocaleString()} />
              <ModalField
                label="Full letter text"
                value={modal.letter.ocrText ?? "Not yet unlocked. Use the Get full button to pay and receive the letter text."}
                preformatted={!!modal.letter.ocrText}
              />
            </>
          )}
          {modal.kind === "agent-outbound" && (
            <>
              <ModalField label="To" value={formatAddress(modal.letter.recipient)} preformatted />
              <ModalField label="Status" value={modal.letter.status} />
              <ModalField label="Created" value={new Date(modal.letter.createdAt).toLocaleString()} />
              {modal.letter.sentAt && (
                <ModalField label="Sent" value={new Date(modal.letter.sentAt).toLocaleString()} />
              )}
              <ModalField label="Body" value={modal.letter.bodyMarkdown} preformatted />
            </>
          )}
          {modal.kind === "service-inbound" && (
            <>
              <ModalField label="Sender address" value={modal.letter.envelopeSummary} />
              <ModalField label="Status" value={modal.letter.status} />
              <ModalField label="Received" value={new Date(modal.letter.receivedAt).toLocaleString()} />
              <ModalField label="To: Mailbox ID" value={modal.letter.mailboxId} />
              <ModalField label="Letter text" value={modal.letter.ocrText} preformatted />
            </>
          )}
          {modal.kind === "service-outbound" && (
            <>
              <ModalField label="To" value={formatAddress(modal.letter.recipient)} preformatted />
              <ModalField label="Status" value={modal.letter.status} />
              <ModalField label="Created" value={new Date(modal.letter.createdAt).toLocaleString()} />
              {modal.letter.sentAt && (
                <ModalField label="Sent" value={new Date(modal.letter.sentAt).toLocaleString()} />
              )}
              <ModalField label="Body" value={modal.letter.bodyMarkdown} preformatted />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function PaneHeader(props: { title: string; subtitle: string }) {
  return (
    <div className="pane-header">
      <h2>{props.title}</h2>
      <p>{props.subtitle}</p>
    </div>
  );
}

function PricePill(props: { icon: string; label: string; value: string }) {
  return (
    <div className="price-pill">
      <span className="price-icon">{props.icon}</span>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MetricCard(props: { label: string; value: string; symbol?: string }) {
  return (
    <div className="metric-card">
      <span>{props.label}</span>
      <div className="metric-value">
        <strong>{props.value}</strong>
        {props.symbol && <span className="metric-symbol">{props.symbol}</span>}
      </div>
    </div>
  );
}

function Card(props: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-header">
        <h3>{props.title}</h3>
      </div>
      {props.children}
    </section>
  );
}

function EventCard(props: { title: string; message: string; txid?: string; network?: string }) {
  return (
    <Card title={props.title}>
      <div className="event-card">
        <p>{props.message}</p>
        <TxLink txid={props.txid} network={props.network} />
      </div>
    </Card>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function ActionButton(props: { label: string; disabled?: boolean; result?: "success" | "error" }) {
  const cls = [
    "action-button",
    props.result === "success" ? "action-button--success" : "",
    props.result === "error" ? "action-button--error" : "",
  ].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={props.disabled} type="submit">
      {props.label}
    </button>
  );
}

function StatusBadge(props: { status: string }) {
  return <span className={`status-badge status-${props.status}`}>{props.status}</span>;
}

function TxLink(props: { txid?: string; network?: string }) {
  if (!props.txid) {
    return <span className="muted">No txid yet</span>;
  }

  const base = props.network === ALGORAND_MAINNET_QUANTOZ
    ? ALGORAND_MAINNET_EXPLORER_BASE_URL
    : ALGORAND_EXPLORER_BASE_URL;

  return (
    <a
      className="tx-link"
      href={`${base}${props.txid}`}
      rel="noreferrer"
      target="_blank"
    >
      {props.txid.slice(0, 10)}...
    </a>
  );
}

function Table(props: {
  columns: string[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
  emptyMessage: string;
  onRowClick?: (key: string) => void;
}) {
  if (props.rows.length === 0) {
    return <p className="muted">{props.emptyMessage}</p>;
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr
              key={row.key}
              className={props.onRowClick ? "clickable-row" : undefined}
              onClick={props.onRowClick ? () => props.onRowClick!(row.key) : undefined}
            >
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{props.title}</h3>
          <button className="modal-close" onClick={props.onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          {props.children}
        </div>
      </div>
    </div>
  );
}

function ModalField(props: { label: string; value: string; preformatted?: boolean }) {
  return (
    <div className="modal-field">
      <span className="modal-field-label">{props.label}</span>
      {props.preformatted ? (
        <pre className="modal-text-block">{props.value}</pre>
      ) : (
        <span className="modal-field-value">{props.value}</span>
      )}
    </div>
  );
}

function formatAddress(addr: Address): string {
  const parts = [addr.street1];
  if (addr.street2) parts.push(addr.street2);
  parts.push(`${addr.postalCode} ${addr.city}`);
  parts.push(addr.country);
  return parts.join("\n");
}

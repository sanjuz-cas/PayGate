#!/usr/bin/env node
/**
 * PayGate — Gmail & Inbound Email Webhook Bridge
 * 
 * Usage:
 *   node scripts/gmail-listener.mjs --test
 *   node scripts/gmail-listener.mjs --port 4025
 */

import http from "node:http";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:4022";
const PORT = process.env.EMAIL_BRIDGE_PORT || 4025;

console.log("==================================================");
console.log("   PayGate — Inbound Gmail & Email Bridge         ");
console.log("==================================================");

async function forwardEmailToAgent(emailData) {
  try {
    const response = await fetch(`${AGENT_API_URL}/webhooks/gmail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailData),
    });

    const result = await response.json();
    console.log(`[Email Bridge] Forwarded to Agent: ${response.status}`, result);
    return result;
  } catch (error) {
    console.error("[Email Bridge] Failed to forward email:", error.message);
  }
}

// If run with --test, trigger a mock Gmail notice
if (process.argv.includes("--test")) {
  console.log("[Email Bridge] Sending test urgent tax notice from Gmail...");
  await forwardEmailToAgent({
    from: "tax-notice@finanzamt-berlin.de",
    fromName: "Finanzamt Berlin",
    subject: "Urgent: Corporate Tax Assessment 2025 Clarification Notice",
    bodyText: "Sehr geehrte Damen und Herren,\n\nwir bitten um die Einreichung der fehlenden Unterlagen für das Geschäftsjahr 2025 bis zum 30. September.\n\nMit freundlichen Grüßen,\nFinanzamt Berlin",
    attachments: [
      {
        filename: "Tax_Assessment_Notice_2025.pdf",
        text: "Official Tax Notice Extract: Reference #DE-TAX-2025-99214. Outstanding clarification required.",
      },
    ],
  });
  process.exit(0);
}

// Start HTTP Webhook listener for Zapier, Sendgrid, Mailgun, or Gmail Pub/Sub
const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && (req.url === "/webhook/email" || req.url === "/")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const email = JSON.parse(body);
        console.log(`[Email Bridge] Received email from: ${email.from} | Subject: "${email.subject}"`);
        const result = await forwardEmailToAgent(email);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, agentResult: result }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", bridge: "PayGate Gmail Listener" }));
  }
});

server.listen(PORT, () => {
  console.log(`[Email Bridge] Listening for incoming email webhooks on http://localhost:${PORT}/webhook/email`);
  console.log(`[Email Bridge] Forwarding directly to Agent API at ${AGENT_API_URL}/webhooks/gmail`);
});

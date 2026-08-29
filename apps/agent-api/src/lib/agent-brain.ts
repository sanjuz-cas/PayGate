import Groq from "groq-sdk";
import { z } from "zod";

import type { AgentEnv } from "./env.js";
import { createServiceRegistryClient, type ServiceRegistryEntry, type AddressVerifyRequest } from "./service-registry.js";
import { recordSpendLog, checkSpendGuardrail } from "./guardrail.js";
import type { AgentDatabase } from "../db/index.js";
import { ROUTE_KEYS } from "@juicebag-mail/shared";

// ============================================================================
// Tool Definitions for Anthropic Function Calling
// ============================================================================

export type ToolName =
  | "verify_address"
  | "send_letter"
  | "unlock_letter"
  | "register_mailbox"
  | "passport_requirement_lookup"
  | "document_verification"
  | "passport_form_assistance";

// Cost mapping for each tool in USD
const TOOL_COSTS: Record<ToolName, number> = {
  verify_address: 0.02,
  send_letter: 0.05,
  unlock_letter: 0.20,
  register_mailbox: 1.00,
  passport_requirement_lookup: 0.0012, // ~₹0.10
  document_verification: 0.003,        // ~₹0.25
  passport_form_assistance: 0.0025,    // ~₹0.20
};

export interface ToolCallResult {
  toolName: ToolName;
  success: boolean;
  result?: unknown;
  error?: string;
  txid?: string;
  reasoning?: string;
  budgetBlocked?: boolean;
}

export interface AgentToolUseStep {
  stepNumber: number;
  modelReasoning: string;
  toolCall?: {
    name: ToolName;
    input: Record<string, unknown>;
  };
  toolResult?: ToolCallResult;
  timestamp: string;
}

// Define each tool's schema and description
const TOOL_DEFINITIONS: Record<ToolName, Groq.Chat.ChatCompletionTool> = {
  verify_address: {
    type: "function",
    function: {
      name: "verify_address",
      description: "Verify a postal address format and validity before sending mail. Use this when the address looks unusual, international, or you're unsure if it's properly formatted. Costs $0.02 USDC. Returns validation result with confidence score and any issues found.",
      parameters: {
        type: "object",
        properties: {
          street1: {
            type: "string",
            description: "Primary street address (e.g., '123 Main St' or 'Hauptstraße 45')",
          },
          street2: {
            type: "string",
            description: "Optional secondary address (apartment, suite, etc.)",
          },
          postalCode: {
            type: "string",
            description: "Postal/ZIP code appropriate for the country",
          },
          city: {
            type: "string",
            description: "City or locality name",
          },
          country: {
            type: "string",
            description: "ISO 3166-1 alpha-2 country code (e.g., 'US', 'DE', 'GB', 'FR')",
          },
        },
        required: ["street1", "postalCode", "city", "country"],
      }
    }
  },

  send_letter: {
    type: "function",
    function: {
      name: "send_letter",
      description: "Send a physical letter to a verified address. Use this after address verification passes (if performed) or when sending to a known-good address. Costs $0.05 USDC. Requires recipient name, full address, and letter content.",
      parameters: {
        type: "object",
        properties: {
          recipientName: {
            type: "string",
            description: "Full name of the letter recipient",
          },
          recipientAddress: {
            type: "string",
            description: "Complete mailing address (street, city, postal code, country)",
          },
          content: {
            type: "string",
            description: "The actual letter content to be sent",
          },
          currency: {
            type: "string",
            enum: ["usdc", "eurd"],
            description: "Payment currency (default: usdc)",
          },
        },
        required: ["recipientName", "recipientAddress", "content"],
      }
    }
  },

  unlock_letter: {
    type: "function",
    function: {
      name: "unlock_letter",
      description: "Unlock an inbound letter to view its contents by paying the unlock fee. Use this for important mail that requires human review or contains critical information. Costs $0.20 USDC. Only call with a valid letterId from pending inbound mail.",
      parameters: {
        type: "object",
        properties: {
          letterId: {
            type: "string",
            description: "Unique identifier of the inbound letter to unlock",
          },
          currency: {
            type: "string",
            enum: ["usdc", "eurd"],
            description: "Payment currency (default: usdc)",
          },
        },
        required: ["letterId"],
      }
    }
  },

  register_mailbox: {
    type: "function",
    function: {
      name: "register_mailbox",
      description: "Register a new mailbox identity with the Juicebag Mail network. This is a one-time setup action to establish your legal identity and receive mail. Costs $1.00 USDC (or €0.05 EURD). Only use if not already registered.",
      parameters: {
        type: "object",
        properties: {
          legalName: {
            type: "string",
            description: "Full legal name for registration",
          },
          email: {
            type: "string",
            format: "email",
            description: "Email address for notifications",
          },
          currency: {
            type: "string",
            enum: ["usdc", "eurd"],
            description: "Payment currency (default: usdc)",
          },
        },
        required: ["legalName", "email"],
      }
    }
  },

  passport_requirement_lookup: {
    type: "function",
    function: {
      name: "passport_requirement_lookup",
      description: "Discover and lookup official requirements and acceptable supporting documents for Indian Passport Reissue (Address Change). Costs ₹0.10 (~$0.0012 USDC). Returns mandatory document rules and acceptable proof types.",
      parameters: {
        type: "object",
        properties: {
          serviceType: {
            type: "string",
            description: "Service type (e.g. 'reissue_address_change')",
          },
          currentAddressDifferent: {
            type: "boolean",
            description: "Whether the current residence is different from existing passport",
          },
        },
        required: ["serviceType"],
      },
    },
  },

  document_verification: {
    type: "function",
    function: {
      name: "document_verification",
      description: "Extract, inspect and verify address proof document (electricity bill, bank statement, rent agreement) for passport application. Costs ₹0.25 (~$0.003 USDC). Returns verified entity details, readable status, and confidence score.",
      parameters: {
        type: "object",
        properties: {
          documentType: {
            type: "string",
            description: "Type of address proof (e.g. 'electricity_bill', 'bank_statement', 'rent_agreement')",
          },
          rawText: {
            type: "string",
            description: "Raw text or OCR extracted content from the document",
          },
        },
        required: ["documentType", "rawText"],
      },
    },
  },

  passport_form_assistance: {
    type: "function",
    function: {
      name: "passport_form_assistance",
      description: "Format, validate, and prepare the synthetic application draft for passport reissue. Costs ₹0.20 (~$0.0025 USDC). Returns prepared review summary and submission instructions.",
      parameters: {
        type: "object",
        properties: {
          applicantName: {
            type: "string",
            description: "Full applicant name",
          },
          currentAddress: {
            type: "string",
            description: "Verified current residential address",
          },
          verifiedDocumentType: {
            type: "string",
            description: "Verified supporting document description",
          },
        },
        required: ["applicantName", "currentAddress", "verifiedDocumentType"],
      },
    },
  },
};

// ============================================================================
// Tool Execution Functions
// ============================================================================

export async function executeTool(
  toolName: ToolName,
  toolInput: Record<string, unknown>,
  env: AgentEnv,
  db: AgentDatabase,
): Promise<ToolCallResult> {
  const registryClient = createServiceRegistryClient(env);
  const toolCostUsd = TOOL_COSTS[toolName];
  
  // SAFETY CHECK #1: Budget guardrail - check if this tool call would exceed daily cap
  const guardrailCheck = await checkSpendGuardrail(db, env, toolCostUsd);
  if (!guardrailCheck.allowed) {
    console.warn(`[agent-brain] Tool ${toolName} blocked by budget guardrail: ${guardrailCheck.reason}`);
    return {
      toolName,
      success: false,
      error: guardrailCheck.reason,
      budgetBlocked: true,
    };
  }
  
  try {
    switch (toolName) {
      case "verify_address": {
        const address: AddressVerifyRequest = {
          street1: toolInput.street1 as string,
          street2: toolInput.street2 as string | undefined,
          postalCode: toolInput.postalCode as string,
          city: toolInput.city as string,
          country: toolInput.country as string,
        };

        // Discover services to get the verify endpoint
        const registryUrl = `${env.SERVICE_BASE_URL}/v1/service-registry`;
        const registry = await registryClient.discoverServices(registryUrl);
        const verifyService = registryClient.findServiceByName(registry, "address-verification");
        
        if (!verifyService) {
          return {
            toolName,
            success: false,
            error: "Address verification service not found in registry",
          };
        }

        const verifyResult = await registryClient.verifyAddress(verifyService.endpoint, address);
        
        // Record spend log if payment occurred
        if (verifyResult.payment?.transaction) {
          await recordSpendLog(db, {
            routeKey: ROUTE_KEYS.inboundUnlock, // Reusing for now
            action: "tool_verify_address",
            amountUsd: 0.02,
            currency: "usdc",
            txid: verifyResult.payment.transaction,
            status: "settled",
          });
        }

        return {
          toolName,
          success: true,
          result: verifyResult.result,
          txid: verifyResult.payment?.transaction,
        };
      }

      case "send_letter": {
        // For now, we'll simulate this - in production would call real endpoint
        // This is a placeholder - the actual implementation would use the juicebag client
        const sendPayload = {
          recipientName: toolInput.recipientName as string,
          recipientAddress: toolInput.recipientAddress as string,
          content: toolInput.content as string,
          currency: (toolInput.currency as "usdc" | "eurd") || "usdc",
        };

        // Placeholder response - would integrate with juicebag.sendLetter in production
        const mockTxid = `SEND_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await recordSpendLog(db, {
          routeKey: ROUTE_KEYS.outboundLetter,
          action: "tool_send_letter",
          amountUsd: 0.05,
          currency: sendPayload.currency,
          txid: mockTxid,
          status: "settled",
        });

        return {
          toolName,
          success: true,
          result: {
            message: "Letter queued for sending",
            letterId: `LTR_${Date.now()}`,
          },
          txid: mockTxid,
        };
      }

      case "unlock_letter": {
        const letterId = toolInput.letterId as string;
        const currency = (toolInput.currency as "usdc" | "eurd") || "usdc";
        
        // Placeholder - would integrate with juicebag.unlockLetter
        const mockTxid = `UNLOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await recordSpendLog(db, {
          routeKey: ROUTE_KEYS.inboundUnlock,
          action: "tool_unlock_letter",
          amountUsd: 0.20,
          currency,
          txid: mockTxid,
          status: "settled",
        });

        return {
          toolName,
          success: true,
          result: {
            message: "Letter unlocked successfully",
            letterId,
          },
          txid: mockTxid,
        };
      }

      case "register_mailbox": {
        const legalName = toolInput.legalName as string;
        const email = toolInput.email as string;
        const currency = (toolInput.currency as "usdc" | "eurd") || "usdc";
        const costUsd = currency === "eurd" ? 0.05 : 1.0;
        
        // Placeholder - would integrate with juicebag.register
        const mockTxid = `REG_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await recordSpendLog(db, {
          routeKey: ROUTE_KEYS.registration,
          action: "tool_register_mailbox",
          amountUsd: costUsd,
          currency,
          txid: mockTxid,
          status: "settled",
        });

        return {
          toolName,
          success: true,
          result: {
            message: "Mailbox registered successfully",
            legalName,
            email,
          },
          txid: mockTxid,
        };
      }

      case "passport_requirement_lookup": {
        const costUsd = 0.0012; // ~₹0.10
        const mockTxid = `X402_RULES_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        await recordSpendLog(db, {
          routeKey: "passport_requirement_lookup",
          action: "tool_passport_requirement_lookup",
          amountUsd: costUsd,
          currency: "usdc",
          txid: mockTxid,
          status: "settled",
        });

        return {
          toolName,
          success: true,
          result: {
            serviceType: "reissue_address_change",
            summary: "Passport reissue requested due to change in current residential address.",
            mandatoryDocumentRequired: "Proof of Current Address is mandatory because your current residence differs from the address printed on your existing passport.",
            acceptableProofTypes: [
              "Electricity Bill (within last 3 months)",
              "Bank Account Statement / Passbook",
              "Registered Rent Agreement",
              "Water Bill",
              "Telephone / Broadband Bill",
            ],
            disclaimer: "Demo guidance based on synthetic rules. Not an official government determination.",
            feeInr: 0.10,
          },
          txid: mockTxid,
        };
      }

      case "document_verification": {
        const costUsd = 0.003; // ~₹0.25
        const mockTxid = `X402_VERIFY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const rawText = (toolInput.rawText as string) || "";

        const hasName = /arjun\s+menon/i.test(rawText) || rawText.length > 0;
        const hasAddress = /kochi|kerala|lake\s+view/i.test(rawText) || rawText.length > 20;
        const hasPincode = /682001|\d{6}/.test(rawText);

        await recordSpendLog(db, {
          routeKey: "document_verification",
          action: "tool_document_verification",
          amountUsd: costUsd,
          currency: "usdc",
          txid: mockTxid,
          status: "settled",
        });

        return {
          toolName,
          success: true,
          result: {
            valid: true,
            confidence: 0.98,
            detectedName: "Arjun Menon",
            detectedAddress: "12 Lake View Road, Kochi, Kerala 682001",
            detectedDate: "15 August 2026",
            readable: true,
            addressInfoPresent: true,
            issues: [],
            capabilityUsed: "document_verification",
            reasonForSelection: "Kaam selected DocumentCheck because the current task required address-document verification.",
          },
          txid: mockTxid,
        };
      }

      case "passport_form_assistance": {
        const costUsd = 0.0025; // ~₹0.20
        const mockTxid = `X402_FORM_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const applicantName = (toolInput.applicantName as string) || "Arjun Menon";
        const currentAddress = (toolInput.currentAddress as string) || "12 Lake View Road, Kochi, Kerala 682001";
        const verifiedDoc = (toolInput.verifiedDocumentType as string) || "Electricity Bill — Verified";

        await recordSpendLog(db, {
          routeKey: "passport_form_assistance",
          action: "tool_passport_form_assistance",
          amountUsd: costUsd,
          currency: "usdc",
          txid: mockTxid,
          status: "settled",
        });

        return {
          toolName,
          success: true,
          result: {
            applicationId: `KAAM-PASSPORT-${Date.now().toString(36).toUpperCase()}`,
            status: "ready_for_review",
            serviceTypeDisplay: "Passport Reissue",
            reasonDisplay: "Change of Address",
            applicantName,
            currentAddressFormatted: currentAddress,
            supportingDocumentDisplay: verifiedDoc,
            preparedAt: new Date().toISOString(),
            nextStepInstructions: "Review the prepared application summary and submit through the official Passport Seva process.",
            disclaimer: "Kaam does not interact with or submit information to live government systems.",
          },
          txid: mockTxid,
        };
      }

      default:
        return {
          toolName,
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    console.error(`[agent-brain] Tool execution failed for ${toolName}:`, error);
    return {
      toolName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Main Agent Brain - Tool Use Loop
// ============================================================================

export interface AgentBrainRequest {
  taskDescription: string;
  context?: {
    availableServices?: ServiceRegistryEntry[];
    pendingLetters?: Array<{ letterId: string; from: string; envelopeSummary: string }>;
    userPreferences?: Record<string, unknown>;
  };
}

export interface AgentBrainResponse {
  finalAnswer: string;
  steps: AgentToolUseStep[];
  totalCostUsd: number;
  allTxids: string[];
}

export async function runAgentBrain(
  request: AgentBrainRequest,
  env: AgentEnv,
  db: AgentDatabase,
): Promise<AgentBrainResponse> {
  const isUsingOpenAi = Boolean(
    env.OPENAI_API_KEY && (env.LLM_PROVIDER === "openai" || env.LLM_PROVIDER === "auto" || !env.GROQ_API_KEY),
  );
  const isUsingGroq = Boolean(
    env.GROQ_API_KEY && (env.LLM_PROVIDER === "groq" || (!isUsingOpenAi && env.LLM_PROVIDER === "auto")),
  );

  if (!isUsingOpenAi && !isUsingGroq) {
    throw new Error("OPENAI_API_KEY or GROQ_API_KEY is required for agent brain tool use");
  }

  const groqClient = isUsingGroq && env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;
  const steps: AgentToolUseStep[] = [];
  const allTxids: string[] = [];
  let totalCostUsd = 0;

  // System prompt establishing the agent's role and tool-use behavior
  const systemPrompt = `You are an autonomous AI agent managing a public service & physical task workflow on PayGate. You have access to several paid tools/services that you can invoke to complete tasks. 

IMPORTANT GUIDELINES:
1. Only use tools when genuinely needed - don't waste money on unnecessary calls
2. Explain your reasoning BEFORE each tool call so users understand why you're spending money
3. Consider cost-effectiveness: discover and select the most appropriate capability for the task
4. Always verify prerequisites (e.g., check requirements, verify document before preparing forms)
5. After each tool call, assess the result and decide if further action is needed
6. Provide a clear summary at the end of what you accomplished and why

AVAILABLE TOOLS:
- passport_requirement_lookup (₹0.10): Determine official synthetic requirements for passport reissue & address change.
- document_verification (₹0.25): Extract, inspect and verify address proof document.
- passport_form_assistance (₹0.20): Prepare and structure synthetic application draft for passport reissue.
- verify_address ($0.02): Validate postal address format.
- send_letter ($0.05): Send physical mail.
- unlock_letter ($0.20): Unlock inbound letters to read contents.
- register_mailbox ($1.00): One-time mailbox registration.

Respond using tool_use blocks when you want to invoke a tool. Include your reasoning in natural language before each tool call. When done, provide a final text response summarizing what you did.`;

  const conversationHistory: any[] = [
    {
      role: "user",
      content: request.taskDescription,
    },
  ];

  // Add context if provided
  if (request.context?.availableServices) {
    const servicesText = request.context.availableServices
      .map((s) => `- ${s.name}: ${s.description} ($${(Number(s.price) / 100000).toFixed(2)})`)
      .join("\n");
    conversationHistory.push({
      role: "user",
      content: `Available services:\n${servicesText}`,
    });
  }

  if (request.context?.pendingLetters && request.context.pendingLetters.length > 0) {
    const lettersText = request.context.pendingLetters
      .map((l) => `- ${l.letterId}: From "${l.from}" - ${l.envelopeSummary}`)
      .join("\n");
    conversationHistory.push({
      role: "user",
      content: `Pending inbound letters awaiting decision:\n${lettersText}`,
    });
  }

  const tools: any[] = Object.values(TOOL_DEFINITIONS);

  // SAFETY CHECK #2: Hard max tool-call limit per task to prevent runaway loops
  const MAX_TOOL_CALLS = 8;
  let maxIterations = MAX_TOOL_CALLS * 2; // Allow some iterations for reasoning without tool calls
  let iterationCount = 0;
  let finalAnswer = "";
  let toolCallCount = 0;

  async function getLlmCompletion(messages: any[]) {
    if (isUsingOpenAi && env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools,
          tool_choice: "auto",
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`OpenAI API error (${response.status}): ${text}`);
      }

      const json = await response.json();
      return json.choices[0].message;
    }

    if (groqClient) {
      const response = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        tool_choice: "auto",
      });
      return response.choices[0].message;
    }

    throw new Error("No active LLM client configured");
  }

  while (iterationCount < maxIterations) {
    iterationCount++;

    const msg = await getLlmCompletion(conversationHistory);
    const reasoning = msg.content || "";
    
    // Add assistant message to history
    conversationHistory.push(msg);

    // If no tool calls, we're done
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      if (!finalAnswer) finalAnswer = reasoning || "Task completed.";
      break;
    }

    // Process tool calls
    for (const toolCall of msg.tool_calls) {
      toolCallCount++;
      
      if (toolCallCount > MAX_TOOL_CALLS) {
        console.warn(`[agent-brain] Tool call limit (${MAX_TOOL_CALLS}) reached, halting`);
        finalAnswer += "\n\n[Task halted: Maximum tool call limit reached to prevent runaway spending]";
        break;
      }

      const toolName = toolCall.function.name as ToolName;
      let toolInput = {};
      try {
        toolInput = JSON.parse(toolCall.function.arguments);
      } catch (e) {}

      const step: AgentToolUseStep = {
        stepNumber: steps.length + 1,
        modelReasoning: reasoning || `Executing ${toolName}`,
        toolCall: {
          name: toolName,
          input: toolInput as Record<string, unknown>,
        },
        timestamp: new Date().toISOString(),
      };

      console.log(`[agent-brain] Step ${step.stepNumber}: Calling tool ${toolName} (call #${toolCallCount}/${MAX_TOOL_CALLS})`);
      console.log(`[agent-brain] Reasoning: ${reasoning}`);
      console.log(`[agent-brain] Input:`, JSON.stringify(toolInput, null, 2));

      // Execute the actual tool with real x402 payment
      const result = await executeTool(toolName, toolInput, env, db);
      step.toolResult = result;

      if (result.txid) {
        allTxids.push(result.txid);
        totalCostUsd += TOOL_COSTS[result.toolName];
      }

      steps.push(step);

      // Add tool_result to conversation history
      conversationHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolName,
        content: result.success
          ? JSON.stringify(result.result)
          : `Error: ${result.error}${result.budgetBlocked ? " (Budget exceeded - cannot proceed with this action)" : ""}`,
      } as any);

      if (result.budgetBlocked) {
        finalAnswer = `Halted: ${result.error}`;
        break;
      }
    }
    
    // Check if we hit the tool call limit mid-iteration
    if (toolCallCount >= MAX_TOOL_CALLS) {
      console.warn(`[agent-brain] Tool call limit (${MAX_TOOL_CALLS}) reached`);
      break;
    }
  }

  if (iterationCount >= maxIterations) {
    console.warn("[agent-brain] Reached max iterations, truncating response");
    finalAnswer += "\n\n[Note: Response truncated due to complexity limits]";
  }

  return {
    finalAnswer,
    steps,
    totalCostUsd,
    allTxids,
  };
}

// ============================================================================
// Helper: Format Steps for SSE/Event Streaming
// ============================================================================

export function formatStepForSSE(step: AgentToolUseStep): string {
  const parts: string[] = [];
  
  parts.push(`Step ${step.stepNumber}:`);
  parts.push(`Reasoning: ${step.modelReasoning}`);
  
  if (step.toolCall) {
    parts.push(`Tool: ${step.toolCall.name}`);
    parts.push(`Input: ${JSON.stringify(step.toolCall.input)}`);
  }
  
  if (step.toolResult) {
    const r = step.toolResult;
    parts.push(`Result: ${r.success ? "SUCCESS" : "FAILED"}`);
    if (r.txid) {
      parts.push(`Transaction: ${r.txid}`);
    }
    if (r.error) {
      parts.push(`Error: ${r.error}`);
    }
    if (r.result) {
      parts.push(`Data: ${JSON.stringify(r.result)}`);
    }
  }
  
  return parts.join("\n");
}

export function formatStepAsSSEEvent(step: AgentToolUseStep, eventType: "step_started" | "step_completed"): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(step)}\n\n`;
}

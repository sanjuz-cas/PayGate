import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { AgentEnv } from "./env.js";
import { createServiceRegistryClient, type ServiceRegistryEntry, type AddressVerifyRequest } from "./service-registry.js";
import { recordSpendLog, checkSpendGuardrail } from "./guardrail.js";
import type { AgentDatabase } from "../db/index.js";
import { ROUTE_KEYS } from "@juicebag-mail/shared";

// ============================================================================
// Tool Definitions for Anthropic Function Calling
// ============================================================================

export type ToolName = "verify_address" | "send_letter" | "unlock_letter" | "register_mailbox";

// Cost mapping for each tool in USD
const TOOL_COSTS: Record<ToolName, number> = {
  verify_address: 0.02,
  send_letter: 0.05,
  unlock_letter: 0.20,
  register_mailbox: 1.00,
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
const TOOL_DEFINITIONS: Record<ToolName, Anthropic.Tool> = {
  verify_address: {
    name: "verify_address",
    description: "Verify a postal address format and validity before sending mail. Use this when the address looks unusual, international, or you're unsure if it's properly formatted. Costs $0.02 USDC. Returns validation result with confidence score and any issues found.",
    input_schema: {
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
    },
  },

  send_letter: {
    name: "send_letter",
    description: "Send a physical letter to a verified address. Use this after address verification passes (if performed) or when sending to a known-good address. Costs $0.05 USDC. Requires recipient name, full address, and letter content.",
    input_schema: {
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
    },
  },

  unlock_letter: {
    name: "unlock_letter",
    description: "Unlock an inbound letter to view its contents by paying the unlock fee. Use this for important mail that requires human review or contains critical information. Costs $0.20 USDC. Only call with a valid letterId from pending inbound mail.",
    input_schema: {
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
    },
  },

  register_mailbox: {
    name: "register_mailbox",
    description: "Register a new mailbox identity with the Juicebag Mail network. This is a one-time setup action to establish your legal identity and receive mail. Costs $1.00 USDC (or €0.05 EURD). Only use if not already registered.",
    input_schema: {
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
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for agent brain tool use");
  }

  const client = new Anthropic({ apiKey: anthropicApiKey });
  const steps: AgentToolUseStep[] = [];
  const allTxids: string[] = [];
  let totalCostUsd = 0;

  // System prompt establishing the agent's role and tool-use behavior
  const systemPrompt = `You are an autonomous AI agent managing a physical mailbox service. You have access to several paid tools/services that you can invoke to complete tasks. 

IMPORTANT GUIDELINES:
1. Only use tools when genuinely needed - don't waste money on unnecessary calls
2. Explain your reasoning BEFORE each tool call so users understand why you're spending money
3. Consider cost-effectiveness: skip address verification for well-known domestic addresses, but use it for international/unusual ones
4. Always verify prerequisites (e.g., verify address before sending if uncertain)
5. After each tool call, assess the result and decide if further action is needed
6. Provide a clear summary at the end of what you accomplished and why

AVAILABLE TOOLS:
- verify_address ($0.02): Validate postal address format. Use for unusual/international addresses or when uncertain.
- send_letter ($0.05): Send physical mail. Use after address verification passes or for known-good addresses.
- unlock_letter ($0.20): Unlock inbound letters to read contents. Use for important mail needing review.
- register_mailbox ($1.00): One-time mailbox registration. Only use if user isn't registered yet.

Respond using tool_use blocks when you want to invoke a tool. Include your reasoning in natural language before each tool call. When done, provide a final text response summarizing what you did.`;

  const conversationHistory: Anthropic.MessageParam[] = [
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

  const tools: Anthropic.Tool[] = Object.values(TOOL_DEFINITIONS);

  // SAFETY CHECK #2: Hard max tool-call limit per task to prevent runaway loops
  const MAX_TOOL_CALLS = 8;
  let maxIterations = MAX_TOOL_CALLS * 2; // Allow some iterations for reasoning without tool calls
  let iterationCount = 0;
  let finalAnswer = "";
  let toolCallCount = 0;

  while (iterationCount < maxIterations) {
    iterationCount++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory,
      tools,
      tool_choice: { type: "auto" },
    });

    // Process response content
    for (const block of response.content) {
      if (block.type === "text") {
        // Check if this looks like a final answer (no more tool calls coming)
        if (!conversationHistory.some((h) => h.role === "assistant")) {
          finalAnswer = block.text;
        }
      } else if (block.type === "tool_use") {
        toolCallCount++;
        
        // SAFETY CHECK #2: Enforce hard max tool-call limit
        if (toolCallCount > MAX_TOOL_CALLS) {
          console.warn(`[agent-brain] Tool call limit (${MAX_TOOL_CALLS}) reached, halting`);
          finalAnswer += "\n\n[Task halted: Maximum tool call limit reached to prevent runaway spending]";
          break;
        }
        
        const toolName = block.name as ToolName;
        const toolInput = block.input as Record<string, unknown>;
        
        // Extract reasoning from the last assistant message or use a default
        const lastAssistantMsg = conversationHistory.filter((h) => h.role === "assistant").pop();
        const reasoning = lastAssistantMsg?.content?.toString() || "Executing tool call";

        const step: AgentToolUseStep = {
          stepNumber: steps.length + 1,
          modelReasoning: reasoning,
          toolCall: {
            name: toolName,
            input: toolInput,
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

        // Add tool_use and tool_result to conversation history
        conversationHistory.push({
          role: "assistant",
          content: [block],
        });

        conversationHistory.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id,
              content: result.success
                ? JSON.stringify(result.result)
                : `Error: ${result.error}${result.budgetBlocked ? " (Budget exceeded - cannot proceed with this action)" : ""}`,
            },
          ],
        });

        // Continue loop to let model process result and decide next action
        break; // Break to continue the while loop with updated history
      }
    }

    // If no tool_use blocks were found, we have a final answer
    const hasToolUse = response.content.some((b) => b.type === "tool_use");
    if (!hasToolUse) {
      // Extract final text from response
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock) {
        finalAnswer = textBlock.text;
      }
      break; // Exit the loop
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

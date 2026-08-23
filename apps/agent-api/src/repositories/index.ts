import { desc, eq, gte, and } from "drizzle-orm";
import type { AgentDatabase } from "../db/index.js";
import {
  inboundLetters,
  outboundLetters,
  registration,
  webhookEvents,
  autonomyDecisions,
  agentSpendLog,
  payments,
} from "../db/schema.js";
import type { AutonomyDecision } from "@juicebag-mail/shared";
import { TIME_WINDOWS, PAGINATION } from "../constants/index.js";

/**
 * Repository pattern implementation for database access
 * Provides a clean abstraction layer over direct database operations
 */

export class InboundLetterRepository {
  constructor(private db: AgentDatabase) {}

  async findById(letterId: string) {
    const results = await this.db
      .select()
      .from(inboundLetters)
      .where(eq(inboundLetters.letterId, letterId))
      .limit(1);

    return results[0] ?? null;
  }

  async findByMailboxId(mailboxId: string, limit = PAGINATION.DEFAULT_PAGE_SIZE) {
    return await this.db
      .select()
      .from(inboundLetters)
      .where(eq(inboundLetters.mailboxId, mailboxId))
      .orderBy(desc(inboundLetters.receivedAt))
      .limit(limit);
  }

  async findPending(limit = PAGINATION.DEFAULT_PAGE_SIZE) {
    return await this.db
      .select()
      .from(inboundLetters)
      .where(eq(inboundLetters.status, "pending"))
      .orderBy(desc(inboundLetters.receivedAt))
      .limit(limit);
  }

  async create(letterData: typeof inboundLetters.$inferInsert) {
    await this.db.insert(inboundLetters).values(letterData);
    return this.findById(letterData.letterId!);
  }

  async updateStatus(letterId: string, status: string) {
    await this.db
      .update(inboundLetters)
      .set({ status })
      .where(eq(inboundLetters.letterId, letterId));

    return this.findById(letterId);
  }

  async markAsUnlocked(letterId: string, unlockPaymentTxid: string) {
    await this.db
      .update(inboundLetters)
      .set({
        status: "unlocked",
        unlockPaymentTxid,
      })
      .where(eq(inboundLetters.letterId, letterId));

    return this.findById(letterId);
  }

  async markAsIgnored(letterId: string) {
    await this.db
      .update(inboundLetters)
      .set({ status: "ignored" })
      .where(eq(inboundLetters.letterId, letterId));
  }
}

export class OutboundLetterRepository {
  constructor(private db: AgentDatabase) {}

  async findById(letterId: string) {
    const results = await this.db
      .select()
      .from(outboundLetters)
      .where(eq(outboundLetters.letterId, letterId))
      .limit(1);

    return results[0] ?? null;
  }

  async findByMailboxId(mailboxId: string, limit = PAGINATION.DEFAULT_PAGE_SIZE) {
    return await this.db
      .select()
      .from(outboundLetters)
      .where(eq(outboundLetters.mailboxId, mailboxId))
      .orderBy(desc(outboundLetters.createdAt))
      .limit(limit);
  }

  async create(letterData: typeof outboundLetters.$inferInsert) {
    await this.db.insert(outboundLetters).values(letterData);
    return this.findById(letterData.letterId!);
  }

  async updateStatus(letterId: string, status: string) {
    await this.db
      .update(outboundLetters)
      .set({ status })
      .where(eq(outboundLetters.letterId, letterId));

    return this.findById(letterId);
  }
}

export class RegistrationRepository {
  constructor(private db: AgentDatabase) {}

  async findCurrent() {
    const results = await this.db
      .select()
      .from(registration)
      .where(eq(registration.status, "registered"))
      .limit(1);

    return results[0] ?? null;
  }

  async create(registrationData: typeof registration.$inferInsert) {
    await this.db.insert(registration).values(registrationData);
    return this.findCurrent();
  }

  async exists(): Promise<boolean> {
    const current = await this.findCurrent();
    return current !== null;
  }
}

export class PaymentRepository {
  constructor(private db: AgentDatabase) {}

  async create(paymentData: typeof payments.$inferInsert) {
    await this.db.insert(payments).values(paymentData);
  }

  async findRecent(limit = PAGINATION.DEFAULT_PAGE_SIZE) {
    return await this.db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  }

  async sumLast24Hours(): Promise<number> {
    const windowStart = new Date(
      Date.now() - TIME_WINDOWS.SPEND_WINDOW_MS
    ).toISOString();

    const settledPayments = await this.db
      .select()
      .from(payments)
      .where(gte(payments.createdAt, windowStart));

    return settledPayments.reduce((acc, p) => {
      const val = Number(p.amountUsd);
      return acc + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }
}

export class AutonomyDecisionRepository {
  constructor(private db: AgentDatabase) {}

  async create(decision: AutonomyDecision, executed = false) {
    await this.db.insert(autonomyDecisions).values({
      id: `aut_${Date.now()}`,
      letterId: decision.letterId,
      fromName: decision.fromName,
      envelopeSummary: decision.envelopeSummary,
      decision: decision.decision,
      reason: decision.reason,
      confidence: String(decision.confidence),
      executed: executed ? 1 : 0,
      createdAt: decision.evaluatedAt,
    });
  }

  async findRecent(limit = PAGINATION.DEFAULT_PAGE_SIZE): Promise<AutonomyDecision[]> {
    const rows = await this.db
      .select()
      .from(autonomyDecisions)
      .orderBy(desc(autonomyDecisions.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      letterId: r.letterId,
      fromName: r.fromName,
      envelopeSummary: r.envelopeSummary,
      decision: r.decision as "unlock" | "ignore" | "defer",
      reason: r.reason,
      confidence: Number(r.confidence) || 1.0,
      evaluatedAt: r.createdAt,
    }));
  }
}

export class SpendLogRepository {
  constructor(private db: AgentDatabase) {}

  async create(logData: typeof agentSpendLog.$inferInsert) {
    await this.db.insert(agentSpendLog).values(logData);
  }

  async findRecent(limit = PAGINATION.DEFAULT_PAGE_SIZE) {
    const rows = await this.db
      .select()
      .from(agentSpendLog)
      .orderBy(desc(agentSpendLog.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      routeKey: r.routeKey,
      action: r.action,
      amountUsd: Number(r.amountUsd),
      currency: r.currency,
      txid: r.txid ?? undefined,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}

export class WebhookEventRepository {
  constructor(private db: AgentDatabase) {}

  async create(eventData: typeof webhookEvents.$inferInsert) {
    await this.db.insert(webhookEvents).values(eventData);
  }

  async findRecent(limit = PAGINATION.DEFAULT_PAGE_SIZE) {
    return await this.db
      .select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit);
  }
}

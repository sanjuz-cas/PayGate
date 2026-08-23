import type { AgentDatabase } from "../db/index.js";
import type { AgentEnv } from "../lib/env.js";
import { InboundLetterRepository } from "../repositories/index.js";
import { OutboundLetterRepository } from "../repositories/index.js";
import { RegistrationRepository } from "../repositories/index.js";
import { PaymentRepository } from "../repositories/index.js";
import { AutonomyDecisionRepository } from "../repositories/index.js";
import { SpendLogRepository } from "../repositories/index.js";
import { WebhookEventRepository } from "../repositories/index.js";

/**
 * Dependency Injection Container
 * Centralizes dependency management and promotes loose coupling
 */

export interface ContainerDependencies {
  db: AgentDatabase;
  env: AgentEnv;
}

export class Container {
  private static instance: Container | null = null;
  
  private _db: AgentDatabase;
  private _env: AgentEnv;
  
  // Repositories (lazy-initialized)
  private _inboundLetterRepo: InboundLetterRepository | null = null;
  private _outboundLetterRepo: OutboundLetterRepository | null = null;
  private _registrationRepo: RegistrationRepository | null = null;
  private _paymentRepo: PaymentRepository | null = null;
  private _autonomyDecisionRepo: AutonomyDecisionRepository | null = null;
  private _spendLogRepo: SpendLogRepository | null = null;
  private _webhookEventRepo: WebhookEventRepository | null = null;

  private constructor(db: AgentDatabase, env: AgentEnv) {
    this._db = db;
    this._env = env;
  }

  /**
   * Initialize the DI container
   * Should be called once at application startup
   */
  public static initialize(db: AgentDatabase, env: AgentEnv): Container {
    if (Container.instance) {
      console.warn("[DI Container] Container already initialized, reusing existing instance");
      return Container.instance;
    }
    
    Container.instance = new Container(db, env);
    return Container.instance;
  }

  /**
   * Get the singleton container instance
   * Throws error if not initialized
   */
  public static getInstance(): Container {
    if (!Container.instance) {
      throw new Error(
        "DI Container not initialized. Call Container.initialize() first."
      );
    }
    return Container.instance;
  }

  /**
   * Reset the container (useful for testing)
   */
  public static reset(): void {
    Container.instance = null;
  }

  // Getters for core dependencies
  get db(): AgentDatabase {
    return this._db;
  }

  get env(): AgentEnv {
    return this._env;
  }

  // Repository getters (lazy initialization)
  get inboundLetters(): InboundLetterRepository {
    if (!this._inboundLetterRepo) {
      this._inboundLetterRepo = new InboundLetterRepository(this._db);
    }
    return this._inboundLetterRepo;
  }

  get outboundLetters(): OutboundLetterRepository {
    if (!this._outboundLetterRepo) {
      this._outboundLetterRepo = new OutboundLetterRepository(this._db);
    }
    return this._outboundLetterRepo;
  }

  get registrations(): RegistrationRepository {
    if (!this._registrationRepo) {
      this._registrationRepo = new RegistrationRepository(this._db);
    }
    return this._registrationRepo;
  }

  get payments(): PaymentRepository {
    if (!this._paymentRepo) {
      this._paymentRepo = new PaymentRepository(this._db);
    }
    return this._paymentRepo;
  }

  get autonomyDecisions(): AutonomyDecisionRepository {
    if (!this._autonomyDecisionRepo) {
      this._autonomyDecisionRepo = new AutonomyDecisionRepository(this._db);
    }
    return this._autonomyDecisionRepo;
  }

  get spendLogs(): SpendLogRepository {
    if (!this._spendLogRepo) {
      this._spendLogRepo = new SpendLogRepository(this._db);
    }
    return this._spendLogRepo;
  }

  get webhookEvents(): WebhookEventRepository {
    if (!this._webhookEventRepo) {
      this._webhookEventRepo = new WebhookEventRepository(this._db);
    }
    return this._webhookEventRepo;
  }
}

/**
 * Helper function to get container instance with type safety
 */
export function getContainer(): Container {
  return Container.getInstance();
}

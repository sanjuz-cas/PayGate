/**
 * Custom error classes for the agent API
 * Provides structured error handling with error codes and metadata
 */

export class AgentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.metadata && { metadata: this.metadata }),
    };
  }
}

export class ValidationError extends AgentError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", 400, metadata);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AgentError {
  constructor(
    message: string = "Unauthorized access",
    metadata?: Record<string, unknown>,
  ) {
    super(message, "UNAUTHORIZED", 401, metadata);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AgentError {
  constructor(
    message: string = "Access forbidden",
    metadata?: Record<string, unknown>,
  ) {
    super(message, "FORBIDDEN", 403, metadata);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AgentError {
  constructor(
    resource: string,
    id?: string,
    metadata?: Record<string, unknown>,
  ) {
    const message = id 
      ? `${resource} with id '${id}' not found` 
      : `${resource} not found`;
    super(message, "NOT_FOUND", 404, { ...metadata, resource, id });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AgentError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "CONFLICT", 409, metadata);
    this.name = "ConflictError";
  }
}

export class BudgetBlockedError extends AgentError {
  constructor(
    message: string,
    metadata: {
      requestedAmount: number;
      currentSpend: number;
      dailyCap: number;
      remaining: number;
    },
  ) {
    super(message, "BUDGET_BLOCKED", 422, metadata);
    this.name = "BudgetBlockedError";
  }
}

export class ServiceUnavailableError extends AgentError {
  constructor(
    service: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    const message = reason
      ? `Service '${service}' unavailable: ${reason}`
      : `Service '${service}' unavailable`;
    super(message, "SERVICE_UNAVAILABLE", 503, { ...metadata, service, reason });
    this.name = "ServiceUnavailableError";
  }
}

export class ExternalApiError extends AgentError {
  constructor(
    service: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message, "EXTERNAL_API_ERROR", 502, { ...metadata, service });
    this.name = "ExternalApiError";
  }
}

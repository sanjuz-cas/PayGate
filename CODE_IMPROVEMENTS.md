# Code Quality & Architecture Improvements

This document summarizes the architectural improvements and design patterns implemented in the juicebag-mail agent API.

## Implemented Improvements

### 1. Custom Error Classes (`/src/errors/index.ts`)

**Pattern**: Custom Error Hierarchy

Implemented a structured error handling system with custom error classes:
- `AgentError` - Base error class with code, statusCode, and metadata
- `ValidationError` - For input validation failures (400)
- `UnauthorizedError` - For authentication failures (401)
- `ForbiddenError` - For authorization failures (403)
- `NotFoundError` - For resource not found (404)
- `ConflictError` - For resource conflicts (409)
- `BudgetBlockedError` - For budget guardrail violations (422)
- `ServiceUnavailableError` - For external service failures (503)
- `ExternalApiError` - For third-party API errors (502)

**Benefits**:
- Consistent error responses across the API
- Better error tracking and debugging
- Type-safe error handling
- Clear separation of error types

### 2. Centralized Constants (`/src/constants/index.ts`)

**Pattern**: Constants Module

Extracted all magic numbers and strings into a centralized constants file:
- Port configurations
- Algorand network URLs
- Default configuration values
- Cost constants
- Time windows
- Autonomy thresholds
- Retry configurations
- Rate limits
- Pagination defaults

**Benefits**:
- Single source of truth
- Easier maintenance and updates
- Prevents magic numbers throughout codebase
- Better documentation of configuration values

### 3. Repository Pattern (`/src/repositories/index.ts`)

**Pattern**: Repository Pattern

Created repository classes for database access abstraction:
- `InboundLetterRepository`
- `OutboundLetterRepository`
- `RegistrationRepository`
- `PaymentRepository`
- `AutonomyDecisionRepository`
- `SpendLogRepository`
- `WebhookEventRepository`

**Benefits**:
- Separation of concerns
- Easier testing (repositories can be mocked)
- Centralized query logic
- Consistent data access patterns
- Better code organization

### 4. Dependency Injection Container (`/src/container/index.ts`)

**Pattern**: Dependency Injection / Service Locator

Implemented a DI container for managing dependencies:
- Singleton pattern for container instance
- Lazy initialization of repositories
- Centralized dependency management
- Easy mocking for tests

**Benefits**:
- Loose coupling between components
- Easier unit testing
- Better code maintainability
- Clear dependency graph

### 5. Strategy Pattern for Autonomy (`/src/lib/autonomy.ts`)

**Pattern**: Strategy Pattern

Refactored autonomy decision logic using the strategy pattern:
- `DecisionStrategy` interface
- `RulesBasedStrategy` - Keyword and allowlist matching
- `LlmBasedStrategy` - AI-powered classification
- `AutonomyContext` - Context class for strategy execution

**Benefits**:
- Open/closed principle (easy to add new strategies)
- Better testability
- Clear separation of concerns
- Runtime strategy switching capability
- Uses confidence thresholds from constants

### 6. Improved Environment Configuration (`/src/lib/env.ts`)

**Improvements**:
- Uses constants from centralized config
- Better type safety with Zod schemas
- Clearer default values
- Separated configuration concerns

## Design Patterns Applied

| Pattern | Location | Purpose |
|---------|----------|---------|
| Strategy | `/src/lib/autonomy.ts` | Interchangeable decision algorithms |
| Repository | `/src/repositories/` | Data access abstraction |
| Dependency Injection | `/src/container/` | Inversion of control |
| Factory | Errors module | Error instance creation |
| Singleton | Container | Single instance management |

## Next Steps (Recommended)

### High Priority
1. **Update main index.ts** to use the DI container and repositories
2. **Add rate limiting middleware** using the constants defined
3. **Implement retry logic** for external API calls
4. **Add comprehensive JSDoc comments** to all public methods

### Medium Priority
5. **Create OpenAPI/Swagger documentation**
6. **Add integration tests** for repositories
7. **Implement caching layer** (Redis) for frequently accessed data
8. **Add request logging middleware**

### Lower Priority
9. **Create CLI tools** for common operations
10. **Add metrics collection** (Prometheus/OpenTelemetry)
11. **Implement circuit breaker pattern** for external services
12. **Add GraphQL API** as alternative to REST

## Usage Examples

### Using Custom Errors
```typescript
import { NotFoundError, BudgetBlockedError } from './errors/index.js';

throw new NotFoundError('Letter', letterId);
throw new BudgetBlockedError('Budget exceeded', {
  requestedAmount: 1.0,
  currentSpend: 4.5,
  dailyCap: 5.0,
  remaining: 0.5,
});
```

### Using Repositories
```typescript
import { getContainer } from './container/index.js';

const container = getContainer();
const letters = await container.inboundLetters.findPending();
await container.payments.create(paymentData);
```

### Using Strategy Pattern
```typescript
import { AutonomyContext, RulesBasedStrategy } from './lib/autonomy.js';

const context = new AutonomyContext(new RulesBasedStrategy());
const decision = await context.evaluateLetter(letter, env);
```

## Testing Recommendations

```typescript
// Example test for repository
describe('InboundLetterRepository', () => {
  it('should find pending letters', async () => {
    const repo = new InboundLetterRepository(testDb);
    const letters = await repo.findPending();
    expect(letters).toBeDefined();
  });
});

// Example test for errors
describe('CustomErrors', () => {
  it('should create ValidationError with correct properties', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Migration Guide

To adopt these improvements in existing code:

1. Replace direct DB queries with repository methods
2. Replace magic numbers with constants
3. Use custom error classes instead of generic Error
4. Inject dependencies via container instead of direct imports
5. Use strategy pattern for interchangeable algorithms

## File Structure

```
/apps/agent-api/src/
├── container/          # Dependency Injection
│   └── index.ts
├── constants/          # Centralized Constants
│   └── index.ts
├── errors/             # Custom Error Classes
│   └── index.ts
├── repositories/       # Data Access Layer
│   └── index.ts
├── lib/
│   ├── autonomy.ts     # Strategy Pattern Implementation
│   └── env.ts          # Updated Environment Config
└── ...
```

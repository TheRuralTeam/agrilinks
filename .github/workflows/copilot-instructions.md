# AgriLink Engineering Instructions

## Project

AgriLink is an agricultural marketplace and logistics platform.

Core domains:

- Authentication
- Users
- RBAC
- Marketplace
- Products
- Orders
- Offers
- Negotiation
- Payments
- Logistics
- Transporters
- Notifications
- Messaging
- Administration
- Analytics

## Engineering Principles

Always prioritize:

1. Security
2. Correctness
3. Maintainability
4. Scalability
5. Observability
6. Performance

Do not introduce unnecessary complexity.

Before modifying an existing subsystem:

- inspect existing implementation;
- identify dependencies;
- identify database relationships;
- identify authentication and authorization requirements;
- identify possible regressions.

## Architecture

Prefer clear separation between:

- UI
- application logic
- domain logic
- infrastructure
- database
- external services

External providers must be abstracted behind service interfaces.

Never tightly couple business logic to a specific payment provider.

## Database

PostgreSQL is the source of truth.

Consider:

- foreign keys
- indexes
- constraints
- transactions
- concurrency
- row-level security
- auditability
- data integrity

Never bypass authorization checks from the frontend.

## Security

Never expose:

- service-role keys
- private API keys
- secrets
- credentials

Never trust client-side authorization.

Validate all external input.

Consider:

- authentication
- authorization
- RBAC
- RLS
- rate limiting
- replay attacks
- webhook signatures
- idempotency
- audit logs

## Payments

Payment operations must be idempotent.

Never assume a payment succeeded merely because the client says so.

Payment state must be confirmed server-side.

Support asynchronous payment events and webhooks.

Do not hard-code a single PSP into the business domain.

## Code Quality

Prefer:

- TypeScript
- strong typing
- small modules
- explicit interfaces
- reusable services
- predictable error handling

Avoid:

- `any`
- duplicated business logic
- giant components
- hidden side effects
- hard-coded credentials
- unnecessary abstractions

## Before finishing any task

Verify:

- TypeScript compilation
- linting
- tests
- database compatibility
- authentication
- authorization
- error handling
- loading states
- empty states
- responsive UI

Never claim a feature is complete if it has not actually been implemented and verified.
# AgriLink email queue architecture

## Delivery contract

Business and authentication Edge Functions enqueue messages in `public.email_outbox`. Only `process-email-outbox` calls the Resend API. The existing scheduled worker, worker-secret validation, atomic claim RPC, retry RPC, and provider ID tracking remain in place.

## Queue domains

The domains are logical queues expressed by the `template` and `dedupe_key` fields. They converge on the existing central outbox:

| Domain | Template(s) | Producer |
| --- | --- | --- |
| Account registration | `auth-signup` | `register-user` |
| Recovery / magic link / confirmation resend | `auth-recovery`, `auth-magic-link`, `auth-signup` | Existing auth queue functions |
| OTP verification | `auth-otp` | `send-otp-email` |
| Support contact | `support-contact` | `send-support-email` |
| Order status | `order-update` | `send-order-update-email` |
| Pre-orders, freight, notifications | Existing templates / notification fallback | Existing DB triggers and workers |

## Delivery guarantees

- Producers persist the event before returning a queued response.
- The outbox unique `dedupe_key` protects against repeated enqueue attempts.
- The worker claims jobs through `claim_email_outbox` and uses the existing retry policy.
- A message is marked sent only after Resend returns success; the provider ID is stored.
- OTP messages are rejected if their 15-minute validity window has elapsed before delivery.
- OTP and other one-time credential fields are removed from the payload by `complete_email_outbox` after provider acceptance.
- The existing RLS and service-role-only access model for the outbox is preserved.

## Operational notes

- Queue acceptance is not equivalent to recipient delivery. Resend acceptance, delivery, bounce, and complaint are distinct lifecycle events; provider webhooks are a separate follow-up.
- A queued response (HTTP 202) means the message is scheduled, not yet delivered.
- Do not deploy the migration or Edge Functions to production until the PR checks and staging/test-account flow pass.
- Do not replay old failed authentication messages blindly: tokens may have expired and recipients may already be confirmed.

## Signup confirmation semantics

- The registration Edge Function creates the Auth user and confirmation token through `auth.admin.generateLink` before queue insertion.
- Password-based registrations use the `signup` verification type; passwordless registrations use `invite`.
- The generated `hashed_token` and exact `verification_type` are stored in the restricted outbox payload. The central worker sends the message; it does not regenerate or downgrade a signup token to a magic link.
- This distinction is required because Supabase routes `signup`/`invite` through signup confirmation, while `magiclink` is verified through the recovery flow. For an unconfirmed user, that recovery flow clears a password set before confirmation.
- For auth jobs whose producer cannot pre-generate a token (confirmation resend, recovery, or magic link), the worker persists the generated token hash and actual Supabase verification type in the claimed outbox row before calling Resend. Retries therefore reuse the same token and byte-stable message payload with the same Resend idempotency key; the token is scrubbed after success or terminal failure.
- The token hash is removed from the outbox payload after provider acceptance or terminal failure. If enqueueing fails after Auth user creation, the UI directs the user to the confirmation-resend flow, which creates a fresh signup confirmation token for the existing unconfirmed account.

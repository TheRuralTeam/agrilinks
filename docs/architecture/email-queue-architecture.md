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

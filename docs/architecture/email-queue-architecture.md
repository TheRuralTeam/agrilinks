# AgriLink email delivery architecture

## Delivery contract

Business and transactional email functions use the central `public.email_outbox` and the `process-email-outbox` worker, which sends through Resend. Existing signup confirmation resends are deliberately handled by Supabase Auth's supported resend endpoint because Auth owns the original signup token and does not expose a supported way to regenerate that token through the email worker.

## Email domains

| Domain | Producer | Delivery path |
| --- | --- | --- |
| Initial account registration | `register-user` | Central outbox + Resend |
| Existing signup confirmation resend | `send-confirmation-email` | Supabase Auth `resend({ type: "signup" })` + configured custom SMTP |
| Password recovery / magic link | Existing auth queue functions | Central outbox + Resend |
| OTP verification | `send-otp-email` | Central outbox + Resend; product flow remains pending |
| Support contact | `send-support-email` | Central outbox + Resend |
| Order status | `send-order-update-email` | Central outbox + Resend |
| Pre-orders, freight, notifications | Existing DB triggers and workers | Existing templates / notification fallback |

## Signup confirmation semantics

- Supabase Auth creates and owns the signup confirmation token.
- The initial signup path may use the central outbox only when the registration function has already generated and securely persisted the exact signup token hash.
- A resend for an existing unconfirmed user must use Supabase Auth's documented `auth.resend({ type: "signup", email, options: { emailRedirectTo } })` operation. It must not call `generateLink({ type: "signup" })` without the original signup credentials, and must not downgrade confirmation to a magic link.
- The resend Edge Function validates the input, applies per-email and per-IP rate limits, restricts the redirect to the AgriLink callback, and returns HTTP 202 only after Supabase Auth returns without an error. A 202 means Auth accepted the request; it does not prove mailbox delivery.
- Supabase Auth sends this message using the SMTP provider configured in Authentication settings. The production project must have a verified custom SMTP provider (for example, Resend SMTP) and the confirmation template must contain `{{ .ConfirmationURL }}`.
- If Auth rejects the request, the Edge Function returns a non-2xx response and the frontend does not show a success state.
- OTP code confirmation is outside this delivery path and remains pending.

## Operational guarantees

- Central outbox jobs are marked sent only after Resend returns success; provider IDs are stored.
- One-time credentials are scrubbed from outbox payloads after provider acceptance or terminal failure.
- Queue/provider acceptance is not equivalent to recipient delivery. Delivery, bounce, and complaint events require provider webhooks.
- Never replay old failed authentication messages blindly: tokens may have expired and recipients may already be confirmed.
- Do not deploy this resend path until Supabase Auth custom SMTP configuration and an end-to-end test account are verified.

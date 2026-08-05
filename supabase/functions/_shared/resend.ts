export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isNonRetryableError(err: any) {
  if (!err) return false;
  const msg = (err.message || String(err) || "").toString();
  return /not verified|domain|invalid|api key|unauthorized|forbidden|permission/i.test(msg);
}

/**
 * Send email via Resend with simple exponential backoff retry for transient errors.
 * Returns the original response object from `resend.emails.send` on success,
 * or `{ error }` on permanent failure after retries.
 */
export async function sendEmailWithRetry(resendClient: any, payload: any, attempts = 3, baseDelay = 500) {
  let lastErr: any = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await resendClient.emails.send(payload);
      // If API returned an error object, decide whether to retry
      if (result && (result as any).error) {
        const err = (result as any).error;
        if (isNonRetryableError(err)) return { error: err };
        lastErr = err;
        // retry loop
      } else {
        return result;
      }
    } catch (err) {
      if (isNonRetryableError(err)) return { error: err };
      lastErr = err;
    }

    if (i < attempts - 1) {
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }

  return { error: lastErr };
}

BEGIN;

-- Clients may read their own balances and history, but only trusted server code
-- may change any financial record.
DROP POLICY IF EXISTS "Sistema pode criar carteiras" ON public.wallets;
DROP POLICY IF EXISTS "Sistema pode atualizar carteiras" ON public.wallets;
DROP POLICY IF EXISTS "Usuários podem criar transações" ON public.transactions;

REVOKE ALL ON TABLE public.wallets, public.transactions, public.commissions FROM anon, authenticated;
GRANT SELECT ON TABLE public.wallets, public.transactions, public.commissions TO authenticated;

-- Disable legacy client-callable financial operations. Deposits must only be
-- credited after a provider-confirmed payment event.
REVOKE ALL ON FUNCTION public.process_deposit(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_funds(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_blocked_funds(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_internal_transfer(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_internal_transfer(uuid, uuid, numeric, text) TO authenticated;

-- Preserve internal wallet transfers while preventing NULL-auth bypasses and
-- concurrent double-spends. Lock both wallets in a stable order.
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_wallet_id UUID;
  v_to_wallet_id UUID;
  v_from_available NUMERIC;
  v_transaction_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_from_user_id THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same wallet' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.wallets
  WHERE user_id IN (p_from_user_id, p_to_user_id)
  ORDER BY user_id
  FOR UPDATE;

  SELECT id, available_balance INTO v_from_wallet_id, v_from_available
  FROM public.wallets WHERE user_id = p_from_user_id;
  SELECT id INTO v_to_wallet_id
  FROM public.wallets WHERE user_id = p_to_user_id;

  IF v_from_wallet_id IS NULL OR v_to_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_from_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.transactions (wallet_id, type, status, amount, description, related_user_id)
  VALUES (v_from_wallet_id, 'internal_transfer', 'completed', p_amount, p_description, p_to_user_id)
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.transactions (wallet_id, type, status, amount, description, related_user_id)
  VALUES (v_to_wallet_id, 'internal_transfer', 'completed', p_amount, p_description, p_from_user_id);

  UPDATE public.wallets
  SET available_balance = available_balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at = NOW()
  WHERE id = v_from_wallet_id;

  UPDATE public.wallets
  SET available_balance = available_balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = NOW()
  WHERE id = v_to_wallet_id;

  RETURN v_transaction_id;
END;
$$;

CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z][a-z0-9_-]{1,49}$'),
  idempotency_key UUID NOT NULL,
  provider_reference TEXT CHECK (provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 255),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'AOA' CHECK (currency ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE (user_id, idempotency_key)
);

CREATE UNIQUE INDEX payment_intents_provider_reference_key
  ON public.payment_intents (provider_id, provider_reference)
  WHERE provider_reference IS NOT NULL;
CREATE INDEX payment_intents_user_created_idx
  ON public.payment_intents (user_id, created_at DESC);

CREATE TABLE public.payment_intent_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.payment_intent_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_intent_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_intent_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_payment_intent_rate_limit(
  p_user_id UUID,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_request_count INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_max_requests NOT BETWEEN 1 AND 1000
     OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payment_intent_rate_limits (user_id, window_started_at, request_count)
  VALUES (p_user_id, v_now, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE
        WHEN payment_intent_rate_limits.window_started_at
          + p_window_seconds * INTERVAL '1 second' <= v_now THEN v_now
        ELSE payment_intent_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN payment_intent_rate_limits.window_started_at
          + p_window_seconds * INTERVAL '1 second' <= v_now THEN 1
        ELSE LEAST(payment_intent_rate_limits.request_count + 1, p_max_requests + 1)
      END,
      updated_at = v_now
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_payment_intent_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_payment_intent_rate_limit(uuid, integer, integer) TO service_role;

CREATE TABLE public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z][a-z0-9_-]{1,49}$'),
  provider_event_id TEXT NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 255),
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 120),
  body_sha256 TEXT NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  payment_intent_id UUID REFERENCES public.payment_intents(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL DEFAULT 'received' CHECK (outcome IN ('received', 'processed', 'ignored', 'rejected')),
  error_code TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider_id, provider_event_id)
);

ALTER TABLE public.transactions
  ADD COLUMN payment_intent_id UUID REFERENCES public.payment_intents(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX transactions_payment_intent_key
  ON public.transactions (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their payment intents"
  ON public.payment_intents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.payment_intents, public.payment_webhook_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.payment_intents TO authenticated;
GRANT ALL ON TABLE public.payment_intents, public.payment_webhook_events TO service_role;
GRANT SELECT ON TABLE public.payment_webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.apply_wallet_payment_webhook(
  p_provider_id TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_body_sha256 TEXT,
  p_provider_reference TEXT,
  p_provider_status TEXT,
  p_amount NUMERIC,
  p_currency CHAR(3)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_existing_body_sha256 TEXT;
  v_existing_outcome TEXT;
  v_intent public.payment_intents%ROWTYPE;
  v_wallet_exists BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
    IF p_provider_id IS NULL OR p_provider_id !~ '^[a-z][a-z0-9_-]{1,49}$'
     OR p_provider_event_id IS NULL OR length(p_provider_event_id) NOT BETWEEN 1 AND 255
     OR p_event_type IS NULL OR length(p_event_type) NOT BETWEEN 1 AND 120
      OR p_body_sha256 IS NULL OR p_body_sha256 !~ '^[0-9a-f]{64}$'
     OR p_provider_reference IS NULL OR length(p_provider_reference) NOT BETWEEN 1 AND 255
      OR p_provider_status IS NULL OR p_provider_status NOT IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')
     OR p_amount IS NULL OR p_amount <= 0
      OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid payment event' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payment_webhook_events (
    provider_id, provider_event_id, event_type, body_sha256
  ) VALUES (
    p_provider_id, p_provider_event_id, p_event_type, p_body_sha256
  )
  ON CONFLICT (provider_id, provider_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT id, body_sha256, outcome
    INTO v_event_id, v_existing_body_sha256, v_existing_outcome
    FROM public.payment_webhook_events
    WHERE provider_id = p_provider_id AND provider_event_id = p_provider_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN 'retry';
    END IF;
    IF v_existing_body_sha256 <> p_body_sha256 THEN
      RETURN 'duplicate_payload_mismatch';
    END IF;
    IF v_existing_outcome IN ('processed', 'ignored') THEN
      RETURN 'duplicate';
    END IF;
    IF v_existing_outcome = 'rejected' THEN
      RETURN 'rejected';
    END IF;
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE provider_id = p_provider_id AND provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.payment_webhook_events
    SET outcome = 'received', error_code = 'payment_not_found', processed_at = NULL
    WHERE id = v_event_id;
    RETURN 'retry';
  END IF;

  UPDATE public.payment_webhook_events
  SET payment_intent_id = v_intent.id
  WHERE id = v_event_id;

  IF v_intent.amount <> p_amount OR v_intent.currency <> p_currency THEN
    UPDATE public.payment_webhook_events
    SET outcome = 'rejected', error_code = 'amount_or_currency_mismatch', processed_at = NOW()
    WHERE id = v_event_id;
    RETURN 'rejected';
  END IF;

  IF v_intent.status IN ('succeeded', 'refunded') THEN
    UPDATE public.payment_webhook_events
    SET outcome = 'ignored', error_code = 'payment_already_terminal', processed_at = NOW()
    WHERE id = v_event_id;
    RETURN 'ignored';
  END IF;

  -- A provider-confirmed success takes precedence over an earlier failure,
  -- cancellation, or expiry event; providers may deliver events out of order.
  IF p_provider_status = 'succeeded' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.wallets
      WHERE id = v_intent.wallet_id AND user_id = v_intent.user_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
      UPDATE public.payment_webhook_events
      SET outcome = 'rejected', error_code = 'wallet_not_found', processed_at = NOW()
      WHERE id = v_event_id;
      RETURN 'rejected';
    END IF;

    UPDATE public.payment_intents
    SET status = 'succeeded', updated_at = NOW(), completed_at = NOW()
    WHERE id = v_intent.id;

    INSERT INTO public.transactions (
      wallet_id, type, status, amount, description, reference_id, payment_intent_id, completed_at
    ) VALUES (
      v_intent.wallet_id, 'deposit', 'completed', v_intent.amount,
      'Carregamento confirmado pelo provedor de pagamento', v_intent.id, v_intent.id, NOW()
    );

    UPDATE public.wallets
    SET available_balance = available_balance + v_intent.amount,
        total_earned = total_earned + v_intent.amount,
        updated_at = NOW()
    WHERE id = v_intent.wallet_id;

    UPDATE public.payment_webhook_events
    SET outcome = 'processed', processed_at = NOW()
    WHERE id = v_event_id;
    RETURN 'processed';
  END IF;

  IF v_intent.status IN ('failed', 'cancelled', 'expired') THEN
    UPDATE public.payment_webhook_events
    SET outcome = 'ignored', error_code = 'payment_already_terminal', processed_at = NOW()
    WHERE id = v_event_id;
    RETURN 'ignored';
  END IF;

  IF p_provider_status IN ('pending', 'processing') THEN
    UPDATE public.payment_intents
    SET status = CASE WHEN p_provider_status = 'processing' THEN 'processing' ELSE status END,
        updated_at = NOW()
    WHERE id = v_intent.id;
    UPDATE public.payment_webhook_events
    SET outcome = 'processed', processed_at = NOW()
    WHERE id = v_event_id;
    RETURN 'processed';
  END IF;

  IF p_provider_status IN ('failed', 'cancelled') THEN
    UPDATE public.payment_intents
    SET status = p_provider_status, updated_at = NOW()
    WHERE id = v_intent.id;
    UPDATE public.payment_webhook_events
    SET outcome = 'processed', processed_at = NOW()
    WHERE id = v_event_id;
    RETURN 'processed';
  END IF;

  UPDATE public.payment_webhook_events
  SET outcome = 'rejected', error_code = 'unsupported_status', processed_at = NOW()
  WHERE id = v_event_id;
  RETURN 'rejected';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_payment_webhook(text, text, text, text, text, text, numeric, char) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wallet_payment_webhook(text, text, text, text, text, text, numeric, char) TO service_role;

COMMIT;

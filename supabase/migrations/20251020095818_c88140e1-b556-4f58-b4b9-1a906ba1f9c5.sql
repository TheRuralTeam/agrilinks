-- Criar enum para tipos de transação
CREATE TYPE public.transaction_type AS ENUM (
  'purchase_payment',      -- Pagamento de compra
  'freight_payment',       -- Pagamento de frete
  'sale_receipt',         -- Recebimento de venda
  'internal_transfer',    -- Transferência interna
  'bank_withdrawal',      -- Saque bancário
  'deposit',              -- Depósito
  'commission',           -- Comissão AgriLink
  'refund'               -- Reembolso
);

-- Criar enum para status de transação
CREATE TYPE public.transaction_status AS ENUM (
  'pending',     -- Pendente
  'blocked',     -- Bloqueado (escrow)
  'completed',   -- Concluído
  'cancelled',   -- Cancelado
  'disputed'     -- Em disputa
);

-- Tabela de carteiras digitais
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  blocked_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_earned NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_withdrawn NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id),
  CONSTRAINT positive_balances CHECK (
    available_balance >= 0 AND 
    blocked_balance >= 0
  )
);

-- Tabela de transações
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(15, 2) NOT NULL,
  description TEXT,
  reference_id UUID,  -- ID de referência (produto, pedido, etc)
  related_user_id UUID REFERENCES auth.users(id),  -- Usuário relacionado (quem enviou/recebeu)
  metadata JSONB,  -- Dados adicionais (endereço, detalhes bancários, etc)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Tabela de comissões
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(15, 2) NOT NULL,
  percentage NUMERIC(5, 2) NOT NULL,
  type TEXT NOT NULL,  -- 'sale' ou 'freight'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_commission CHECK (
    amount > 0 AND 
    percentage > 0 AND 
    percentage <= 100
  )
);

-- Habilitar RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para wallets
CREATE POLICY "Usuários podem ver sua própria carteira"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode criar carteiras"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sistema pode atualizar carteiras"
ON public.wallets FOR UPDATE
USING (auth.uid() = user_id);

-- Políticas RLS para transactions
CREATE POLICY "Usuários podem ver suas transações"
ON public.transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wallets
    WHERE wallets.id = transactions.wallet_id
    AND wallets.user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem criar transações"
ON public.transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wallets
    WHERE wallets.id = wallet_id
    AND wallets.user_id = auth.uid()
  )
);

-- Políticas RLS para commissions
CREATE POLICY "Usuários podem ver suas comissões"
ON public.commissions FOR SELECT
USING (auth.uid() = user_id);

-- Função para criar carteira automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger para criar carteira
CREATE TRIGGER create_wallet_on_user_creation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_wallet_for_new_user();

-- Função para processar transação de depósito
CREATE OR REPLACE FUNCTION public.process_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Verificar se é o próprio usuário
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Obter wallet
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Criar transação
  INSERT INTO public.transactions (wallet_id, type, status, amount, description)
  VALUES (v_wallet_id, 'deposit', 'completed', p_amount, p_description)
  RETURNING id INTO v_transaction_id;

  -- Atualizar saldo
  UPDATE public.wallets
  SET 
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  RETURN v_transaction_id;
END;
$$;

-- Função para processar transferência interna
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
  v_transaction_id UUID;
BEGIN
  -- Verificar se é o próprio usuário enviando
  IF auth.uid() != p_from_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Obter wallets
  SELECT id INTO v_from_wallet_id
  FROM public.wallets
  WHERE user_id = p_from_user_id;

  SELECT id INTO v_to_wallet_id
  FROM public.wallets
  WHERE user_id = p_to_user_id;

  IF v_from_wallet_id IS NULL OR v_to_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Verificar saldo
  IF (SELECT available_balance FROM public.wallets WHERE id = v_from_wallet_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Criar transação de saída
  INSERT INTO public.transactions (wallet_id, type, status, amount, description, related_user_id)
  VALUES (v_from_wallet_id, 'internal_transfer', 'completed', p_amount, p_description, p_to_user_id)
  RETURNING id INTO v_transaction_id;

  -- Criar transação de entrada
  INSERT INTO public.transactions (wallet_id, type, status, amount, description, related_user_id)
  VALUES (v_to_wallet_id, 'internal_transfer', 'completed', p_amount, p_description, p_from_user_id);

  -- Atualizar saldos
  UPDATE public.wallets
  SET 
    available_balance = available_balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE id = v_from_wallet_id;

  UPDATE public.wallets
  SET 
    available_balance = available_balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE id = v_to_wallet_id;

  RETURN v_transaction_id;
END;
$$;

-- Função para bloquear saldo (escrow)
CREATE OR REPLACE FUNCTION public.block_funds(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Verificar se é o próprio usuário
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Obter wallet
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Verificar saldo
  IF (SELECT available_balance FROM public.wallets WHERE id = v_wallet_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Criar transação bloqueada
  INSERT INTO public.transactions (wallet_id, type, status, amount, description, reference_id)
  VALUES (v_wallet_id, 'purchase_payment', 'blocked', p_amount, p_description, p_reference_id)
  RETURNING id INTO v_transaction_id;

  -- Mover saldo de disponível para bloqueado
  UPDATE public.wallets
  SET 
    available_balance = available_balance - p_amount,
    blocked_balance = blocked_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  RETURN v_transaction_id;
END;
$$;

-- Função para liberar fundos bloqueados
CREATE OR REPLACE FUNCTION public.release_blocked_funds(
  p_transaction_id UUID,
  p_seller_user_id UUID,
  p_commission_percentage NUMERIC DEFAULT 5.0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_wallet_id UUID;
  v_seller_wallet_id UUID;
  v_amount NUMERIC;
  v_commission_amount NUMERIC;
  v_net_amount NUMERIC;
BEGIN
  -- Obter informações da transação
  SELECT wallet_id, amount INTO v_buyer_wallet_id, v_amount
  FROM public.transactions
  WHERE id = p_transaction_id AND status = 'blocked';

  IF v_buyer_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found or not blocked';
  END IF;

  -- Obter wallet do vendedor
  SELECT id INTO v_seller_wallet_id
  FROM public.wallets
  WHERE user_id = p_seller_user_id;

  IF v_seller_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Seller wallet not found';
  END IF;

  -- Calcular comissão
  v_commission_amount := v_amount * (p_commission_percentage / 100);
  v_net_amount := v_amount - v_commission_amount;

  -- Atualizar transação do comprador
  UPDATE public.transactions
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_transaction_id;

  -- Criar transação de recebimento para vendedor
  INSERT INTO public.transactions (wallet_id, type, status, amount, description, reference_id)
  VALUES (v_seller_wallet_id, 'sale_receipt', 'completed', v_net_amount, 'Recebimento de venda', p_transaction_id);

  -- Criar registro de comissão
  INSERT INTO public.commissions (transaction_id, user_id, amount, percentage, type)
  VALUES (p_transaction_id, p_seller_user_id, v_commission_amount, p_commission_percentage, 'sale');

  -- Atualizar saldo do comprador (remover do bloqueado)
  UPDATE public.wallets
  SET 
    blocked_balance = blocked_balance - v_amount,
    total_spent = total_spent + v_amount,
    updated_at = NOW()
  WHERE id = v_buyer_wallet_id;

  -- Atualizar saldo do vendedor (adicionar ao disponível)
  UPDATE public.wallets
  SET 
    available_balance = available_balance + v_net_amount,
    total_earned = total_earned + v_net_amount,
    updated_at = NOW()
  WHERE id = v_seller_wallet_id;

  RETURN TRUE;
END;
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Índices para performance
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_commissions_user_id ON public.commissions(user_id);
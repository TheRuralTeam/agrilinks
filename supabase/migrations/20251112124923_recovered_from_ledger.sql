-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251112124923; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Passo 1: Limpar dados órfãos antes de adicionar foreign keys

-- Deletar wallets órfãs
DELETE FROM public.wallets
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Deletar transactions órfãs
DELETE FROM public.transactions
WHERE wallet_id NOT IN (SELECT id FROM public.wallets);

-- Deletar agent_referrals órfãs
DELETE FROM public.agent_referrals
WHERE agent_id NOT IN (SELECT id FROM public.users)
   OR referred_user_id NOT IN (SELECT id FROM public.users);

-- Deletar commissions órfãs
DELETE FROM public.commissions
WHERE user_id NOT IN (SELECT id FROM public.users)
   OR transaction_id NOT IN (SELECT id FROM public.transactions);

-- Deletar conversations órfãs
DELETE FROM public.conversations
WHERE user_id NOT IN (SELECT id FROM public.users)
   OR (participant_id IS NOT NULL AND participant_id NOT IN (SELECT id FROM public.users));

-- Deletar messages órfãs
DELETE FROM public.messages
WHERE sender_id NOT IN (SELECT id FROM public.users)
   OR receiver_id NOT IN (SELECT id FROM public.users)
   OR (conversation_id IS NOT NULL AND conversation_id NOT IN (SELECT id FROM public.conversations));

-- Deletar notifications órfãs
DELETE FROM public.notifications
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Deletar products órfãos
DELETE FROM public.products
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Deletar orders órfãos
DELETE FROM public.orders
WHERE user_id NOT IN (SELECT id FROM public.users)
   OR product_id NOT IN (SELECT id FROM public.products)
   OR (pre_order_id IS NOT NULL AND pre_order_id NOT IN (SELECT id FROM public.pre_orders));

-- Deletar pre_orders órfãos
DELETE FROM public.pre_orders
WHERE user_id NOT IN (SELECT id FROM public.users)
   OR product_id NOT IN (SELECT id FROM public.products);

-- Deletar product_comments órfãos
DELETE FROM public.product_comments
WHERE user_id NOT IN (SELECT id FROM public.users)
   OR product_id NOT IN (SELECT id FROM public.products);

-- Deletar product_likes órfãos
DELETE FROM public.product_likes
WHERE user_id NOT IN (SELECT id FROM public.users)
   OR product_id NOT IN (SELECT id FROM public.products);

-- Deletar push_subscriptions órfãs
DELETE FROM public.push_subscriptions
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Deletar support_messages órfãas
DELETE FROM public.support_messages
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

-- Deletar user_roles órfãas
DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Deletar fichas_recebimento órfãas
DELETE FROM public.fichas_recebimento
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Passo 2: Adicionar Foreign Keys

-- agent_referrals
ALTER TABLE public.agent_referrals
  ADD CONSTRAINT fk_agent_referrals_agent
    FOREIGN KEY (agent_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_agent_referrals_referred_user
    FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- commissions
ALTER TABLE public.commissions
  ADD CONSTRAINT fk_commissions_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_commissions_transaction
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

-- conversations
ALTER TABLE public.conversations
  ADD CONSTRAINT fk_conversations_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_conversations_participant
    FOREIGN KEY (participant_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- messages
ALTER TABLE public.messages
  ADD CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_messages_receiver
    FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- orders
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_orders_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_orders_pre_order
    FOREIGN KEY (pre_order_id) REFERENCES public.pre_orders(id) ON DELETE SET NULL;

-- pre_orders
ALTER TABLE public.pre_orders
  ADD CONSTRAINT fk_pre_orders_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pre_orders_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- product_comments
ALTER TABLE public.product_comments
  ADD CONSTRAINT fk_product_comments_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_product_comments_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- product_likes
ALTER TABLE public.product_likes
  ADD CONSTRAINT fk_product_likes_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_product_likes_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- products
ALTER TABLE public.products
  ADD CONSTRAINT fk_products_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- push_subscriptions
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT fk_push_subscriptions_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- support_messages
ALTER TABLE public.support_messages
  ADD CONSTRAINT fk_support_messages_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- transactions
ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_wallet
    FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_transactions_related_user
    FOREIGN KEY (related_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- user_roles
ALTER TABLE public.user_roles
  ADD CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- wallets
ALTER TABLE public.wallets
  ADD CONSTRAINT fk_wallets_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- fichas_recebimento
ALTER TABLE public.fichas_recebimento
  ADD CONSTRAINT fk_fichas_recebimento_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Passo 3: Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_agent_referrals_agent_id ON public.agent_referrals(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_referrals_referred_user_id ON public.agent_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON public.commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_transaction_id ON public.commissions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_id ON public.conversations(participant_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_user_id ON public.pre_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_product_id ON public.pre_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_user_id ON public.product_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_product_id ON public.product_comments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON public.product_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON public.product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_related_user_id ON public.transactions(related_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_fichas_recebimento_user_id ON public.fichas_recebimento(user_id);

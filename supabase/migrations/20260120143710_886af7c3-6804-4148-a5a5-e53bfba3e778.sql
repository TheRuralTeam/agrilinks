-- 1. Eliminar todos os usuários não confirmados existentes
-- Primeiro, deletar dados relacionados nas tabelas dependentes
DELETE FROM public.agent_referrals 
WHERE referred_user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.agent_referrals 
WHERE agent_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.notifications 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.messages 
WHERE sender_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
)
OR receiver_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.conversations 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
)
OR participant_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
)
OR peer_user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.product_likes 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.product_comments 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.products 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.orders 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.pre_orders 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.wallets 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.user_roles 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.admin_permissions 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.support_messages 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.fichas_recebimento 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.work_sessions 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.push_subscriptions 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.email_verification_codes 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

DELETE FROM public.sourcing_requests 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email_verified = false OR email_verified IS NULL
);

-- Agora deletar os usuários não confirmados
DELETE FROM public.users 
WHERE email_verified = false OR email_verified IS NULL;

-- 2. Criar função para limpeza automática de contas não confirmadas (após 24 horas)
CREATE OR REPLACE FUNCTION public.cleanup_unverified_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  unverified_user_ids uuid[];
BEGIN
  -- Selecionar IDs de usuários não verificados criados há mais de 24 horas
  SELECT ARRAY_AGG(id) INTO unverified_user_ids
  FROM public.users
  WHERE (email_verified = false OR email_verified IS NULL)
    AND created_at < NOW() - INTERVAL '24 hours';
  
  IF unverified_user_ids IS NULL OR array_length(unverified_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- Deletar dados relacionados
  DELETE FROM public.agent_referrals WHERE referred_user_id = ANY(unverified_user_ids);
  DELETE FROM public.agent_referrals WHERE agent_id = ANY(unverified_user_ids);
  DELETE FROM public.notifications WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.messages WHERE sender_id = ANY(unverified_user_ids) OR receiver_id = ANY(unverified_user_ids);
  DELETE FROM public.conversations WHERE user_id = ANY(unverified_user_ids) OR participant_id = ANY(unverified_user_ids) OR peer_user_id = ANY(unverified_user_ids);
  DELETE FROM public.product_likes WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.product_comments WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.products WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.orders WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.pre_orders WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.wallets WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.admin_permissions WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.support_messages WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.fichas_recebimento WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.work_sessions WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.push_subscriptions WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.email_verification_codes WHERE user_id = ANY(unverified_user_ids);
  DELETE FROM public.sourcing_requests WHERE user_id = ANY(unverified_user_ids);
  
  -- Deletar usuários
  DELETE FROM public.users WHERE id = ANY(unverified_user_ids);
  
  -- Log da limpeza
  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'CLEANUP_UNVERIFIED_USERS',
    'CLEANUP_UNVERIFIED_USERS',
    '00000000-0000-0000-0000-000000000000'::uuid,
    jsonb_build_object('deleted_count', array_length(unverified_user_ids, 1), 'deleted_at', NOW())
  );
END;
$$;

-- 3. Habilitar extensões necessárias para cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
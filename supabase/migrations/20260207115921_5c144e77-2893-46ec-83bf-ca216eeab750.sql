
-- Add DELETE policy for admins on users table
CREATE POLICY "Admins podem deletar usuários"
ON public.users
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a secure function to delete a user and all related data (cascade)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete users';
  END IF;

  -- Delete related data in correct order to avoid FK violations
  DELETE FROM public.comment_likes WHERE user_id = p_user_id;
  DELETE FROM public.comment_replies WHERE user_id = p_user_id;
  DELETE FROM public.product_comments WHERE user_id = p_user_id;
  DELETE FROM public.product_likes WHERE user_id = p_user_id;
  DELETE FROM public.agent_referrals WHERE referred_user_id = p_user_id OR agent_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.messages WHERE sender_id = p_user_id OR receiver_id = p_user_id;
  DELETE FROM public.conversations WHERE user_id = p_user_id OR participant_id = p_user_id OR peer_user_id = p_user_id;
  DELETE FROM public.delivery_tracking WHERE assistant_id = p_user_id;
  DELETE FROM public.orders WHERE user_id = p_user_id;
  DELETE FROM public.pre_orders WHERE user_id = p_user_id;
  DELETE FROM public.products WHERE user_id = p_user_id;
  DELETE FROM public.commissions WHERE user_id = p_user_id;
  DELETE FROM public.transactions WHERE wallet_id IN (SELECT id FROM public.wallets WHERE user_id = p_user_id);
  DELETE FROM public.wallets WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.admin_permissions WHERE user_id = p_user_id;
  DELETE FROM public.support_messages WHERE user_id = p_user_id;
  DELETE FROM public.fichas_recebimento WHERE user_id = p_user_id;
  DELETE FROM public.work_sessions WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.email_verification_codes WHERE user_id = p_user_id;
  DELETE FROM public.sourcing_requests WHERE user_id = p_user_id;
  DELETE FROM public.audit_logs WHERE user_id = p_user_id;

  -- Finally delete the user
  DELETE FROM public.users WHERE id = p_user_id;

  -- Log the action
  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'USER_DELETED',
    'USER_DELETED',
    auth.uid(),
    jsonb_build_object('deleted_user_id', p_user_id, 'deleted_at', NOW())
  );

  RETURN true;
END;
$$;

-- Create a bulk delete function for users
CREATE OR REPLACE FUNCTION public.admin_bulk_delete_users(p_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_count integer := 0;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete users';
  END IF;

  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    PERFORM public.admin_delete_user(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

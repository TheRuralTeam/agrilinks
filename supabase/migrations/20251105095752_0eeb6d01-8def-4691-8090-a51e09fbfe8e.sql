-- Habilitar RLS na tabela orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios pedidos"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios pedidos"
ON public.orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios pedidos"
ON public.orders
FOR UPDATE
USING (auth.uid() = user_id);

-- Adicionar política para vendedores verem pedidos dos seus produtos
CREATE POLICY "Vendedores podem ver pedidos de seus produtos"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = orders.product_id
    AND p.user_id = auth.uid()
  )
);

-- Corrigir funções sem search_path
CREATE OR REPLACE FUNCTION public.sync_user_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL 
     AND (OLD.email_confirmed_at IS NULL OR NEW.email_confirmed_at <> OLD.email_confirmed_at) THEN
     
     UPDATE public.users
     SET email_verified = true,
         updated_at = NOW()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_type text;
BEGIN
  SELECT user_type
  INTO v_user_type
  FROM public.users
  WHERE email = NEW.email
  LIMIT 1;

  UPDATE public.users
  SET email_verified = true,
      updated_at = NOW()
  WHERE email = NEW.email;

  INSERT INTO public.audit_logs (
    event_type,
    user_email,
    user_id,
    user_type,
    ip_address,
    details
  )
  VALUES (
    'EMAIL_CONFIRMED',
    NEW.email,
    NEW.id,
    v_user_type,
    current_setting('request.headers', true)::json->>'x-real-ip',
    jsonb_build_object(
      'confirmed_at', NEW.email_confirmed_at,
      'auth_role', current_user,
      'trigger_time', NOW()
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$;
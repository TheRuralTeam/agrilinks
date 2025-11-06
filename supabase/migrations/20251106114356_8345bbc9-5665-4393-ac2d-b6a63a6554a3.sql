-- Secure roles structure
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='Users can view own roles' AND tablename='user_roles'
  ) THEN
    CREATE POLICY "Users can view own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- RPCs to validate agent code without exposing users table
CREATE OR REPLACE FUNCTION public.validate_agent_code(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_type = 'agente'
      AND agent_code = upper(p_code)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_agent_id_by_code(p_code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE user_type = 'agente'
    AND agent_code = upper(p_code)
  LIMIT 1;
$$;

-- Triggers to wire up auth <-> public.users and related side effects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_email ON auth.users;
CREATE TRIGGER on_auth_user_updated_email
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.sync_user_confirmation();

DROP TRIGGER IF EXISTS before_insert_assign_agent_code ON public.users;
CREATE TRIGGER before_insert_assign_agent_code
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_agent_code();

DROP TRIGGER IF EXISTS after_insert_create_wallet ON public.users;
CREATE TRIGGER after_insert_create_wallet
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.create_wallet_for_new_user();

DROP TRIGGER IF EXISTS after_insert_process_referral ON public.users;
CREATE TRIGGER after_insert_process_referral
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.process_agent_referral();

DROP TRIGGER IF EXISTS users_update_updated_at ON public.users;
CREATE TRIGGER users_update_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Products notifications and timestamp maintenance
DROP TRIGGER IF EXISTS products_update_updated_at ON public.products;
CREATE TRIGGER products_update_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS notify_product_created ON public.products;
CREATE TRIGGER notify_product_created
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_product_created();

DROP TRIGGER IF EXISTS notify_product_updated ON public.products;
CREATE TRIGGER notify_product_updated
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_product_updated();

-- Transactions notifications
DROP TRIGGER IF EXISTS notify_transaction_created ON public.transactions;
CREATE TRIGGER notify_transaction_created
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_created();

DROP TRIGGER IF EXISTS notify_transaction_completed ON public.transactions;
CREATE TRIGGER notify_transaction_completed
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_completed();

-- Support messages notification
DROP TRIGGER IF EXISTS notify_support_message_created ON public.support_messages;
CREATE TRIGGER notify_support_message_created
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_message_created();
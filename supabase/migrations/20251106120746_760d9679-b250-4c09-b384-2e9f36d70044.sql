-- Garantir que o tipo enum existe e contém 'comprador'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
    CREATE TYPE public.user_type_enum AS ENUM ('agricultor','comprador','agente');
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_type_enum' AND e.enumlabel = 'comprador'
    ) THEN
      ALTER TYPE public.user_type_enum ADD VALUE 'comprador';
    END IF;
  END IF;
END $$;

-- Recriar triggers essenciais de cadastro/sincronização
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_email ON auth.users;
CREATE TRIGGER on_auth_user_updated_email
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE PROCEDURE public.sync_email_verification();

DROP TRIGGER IF EXISTS before_insert_assign_agent_code ON public.users;
CREATE TRIGGER before_insert_assign_agent_code
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.assign_agent_code();

DROP TRIGGER IF EXISTS after_insert_create_wallet ON public.users;
CREATE TRIGGER after_insert_create_wallet
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.create_wallet_for_new_user();

DROP TRIGGER IF EXISTS after_insert_process_referral ON public.users;
CREATE TRIGGER after_insert_process_referral
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.process_agent_referral();

DROP TRIGGER IF EXISTS users_update_updated_at ON public.users;
CREATE TRIGGER users_update_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
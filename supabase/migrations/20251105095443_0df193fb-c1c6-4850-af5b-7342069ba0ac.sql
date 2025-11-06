-- Fixar cadastro: criar triggers necessários e evitar conflitos entre auth.users e public.users
-- 1) Inserir perfil automaticamente após criação no auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2) Sincronizar verificação de email no perfil quando o email for confirmado
DROP TRIGGER IF EXISTS on_auth_user_updated_email ON auth.users;
CREATE TRIGGER on_auth_user_updated_email
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.sync_user_confirmation();

-- 3) Atribuir código de agente automaticamente ao inserir um usuário do tipo 'agente'
DROP TRIGGER IF EXISTS before_insert_assign_agent_code ON public.users;
CREATE TRIGGER before_insert_assign_agent_code
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.assign_agent_code();

-- 4) Criar carteira automaticamente após inserir o usuário na tabela pública
DROP TRIGGER IF EXISTS after_insert_create_wallet ON public.users;
CREATE TRIGGER after_insert_create_wallet
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.create_wallet_for_new_user();
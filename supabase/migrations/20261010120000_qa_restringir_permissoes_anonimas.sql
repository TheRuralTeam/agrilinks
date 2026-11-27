-- Reduz privilégios desnecessários para sessões anónimas.
-- O catálogo público continua a poder consultar produtos activos.
-- Operações de escrita continuam disponíveis para utilizadores autenticados,
-- sujeitas às políticas RLS existentes.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.conversations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.pre_orders FROM anon;

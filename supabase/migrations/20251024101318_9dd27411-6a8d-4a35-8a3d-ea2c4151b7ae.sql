-- Criar tabela de likes
CREATE TABLE IF NOT EXISTS public.product_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Criar tabela de comentários
CREATE TABLE IF NOT EXISTS public.product_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON public.product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON public.product_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_product_id ON public.product_comments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_created_at ON public.product_comments(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para likes
CREATE POLICY "Todos podem ver likes"
ON public.product_likes FOR SELECT
USING (true);

CREATE POLICY "Usuários podem criar seus próprios likes"
ON public.product_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios likes"
ON public.product_likes FOR DELETE
USING (auth.uid() = user_id);

-- Políticas RLS para comentários
CREATE POLICY "Todos podem ver comentários"
ON public.product_comments FOR SELECT
USING (true);

CREATE POLICY "Usuários podem criar seus próprios comentários"
ON public.product_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios comentários"
ON public.product_comments FOR DELETE
USING (auth.uid() = user_id);
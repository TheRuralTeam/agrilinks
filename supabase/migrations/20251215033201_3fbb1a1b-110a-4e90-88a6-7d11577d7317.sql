-- Tabela para likes nos comentários
CREATE TABLE public.comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.product_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Tabela para respostas aos comentários
CREATE TABLE public.comment_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.product_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for comment_likes
CREATE POLICY "Todos podem ver likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Usuários podem criar seus próprios likes" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar seus próprios likes" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for comment_replies
CREATE POLICY "Todos podem ver respostas" ON public.comment_replies FOR SELECT USING (true);
CREATE POLICY "Usuários podem criar suas próprias respostas" ON public.comment_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar suas próprias respostas" ON public.comment_replies FOR DELETE USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins podem ver todos os likes" ON public.comment_likes FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem ver todas as respostas" ON public.comment_replies FOR SELECT USING (has_role(auth.uid(), 'admin'));
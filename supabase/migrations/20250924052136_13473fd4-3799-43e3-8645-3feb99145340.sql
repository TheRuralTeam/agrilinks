-- Adicionar campo de descrição aos produtos
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar campo de avatar_url aos usuários
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Permitir o valor 'comprador' na coluna user_type (já que é text)
-- Não precisamos criar enum, apenas atualizar as constraints se houver

-- Criar bucket para avatars se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas para o bucket avatars
DO $$ 
BEGIN
    -- Política para visualizar avatars (público)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Avatars são publicamente visíveis'
    ) THEN
        CREATE POLICY "Avatars são publicamente visíveis"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars');
    END IF;

    -- Política para upload de avatars
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Usuários podem fazer upload de seus avatars'
    ) THEN
        CREATE POLICY "Usuários podem fazer upload de seus avatars"
        ON storage.objects FOR INSERT 
        WITH CHECK (
            bucket_id = 'avatars' 
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;

    -- Política para atualizar avatars
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Usuários podem atualizar seus avatars'
    ) THEN
        CREATE POLICY "Usuários podem atualizar seus avatars"
        ON storage.objects FOR UPDATE
        USING (
            bucket_id = 'avatars' 
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;

    -- Política para deletar avatars
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Usuários podem deletar seus avatars'
    ) THEN
        CREATE POLICY "Usuários podem deletar seus avatars"
        ON storage.objects FOR DELETE
        USING (
            bucket_id = 'avatars' 
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END $$;

-- Criar tabela para notificações de suporte
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'resolvido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para tabela de mensagens de suporte
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para mensagens de suporte
CREATE POLICY "Usuários podem inserir suas mensagens de suporte"
ON public.support_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver suas mensagens de suporte"
ON public.support_messages FOR SELECT
USING (auth.uid() = user_id);

-- Trigger para atualizar timestamp
CREATE TRIGGER update_support_messages_updated_at
    BEFORE UPDATE ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
-- Adicionar novo role para assistente de atendimento
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent';
-- Atualizar usuário para root admin
UPDATE users 
SET is_root_admin = true, updated_at = now()
WHERE id = '25a7fafb-ab0f-4ec4-a126-f6a837c8c123';

-- Inserir role de admin
INSERT INTO user_roles (user_id, role)
VALUES ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
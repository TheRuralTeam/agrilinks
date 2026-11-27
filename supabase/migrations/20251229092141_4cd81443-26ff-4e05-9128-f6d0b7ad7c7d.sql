-- Conceder TODAS as permissões administrativas ao usuário root superior
INSERT INTO admin_permissions (user_id, permission, granted_by)
VALUES 
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'manage_users', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123'),
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'manage_products', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123'),
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'manage_orders', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123'),
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'manage_support', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123'),
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'manage_sourcing', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123'),
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'view_analytics', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123'),
  ('25a7fafb-ab0f-4ec4-a126-f6a837c8c123', 'manage_admins', '25a7fafb-ab0f-4ec4-a126-f6a837c8c123')
ON CONFLICT DO NOTHING;
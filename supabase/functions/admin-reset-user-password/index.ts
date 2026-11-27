import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "Sessão obrigatória." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !anonKey || !serviceKey) return json(500, { error: "Configuração administrativa incompleta." });

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "Sessão inválida ou expirada." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: { user_id?: unknown; temporary_password?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Corpo do pedido inválido." }); }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const password = typeof body.temporary_password === "string" ? body.temporary_password : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return json(400, { error: "Utilizador inválido." });
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return json(400, { error: "A senha deve ter 12–128 caracteres, incluindo maiúscula, minúscula, número e símbolo." });

  const { data: callerProfile, error: callerProfileError } = await admin.from("users").select("is_root_admin,is_super_root").eq("id", authData.user.id).maybeSingle();
  if (callerProfileError || !callerProfile) return json(403, { error: "Perfil administrativo não encontrado." });
  const { data: permissionRows, error: permissionError } = await admin.from("admin_permissions").select("permission").eq("user_id", authData.user.id);
  if (permissionError) return json(500, { error: "Não foi possível validar as permissões." });
  const hasManageUsers = (permissionRows ?? []).some((row) => row.permission === "manage_users");
  if (!callerProfile.is_root_admin && !callerProfile.is_super_root && !hasManageUsers) return json(403, { error: "É necessária a permissão de gestão de utilizadores." });

  const { data: targetProfile, error: targetError } = await admin.from("users").select("id,is_root_admin,is_super_root").eq("id", userId).maybeSingle();
  if (targetError || !targetProfile) return json(404, { error: "Utilizador não encontrado." });
  if (targetProfile.is_super_root && !callerProfile.is_super_root) return json(403, { error: "Só o Super Root pode redefinir a senha de uma conta Super Root." });
  if (targetProfile.is_root_admin && !callerProfile.is_root_admin && !callerProfile.is_super_root) return json(403, { error: "Só um Root Admin pode redefinir a senha de outro administrador." });

  const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(userId);
  if (targetAuthError || !targetAuth.user) return json(404, { error: "Conta de autenticação não encontrada." });
  const previousAppMetadata = targetAuth.user.app_metadata ?? {};
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { ...previousAppMetadata, must_change_password: true, password_reset_at: new Date().toISOString() },
  });
  if (updateError) return json(500, { error: "O Supabase não conseguiu actualizar a senha. Nenhuma confirmação de sucesso foi emitida." });

  return json(200, { success: true, user_id: userId, must_change_password: true });
});

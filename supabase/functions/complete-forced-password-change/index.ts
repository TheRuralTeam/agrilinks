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
  if (authData.user.app_metadata?.must_change_password !== true) return json(403, { error: "Esta conta não tem uma alteração de senha pendente." });

  let body: { new_password?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Corpo do pedido inválido." }); }
  const password = typeof body.new_password === "string" ? body.new_password : "";
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return json(400, { error: "A senha deve ter 12–128 caracteres, incluindo maiúscula, minúscula, número e símbolo." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const currentMetadata = authData.user.app_metadata ?? {};
  const { error: updateError } = await admin.auth.admin.updateUserById(authData.user.id, {
    password,
    app_metadata: { ...currentMetadata, must_change_password: false, password_changed_after_reset_at: new Date().toISOString() },
  });
  if (updateError) return json(500, { error: "Não foi possível guardar a nova senha." });

  const { error: revokeError } = await admin.auth.admin.signOut(authorization.slice(7), "global");
  return json(200, { success: true, sessions_revoked: !revokeError });
});

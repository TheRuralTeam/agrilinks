import { createClient } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export const ADMIN_BANK_ACCESS_TOKEN_KEY = "agrilink.admin-bank-access";

export async function adminBankRpc<T = unknown>(
  functionName: string,
  args: Record<string, unknown> = {},
) {
  const token = sessionStorage.getItem(ADMIN_BANK_ACCESS_TOKEN_KEY);
  if (!token) return { data: null as T | null, error: new Error("ADMIN_BANK_ACCESS_REQUIRED") };

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session) return { data: null as T | null, error: new Error("ADMIN_SESSION_REQUIRED") };

  const gatedClient = createClient(supabase.supabaseUrl, supabase.supabaseKey, {
    global: {
      fetch: async (input, init = {}) => {
        const headers = new Headers(init.headers);
        headers.set("x-client-info", `agrilink-admin-bank-gate:${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: setSessionError } = await gatedClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setSessionError) return { data: null as T | null, error: setSessionError };
  return await (gatedClient as any).rpc(functionName, args) as { data: T | null; error: Error | null };
}

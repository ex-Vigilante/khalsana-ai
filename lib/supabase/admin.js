// Service-role client. Bypasses Row Level Security, so it is used ONLY by the signed webhook.
// Never import this file from client code.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/mode";

export const adminConfigured = () => Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function createAdminClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

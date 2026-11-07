// Loads the single store's settings with the caller's session client (RLS applies).
import "server-only";
import { DEFAULT_STORE } from "@/lib/catalog";
import { validateStore } from "@/lib/order";

export async function loadStore(supabase) {
  const { data } = await supabase.from("settings").select("store").eq("id", 1).maybeSingle();
  const v = data?.store ? validateStore(data.store) : null;
  return v && !v.error ? v.value : DEFAULT_STORE;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dbFail = (what, error) => {
  console.error(`${what}:`, error?.message || error);
  return Response.json({ error: "حصلت مشكلة في قاعدة البيانات. جرّب تاني بعد شوية." }, { status: 500 });
};
const NOSTORE = { "Cache-Control": "no-store" };
export const json = (data, status = 200) => Response.json(data, { status, headers: NOSTORE });

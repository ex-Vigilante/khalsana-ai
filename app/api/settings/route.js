import { bad, readJson } from "@/lib/server";
import { guard } from "@/lib/auth";
import { validateStore } from "@/lib/order";
import { dbFail, json, loadStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await guard(req);
  if (g.response) return g.response;
  return json({ store: await loadStore(g.access.supabase) });
}

export async function PUT(req) {
  const g = await guard(req, { write: true, owner: true });
  if (g.response) return g.response;
  const parsed = await readJson(req, 60_000);
  if (parsed.error) return bad(parsed.error);
  const v = validateStore(parsed.value?.store);
  if (v.error) return bad(v.error);
  // update first, insert only if the row is missing (column grants allow exactly these two writes)
  const { supabase } = g.access;
  const up = await supabase.from("settings").update({ store: v.value }).eq("id", 1).select("id");
  if (up.error) return dbFail("Save settings failed", up.error);
  if (!up.data?.length) {
    const ins = await supabase.from("settings").insert({ id: 1, store: v.value });
    if (ins.error) return dbFail("Save settings failed", ins.error);
  }
  return json({ store: v.value });
}

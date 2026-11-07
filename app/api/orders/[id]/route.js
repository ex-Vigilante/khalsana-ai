import { bad, readJson } from "@/lib/server";
import { guard } from "@/lib/auth";
import { STATUSES } from "@/lib/seed";
import { ORDER_COLS, orderFromRow } from "@/lib/dbmap";
import { dbFail, json } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idOf = async (params) => {
  const { id } = await params;
  return /^\d{1,12}$/.test(id) ? Number(id) : null;
};

export async function PATCH(req, { params }) {
  const g = await guard(req, { write: true });
  if (g.response) return g.response;
  const id = await idOf(params);
  if (id == null) return bad("الأوردر مش موجود.", 404);
  const parsed = await readJson(req, 5_000);
  if (parsed.error) return bad(parsed.error);
  if (!parsed.value || !STATUSES.some((s) => s.id === parsed.value.status)) return bad("الحالة مش صحيحة.");
  const { data, error } = await g.access.supabase
    .from("orders")
    .update({ status: parsed.value.status })
    .eq("id", id)
    .select(ORDER_COLS)
    .maybeSingle();
  if (error) return dbFail("Update order failed", error);
  if (!data) return bad("الأوردر مش موجود.", 404);
  return json({ order: orderFromRow(data) });
}

export async function DELETE(req, { params }) {
  const g = await guard(req, { write: true, owner: true });
  if (g.response) return g.response;
  const id = await idOf(params);
  if (id == null) return bad("الأوردر مش موجود.", 404);
  const { error } = await g.access.supabase.from("orders").delete().eq("id", id);
  if (error) return dbFail("Delete order failed", error);
  return json({ ok: true });
}

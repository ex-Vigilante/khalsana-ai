import { bad, readJson } from "@/lib/server";
import { guard } from "@/lib/auth";
import { GOV_NAMES } from "@/lib/governorates";
import { computeTotals, itemPrice, normalizePhone, validateExtraction } from "@/lib/order";
import { STATUSES } from "@/lib/seed";
import { ORDER_COLS, orderFromRow } from "@/lib/dbmap";
import { UUID_RE, dbFail, json, loadStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function GET(req) {
  const g = await guard(req);
  if (g.response) return g.response;
  const { data, error } = await g.access.supabase
    .from("orders")
    .select(ORDER_COLS)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return dbFail("List orders failed", error);
  return json({ orders: data.map(orderFromRow) });
}

// Adds an order. Items and totals are re-checked against the saved catalog, never trusted from the browser.
export async function POST(req) {
  const g = await guard(req, { write: true });
  if (g.response) return g.response;
  const parsed = await readJson(req, 40_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("الطلب مش صحيح.");
  const { supabase } = g.access;

  const name = text(b.name, 60);
  const phone = normalizePhone(b.phone);
  const address = text(b.address, 200);
  const notes = text(b.notes, 200);
  if (!name) return bad("اكتب اسم الزبون.");
  if (!phone) return bad("رقم التليفون مش صحيح.");
  if (typeof b.governorate !== "string" || !GOV_NAMES.includes(b.governorate)) return bad("اختار المحافظة.");
  if (!address) return bad("اكتب العنوان.");
  if (b.messageId != null && !(typeof b.messageId === "string" && UUID_RE.test(b.messageId))) return bad("الرسالة مش صحيحة.");

  const store = await loadStore(supabase);
  const ex = validateExtraction({ intent: "order", items: Array.isArray(b.items) ? b.items : [] }, store);
  if (!ex.items.length) return bad("ضيف صنف واحد على الأقل.");
  if (ex.items.some((it) => it.unavailable)) return bad("فيه صنف خلصان. شيله أو غيّره.");
  const items = ex.items.map(({ unavailable: _u, ...it }) => ({ ...it, price: itemPrice(store, it) }));
  const t = computeTotals({ items, governorate: b.governorate }, store);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      message_id: b.messageId || null,
      customer_name: name,
      phone,
      governorate: b.governorate,
      address,
      items,
      notes: notes || null,
      subtotal: t.subtotal,
      shipping: t.shipping,
      total: t.total,
    })
    .select(ORDER_COLS)
    .single();
  if (error) {
    if (error.code === "23503") return bad("الرسالة المرتبطة بالأوردر مش موجودة.", 400);
    if (error.code === "23505") return bad("الرسالة دي اتضاف ليها أوردر قبل كده.", 409);
    return dbFail("Insert order failed", error);
  }
  return json({ order: orderFromRow(data) }, 201);
}

// Bulk status change: { ids: ["1001", ...], status }
export async function PATCH(req) {
  const g = await guard(req, { write: true });
  if (g.response) return g.response;
  const parsed = await readJson(req, 20_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || !Array.isArray(b.ids) || b.ids.length === 0 || b.ids.length > 500) return bad("الطلب مش صحيح.");
  if (!STATUSES.some((s) => s.id === b.status)) return bad("الحالة مش صحيحة.");
  const ids = b.ids.map((x) => (typeof x === "string" && /^\d{1,12}$/.test(x) ? Number(x) : null));
  if (ids.includes(null)) return bad("رقم أوردر مش صحيح.");
  const { error } = await g.access.supabase.from("orders").update({ status: b.status }).in("id", ids);
  if (error) return dbFail("Bulk order update failed", error);
  return json({ ok: true });
}

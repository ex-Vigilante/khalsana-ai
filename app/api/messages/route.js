import { bad, readJson } from "@/lib/server";
import { guard } from "@/lib/auth";
import { MAX_MESSAGE, normalizePhone } from "@/lib/order";
import { MESSAGE_COLS, messageFromRow } from "@/lib/dbmap";
import { dbFail, json } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS = ["manual", "whatsapp", "messenger", "instagram"];

// Newest first. Filtering by status and channel happens in the page over this list.
export async function GET(req) {
  const g = await guard(req);
  if (g.response) return g.response;
  const { supabase } = g.access;
  const [list, done] = await Promise.all([
    supabase.from("messages").select(MESSAGE_COLS).order("received_at", { ascending: false }).limit(200),
    supabase.from("messages").select("id", { count: "exact", head: true }).in("status", ["extracted", "replied"]),
  ]);
  if (list.error) return dbFail("List messages failed", list.error);
  return json({ messages: list.data.map(messageFromRow), processed: done.count || 0 });
}

// Manual intake: a message the seller pasted in.
export async function POST(req) {
  const g = await guard(req, { write: true });
  if (g.response) return g.response;
  const parsed = await readJson(req, 10_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("الطلب مش صحيح.");
  const text = typeof b.text === "string" ? b.text.replace(/\u0000/g, "").trim() : "";
  if (!text) return bad("الصق نص الرسالة الأول.");
  if (text.length > MAX_MESSAGE) return bad("الرسالة أطول من 2000 حرف.");
  const name = typeof b.name === "string" ? b.name.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40) : "";
  const channel = b.channel == null || b.channel === "" ? "manual" : b.channel;
  if (!CHANNELS.includes(channel)) return bad("القناة مش صحيحة.");
  let phone = null;
  if (typeof b.phone === "string" && b.phone.trim()) {
    phone = normalizePhone(b.phone);
    if (!phone) return bad("رقم التليفون لازم يبدأ بـ 010 أو 011 أو 012 أو 015 وطوله 11 رقم.");
  }
  const { data, error } = await g.access.supabase
    .from("messages")
    .insert({ channel, from_name: name || null, from_phone: phone, body: text })
    .select(MESSAGE_COLS)
    .single();
  if (error) return dbFail("Insert message failed", error);
  return json({ message: messageFromRow(data) }, 201);
}

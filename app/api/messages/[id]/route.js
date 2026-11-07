import { bad, readJson } from "@/lib/server";
import { guard } from "@/lib/auth";
import { validateExtraction } from "@/lib/order";
import { MESSAGE_COLS, MESSAGE_STATUSES, messageFromRow } from "@/lib/dbmap";
import { UUID_RE, dbFail, json, loadStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Saves the (edited) extraction and/or the message status. A "replied" status can carry the reply text.
export async function PATCH(req, { params }) {
  const g = await guard(req, { write: true });
  if (g.response) return g.response;
  const { id } = await params;
  if (!UUID_RE.test(id)) return bad("الرسالة مش موجودة.", 404);
  const parsed = await readJson(req, 60_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("الطلب مش صحيح.");
  const { supabase } = g.access;
  const patch = {};

  if (b.extraction != null) {
    const x = b.extraction;
    if (typeof x !== "object" || Array.isArray(x) || typeof x.ex !== "object" || x.ex === null) return bad("الاستخراج مش صحيح.");
    const store = await loadStore(supabase);
    patch.extraction = {
      ex: validateExtraction(x.ex, store),
      source: x.source === "ai" ? "ai" : "demo",
      unavailable: Boolean(x.unavailable),
    };
  }
  if (b.status != null) {
    if (!MESSAGE_STATUSES.includes(b.status)) return bad("الحالة مش صحيحة.");
    patch.status = b.status;
  }
  if (Object.keys(patch).length === 0) return bad("مفيش حاجة تتحدّث.");

  const q = supabase.from("messages").update(patch).eq("id", id);
  // saving an extraction moves a brand-new message to "extracted" but never downgrades replied/ignored
  if (patch.extraction && !patch.status) {
    const first = await supabase.from("messages").update({ status: "extracted" }).eq("id", id).eq("status", "new");
    if (first.error) return dbFail("Update message status failed", first.error);
  }
  const { data, error } = await q.select(MESSAGE_COLS).maybeSingle();
  if (error) return dbFail("Update message failed", error);
  if (!data) return bad("الرسالة مش موجودة.", 404);

  if (b.status === "replied" && typeof b.replyText === "string" && b.replyText.trim()) {
    const { error: re } = await supabase.from("replies").insert({
      message_id: id,
      body: b.replyText.trim().slice(0, 2000),
      sent_via: "manual",
    });
    if (re) console.error("Insert reply failed:", re.message);
  }
  return json({ message: messageFromRow(data) });
}

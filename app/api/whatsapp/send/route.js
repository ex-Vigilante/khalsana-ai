import { bad, readJson } from "@/lib/server";
import { guard, teamLimited } from "@/lib/auth";
import { GRAPH_VERSION, sendErrorMessage } from "@/lib/whatsapp";
import { UUID_RE, dbFail, json } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Message ids being sent right now (this instance): blocks a double click or a duplicate request.
const inflight = new Set();

// Sends a text reply through the WhatsApp Cloud API. Only for messages that arrived through the API,
// and only inside Meta's 24-hour customer-service window (Meta enforces the window and tells us if it expired).
export async function POST(req) {
  const g = await guard(req, { write: true });
  if (g.response) return g.response;
  const { supabase, email } = g.access;
  if (teamLimited(`send:${email}`, 30)) return bad("بتبعت بسرعة. استنى شوية وجرّب تاني.", 429);

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId || !/^\d{5,30}$/.test(phoneId)) return bad("الإرسال من واتساب مش متفعّل. استخدم «افتح في واتساب».", 501);

  const parsed = await readJson(req, 10_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("الطلب مش صحيح.");
  if (typeof b.messageId !== "string" || !UUID_RE.test(b.messageId)) return bad("الرسالة مش صحيحة.");
  const body = typeof b.text === "string" ? b.text.replace(/\u0000/g, "").trim() : "";
  if (!body) return bad("اكتب الرد الأول.");
  if (body.length > 2000) return bad("الرد أطول من 2000 حرف.");

  const { data: msg, error: me } = await supabase
    .from("messages")
    .select("id, channel, external_id, from_phone")
    .eq("id", b.messageId)
    .maybeSingle();
  if (me) return dbFail("Load message for send failed", me);
  if (!msg) return bad("الرسالة مش موجودة.", 404);
  if (msg.channel !== "whatsapp" || !msg.external_id || !/^\d{8,20}$/.test(msg.from_phone || "")) {
    return bad("الرسالة دي مش جاية من واتساب API، فاستخدم «افتح في واتساب».");
  }

  // Idempotency: the same text already sent for this message in the last 30 seconds is not sent again.
  const since = new Date(Date.now() - 30_000).toISOString();
  const { data: dup, error: de } = await supabase
    .from("replies")
    .select("id")
    .eq("message_id", msg.id)
    .eq("sent_via", "whatsapp_api")
    .eq("body", body)
    .gte("created_at", since)
    .limit(1);
  if (de) return dbFail("Duplicate-send check failed", de);
  if (dup?.length) return bad("الرد ده اتبعت للزبون من لحظات. استنى شوية قبل ما تبعته تاني.", 409);
  if (inflight.has(msg.id)) return bad("الرد بيتبعت دلوقتي. استنى ثواني.", 409);
  inflight.add(msg.id);

  let res;
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: msg.from_phone,
        type: "text",
        text: { preview_url: false, body },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    inflight.delete(msg.id);
    console.error("WhatsApp send: network error:", err?.message || err);
    return bad("مقدرناش نوصل لواتساب دلوقتي. جرّب تاني.", 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    inflight.delete(msg.id);
    console.error("WhatsApp send failed:", res.status, data?.error?.code, data?.error?.message);
    const code = data?.error?.code;
    return bad(`${sendErrorMessage(data?.error)}${code ? ` (كود واتساب ${code})` : ""}`, res.status === 401 ? 502 : 422);
  }

  const wamid = data?.messages?.[0]?.id || null;
  // The message is already sent, so a bookkeeping failure is logged but does not fail the request.
  const { error: re } = await supabase
    .from("replies")
    .insert({ message_id: msg.id, body, sent_via: "whatsapp_api", external_id: wamid });
  if (re) console.error("Insert reply failed:", re.message);
  const { error: se } = await supabase.from("messages").update({ status: "replied" }).eq("id", msg.id);
  if (se) console.error("Mark replied failed:", se.message);
  inflight.delete(msg.id);
  return json({ ok: true, id: wamid });
}

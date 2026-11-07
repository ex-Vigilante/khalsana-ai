// WhatsApp Cloud API helpers: webhook signature, payload parsing, send errors.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const GRAPH_VERSION = "v21.0";
export const MAX_BODY = 4000;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// Verify token for the GET handshake. Compared in constant time.
export const verifyTokenOk = (given) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  return Boolean(expected) && typeof given === "string" && safeEqual(given, expected);
};

// X-Hub-Signature-256 is "sha256=" + HMAC-SHA256(raw body, app secret) in hex.
export function signatureOk(rawBody, header, secret) {
  if (!secret || typeof header !== "string") return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(m[1], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const PLACEHOLDER = {
  audio: "[رسالة صوتية]",
  voice: "[رسالة صوتية]",
  image: "[صورة]",
  video: "[فيديو]",
  document: "[ملف]",
  sticker: "[ستيكر]",
  location: "[لوكيشن]",
  contacts: "[جهة اتصال]",
};

const clip = (s) => String(s ?? "").replace(/\u0000/g, "").slice(0, MAX_BODY);

// Turns one WhatsApp message object into { text, isText } or null (ignored types such as reactions).
export function messageText(m) {
  if (!m || typeof m !== "object") return null;
  switch (m.type) {
    case "text":
      return typeof m.text?.body === "string" && m.text.body.trim() ? { text: clip(m.text.body), isText: true } : null;
    case "button": {
      const t = m.button?.text;
      return typeof t === "string" && t.trim() ? { text: clip(t), isText: true } : { text: "[رد على زر]", isText: false };
    }
    case "interactive": {
      const t = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title;
      return typeof t === "string" && t.trim() ? { text: clip(t), isText: true } : { text: "[رد تفاعلي]", isText: false };
    }
    case "reaction":
      return null;
    case "image":
    case "video":
    case "document": {
      const cap = m[m.type]?.caption;
      const base = PLACEHOLDER[m.type];
      return { text: clip(typeof cap === "string" && cap.trim() ? `${base} ${cap}` : base), isText: false };
    }
    default:
      return { text: PLACEHOLDER[m.type] || "[رسالة غير مدعومة]", isText: false };
  }
}

// Flattens entry[].changes[].value.messages[] into rows ready for the messages table.
// Changes for another phone number (value.metadata.phone_number_id) are skipped when WHATSAPP_PHONE_NUMBER_ID is set.
export function parsePayload(body, expectedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID) {
  const out = [];
  if (!body || typeof body !== "object" || body.object !== "whatsapp_business_account") return out;
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "messages") continue;
      const value = change.value;
      if (!value || typeof value !== "object") continue; // value.statuses (delivery receipts) are ignored
      if (expectedPhoneId && String(value.metadata?.phone_number_id ?? "") !== expectedPhoneId) continue;
      const names = new Map();
      for (const c of Array.isArray(value.contacts) ? value.contacts : []) {
        if (c?.wa_id) names.set(String(c.wa_id), String(c.profile?.name ?? "").slice(0, 80));
      }
      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        const id = typeof m?.id === "string" ? m.id.slice(0, 200) : "";
        const from = String(m?.from ?? "").replace(/\D/g, "").slice(0, 20);
        const t = messageText(m);
        if (!id || !from || !t) continue;
        const secs = Number(m.timestamp);
        out.push({
          channel: "whatsapp",
          external_id: id,
          from_phone: from,
          from_name: names.get(from) || null,
          body: t.text,
          received_at: Number.isFinite(secs) && secs > 0 && secs < 1e11 ? new Date(secs * 1000).toISOString() : new Date().toISOString(),
          isText: t.isText,
        });
      }
    }
  }
  return out;
}

// Arabic explanation for the errors Meta returns when sending.
export function sendErrorMessage(err) {
  const code = Number(err?.code);
  if (code === 131047)
    return "عدّى أكتر من ٢٤ ساعة على آخر رسالة من الزبون، فواتساب مش بيسمح بالرد من الـ API. افتح المحادثة في واتساب وردّ منها يدوي.";
  if (code === 190 || code === 102)
    return "توكن واتساب منتهي أو غلط. اعمل توكن دايم جديد وحطه في WHATSAPP_TOKEN على Vercel.";
  if (code === 131030)
    return "الرقم ده مش في قايمة الأرقام المسموحة لرقم التجربة. ضيفه في Meta أو استخدم رقم حقيقي.";
  if (code === 131026) return "الرسالة ماوصلتش: الرقم ده مش على واتساب أو مش بيستقبل رسايل.";
  if (code === 130429 || code === 80007 || code === 131056) return "فواتساب بيحدّ الإرسال دلوقتي. استنى شوية وجرّب تاني.";
  if (code === 10 || code === 200) return "التوكن مالوش صلاحية الإرسال (whatsapp_business_messaging). راجع صلاحيات الـ System User.";
  return "واتساب رفض الرسالة. جرّب تاني أو ابعتها يدوي من واتساب.";
}

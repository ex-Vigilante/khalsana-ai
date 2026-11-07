import { bad, forbidden, getIp, groqJson, isLive, rateLimited, readJson, sameOrigin, tooMany } from "@/lib/server";
import { MAX_MESSAGE, computeMissing, validateExtraction, validateStore } from "@/lib/order";
import { digitsToLatin } from "@/lib/arabic";
import { extractRules } from "@/lib/extract";
import { extractSystem, extractUser } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req) {
  if (!sameOrigin(req)) return forbidden();
  if (rateLimited(getIp(req))) return tooMany();
  const parsed = await readJson(req, 40_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("الطلب مش صحيح.");
  if (typeof b.message !== "string") return bad("ابعت نص الرسالة.");
  const message = b.message.replace(/\u0000/g, "").trim();
  if (!message) return bad("الرسالة فاضية.");
  if (message.length > MAX_MESSAGE) return bad("الرسالة أطول من 2000 حرف.");
  const s = validateStore(b.store);
  if (s.error) return bad(s.error);
  const store = s.value;

  // The rule-based result is always computed: it is the demo answer and a cross-check for AI output.
  const rules = extractRules(message, store);
  let unavailable = false;

  if (isLive()) {
    try {
      const raw = await groqJson({ system: extractSystem(store), user: extractUser(message), signal: req.signal });
      const ex = validateExtraction(raw, store);
      // A regex-found phone always wins. A model phone is kept only if its digits really are in the message.
      if (rules.phone) {
        ex.phone = rules.phone;
        ex.confidence.phone = rules.confidence.phone;
      } else if (ex.phone) {
        const digits = digitsToLatin(message).replace(/\D/g, "");
        if (!digits.includes(ex.phone.slice(1))) {
          ex.phone = null;
          ex.confidence.phone = 0;
        }
      }
      if (!ex.governorate && rules.governorate) {
        ex.governorate = rules.governorate;
        ex.confidence.governorate = Math.min(0.7, rules.confidence.governorate);
      }
      ex.missing_fields = computeMissing(ex, store);
      return Response.json({ source: "ai", extraction: ex }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (req.signal?.aborted) return new Response(null, { status: 499 });
      console.error("Groq extraction failed:", err?.message || err);
      unavailable = true;
    }
  }

  return Response.json(
    { source: "demo", unavailable, extraction: rules },
    { headers: { "Cache-Control": "no-store" } }
  );
}

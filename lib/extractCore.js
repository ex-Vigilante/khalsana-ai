// Shared extraction pipeline: used by /api/extract and by the WhatsApp webhook (AUTO_EXTRACT).
import "server-only";
import { groqJson, isLive } from "@/lib/server";
import { computeMissing, validateExtraction } from "@/lib/order";
import { digitsToLatin } from "@/lib/arabic";
import { extractRules } from "@/lib/extract";
import { extractSystem, extractUser } from "@/lib/prompts";

// Returns { source, unavailable, extraction }. Throws only if the request was aborted.
export async function runExtraction({ message, store, signal }) {
  // The rule-based result is always computed: it is the demo answer and a cross-check for AI output.
  const rules = extractRules(message, store);
  let unavailable = false;

  if (isLive()) {
    try {
      const raw = await groqJson({ system: extractSystem(store), user: extractUser(message), signal });
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
      return { source: "ai", unavailable: false, extraction: ex };
    } catch (err) {
      if (signal?.aborted) throw err;
      console.error("Groq extraction failed:", err?.message || err);
      unavailable = true;
    }
  }
  return { source: "demo", unavailable, extraction: rules };
}

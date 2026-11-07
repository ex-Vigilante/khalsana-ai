import { bad, forbidden, getIp, rateLimited, readJson, sameOrigin, streamAI, tooMany } from "@/lib/server";
import { MAX_MESSAGE, validateExtraction, validateStore } from "@/lib/order";
import { getAccess, teamLimited } from "@/lib/auth";
import { demoReply, replyFacts, replySystem, replyUser } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 30;

export async function POST(req) {
  if (!sameOrigin(req)) return forbidden();
  const access = await getAccess();
  if (access.state === "ok" ? teamLimited(access.email) : rateLimited(getIp(req))) return tooMany();
  const parsed = await readJson(req, 40_000);
  if (parsed.error) return bad(parsed.error);
  const b = parsed.value;
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("الطلب مش صحيح.");
  if (typeof b.message !== "string") return bad("ابعت نص الرسالة.");
  const message = b.message.replace(/\u0000/g, "").trim();
  if (!message) return bad("الرسالة فاضية.");
  if (message.length > MAX_MESSAGE) return bad("الرسالة أطول من 2000 حرف.");
  const tone = b.tone === "formal" ? "formal" : b.tone === "friendly" || b.tone == null ? "friendly" : null;
  if (!tone) return bad("النبرة لازم تكون ودود أو رسمي-خفيف.");
  const s = validateStore(b.store);
  if (s.error) return bad(s.error);
  const store = s.value;
  if (!b.extraction || typeof b.extraction !== "object") return bad("استخرج الأوردر الأول.");
  // the edited order card is re-validated against the catalog before it reaches the prompt
  const ex = validateExtraction(b.extraction, store);

  return streamAI({
    system: replySystem(store, tone),
    messages: [{ role: "user", content: replyUser(message, replyFacts(store, ex)) }],
    demo: () => demoReply(message, ex, store, tone),
    signal: req.signal,
  });
}

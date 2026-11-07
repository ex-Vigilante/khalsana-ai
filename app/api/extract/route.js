import { bad, forbidden, getIp, rateLimited, readJson, sameOrigin, tooMany } from "@/lib/server";
import { MAX_MESSAGE, validateStore } from "@/lib/order";
import { runExtraction } from "@/lib/extractCore";
import { getAccess, teamLimited } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req) {
  if (!sameOrigin(req)) return forbidden();
  // Signed-in staff get their own, larger allowance; everyone else (the public sandbox) is limited per IP.
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
  const s = validateStore(b.store);
  if (s.error) return bad(s.error);

  try {
    const out = await runExtraction({ message, store: s.value, signal: req.signal });
    const body = out.source === "ai" ? { source: "ai", extraction: out.extraction } : out;
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 499 });
  }
}

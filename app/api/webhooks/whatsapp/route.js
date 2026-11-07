// WhatsApp Cloud API webhook. Public URL, protected by Meta's HMAC signature (not by cookies or origin).
import "server-only";
import { after } from "next/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { parsePayload, signatureOk, verifyTokenOk } from "@/lib/whatsapp";
import { runExtraction } from "@/lib/extractCore";
import { validateStore } from "@/lib/order";
import { DEFAULT_STORE } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_RAW = 1_000_000; // Meta payloads are a few KB; refuse anything absurd

// Meta's one-time handshake when you save the webhook URL.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const challenge = q.get("hub.challenge") || "";
  if (q.get("hub.mode") === "subscribe" && verifyTokenOk(q.get("hub.verify_token")) && /^[\w.-]{1,200}$/.test(challenge)) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return new Response("Forbidden", { status: 403 });
}

async function readRaw(req) {
  if (Number(req.headers.get("content-length") || 0) > MAX_RAW) return null;
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RAW) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

const AUTO_BUDGET_MS = 20_000; // overall time budget; whatever is not done stays "new" for a manual extract
const AUTO_MAX = 10;

async function autoExtract(admin, rows) {
  const budget = new AbortController();
  const timer = setTimeout(() => budget.abort(), AUTO_BUDGET_MS);
  try {
    const { data } = await admin.from("settings").select("store").eq("id", 1).maybeSingle();
    const v = data?.store ? validateStore(data.store) : null;
    const store = v && !v.error ? v.value : DEFAULT_STORE;
    const results = await Promise.allSettled(
      rows.slice(0, AUTO_MAX).map(async (r) => {
        const out = await runExtraction({ message: r.body.slice(0, 2000), store, signal: budget.signal });
        const { error } = await admin
          .from("messages")
          .update({ extraction: { ex: out.extraction, source: out.source, unavailable: out.unavailable }, status: "extracted" })
          .eq("id", r.id)
          .eq("status", "new");
        if (error) throw error;
      })
    );
    for (const r of results) if (r.status === "rejected") console.error("Auto-extract skipped one message:", r.reason?.message || r.reason);
  } catch (err) {
    console.error("Auto-extract failed:", err?.message || err);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const raw = await readRaw(req);
  if (raw === null) return new Response("Payload too large", { status: 413 });
  // The signature is over the exact bytes Meta sent, so it is checked before any parsing.
  if (!signatureOk(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  let rows;
  try {
    rows = parsePayload(body);
  } catch (err) {
    console.error("WhatsApp webhook: unreadable payload:", err?.message || err);
    return new Response("Bad payload", { status: 400 });
  }
  if (rows.length === 0) return Response.json({ ok: true, received: 0 }); // statuses, reactions, other fields

  if (!adminConfigured()) {
    console.error("WhatsApp webhook: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing");
    return new Response("Database not configured", { status: 503 });
  }

  try {
    const admin = createAdminClient();
    const autoOn = String(process.env.AUTO_EXTRACT || "").toLowerCase() === "true";
    // external_id is unique, so Meta's retries are ignored; only genuinely new rows come back.
    const { data, error } = await admin
      .from("messages")
      .upsert(
        rows.map(({ isText, ...r }) => r),
        { onConflict: "external_id", ignoreDuplicates: true }
      )
      .select("id, body, external_id");
    if (error) throw error;
    if (autoOn && data?.length) {
      const textIds = new Set(rows.filter((r) => r.isText).map((r) => r.external_id));
      const fresh = data.filter((r) => textIds.has(r.external_id));
      if (fresh.length) after(() => autoExtract(admin, fresh));
    }
    return Response.json({ ok: true, received: rows.length });
  } catch (err) {
    // 500 on purpose: Meta retries failed deliveries, and the unique external_id makes a retry safe.
    console.error("WhatsApp webhook: saving messages failed:", err?.message || err);
    return new Response("Could not save", { status: 500 });
  }
}

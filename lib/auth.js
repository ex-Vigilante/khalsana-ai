// Server-side access checks. The database also enforces this with Row Level Security.
import "server-only";
import { PROD_CONFIGURED } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { bad, forbidden, sameOrigin } from "@/lib/server";

// state: "off" (sandbox only), "anon" (not signed in), "nomember" (signed in, not on the team),
// "error" (the auth service or database failed, so we cannot tell), "ok".
export async function getAccess() {
  if (!PROD_CONFIGURED) return { state: "off" };
  // outside the try: reading cookies() is what marks a page as dynamic, and Next must see that signal
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      // no/expired session is a normal "not signed in"; anything else (network, 5xx) is a failure
      const missing = !error || error.name === "AuthSessionMissingError" || (error.status >= 400 && error.status < 500);
      if (missing) return { state: "anon", supabase };
      console.error("Access check: auth lookup failed:", error.message);
      return { state: "error", supabase };
    }
    const email = data.user.email?.toLowerCase();
    if (!email) return { state: "anon", supabase };
    const { data: row, error: qe } = await supabase.from("team_members").select("email, role").eq("email", email).maybeSingle();
    if (qe) {
      console.error("Access check: team lookup failed:", qe.message);
      return { state: "error", supabase };
    }
    if (!row) return { state: "nomember", supabase, email };
    return { state: "ok", supabase, email, role: row.role };
  } catch (err) {
    console.error("Access check failed:", err?.message || err);
    return { state: "error", supabase };
  }
}

export const UNAVAILABLE_MSG = "الخدمة مش متاحة دلوقتي. جرّب تاني بعد شوية.";

// For route handlers. Returns { access } or { response } to send back as-is.
// owner: true limits the route to the store owner.
export async function guard(req, { write = false, owner = false } = {}) {
  if (!PROD_CONFIGURED) return { response: bad("الشغل الحقيقي مش متفعّل على النسخة دي.", 404) };
  if (write && !sameOrigin(req)) return { response: forbidden() };
  const access = await getAccess();
  if (access.state === "anon") return { response: bad("لازم تسجّل دخول الأول.", 401) };
  if (access.state === "error") return { response: bad(UNAVAILABLE_MSG, 503) };
  if (access.state !== "ok") return { response: bad("حسابك مش ضمن فريق المتجر.", 403) };
  if (owner && access.role !== "owner") return { response: bad("الإجراء ده لصاحب المتجر بس.", 403) };
  return { access };
}

const buckets = new Map();
// Generous per-user limit for signed-in staff (the public IP limiter stays for the sandbox).
export function teamLimited(key, max = 60) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < 60_000);
  if (list.length >= max) {
    buckets.set(key, list);
    return true;
  }
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 500) for (const [k, v] of buckets) if (!v.some((t) => now - t < 60_000)) buckets.delete(k);
  return false;
}

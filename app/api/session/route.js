import { guard } from "@/lib/auth";
import { json } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await guard(req);
  if (g.response) return g.response;
  return json({ email: g.access.email, role: g.access.role });
}

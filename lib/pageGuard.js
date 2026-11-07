// Used by the workspace pages: in production mode only signed-in team members get through.
// Returns a page to show instead (when the service is down), or null to continue.
import "server-only";
import { redirect } from "next/navigation";
import { PROD_CONFIGURED } from "@/lib/mode";
import { getAccess } from "@/lib/auth";
import Unavailable from "@/components/Unavailable";

export async function requireTeam(path = "/inbox") {
  if (!PROD_CONFIGURED) return null;
  const a = await getAccess();
  if (a.state === "anon") redirect(`/login?next=${encodeURIComponent(path)}`);
  if (a.state === "nomember") redirect("/no-access");
  if (a.state === "error") return <Unavailable />;
  return null;
}

import Analytics from "@/components/Analytics";
import { requireTeam } from "@/lib/pageGuard";

export const metadata = { title: "أرقام المتجر" };

export default async function Page() {
  const blocked = await requireTeam("/dashboard");
  if (blocked) return blocked;
  return <Analytics />;
}

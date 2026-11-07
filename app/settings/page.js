import SettingsView from "@/components/SettingsView";
import { requireTeam } from "@/lib/pageGuard";

export const metadata = { title: "الإعدادات" };

export default async function Page() {
  const blocked = await requireTeam("/settings");
  if (blocked) return blocked;
  return <SettingsView />;
}

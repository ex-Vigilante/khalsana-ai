import { Suspense } from "react";
import InboxView from "@/components/InboxView";
import { requireTeam } from "@/lib/pageGuard";

export const metadata = { title: "الرسايل" };

export default async function Page() {
  const blocked = await requireTeam("/inbox");
  if (blocked) return blocked;
  return (
    <Suspense fallback={<p className="loading" role="status">بنحمّل الرسايل…</p>}>
      <InboxView />
    </Suspense>
  );
}

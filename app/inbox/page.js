import { Suspense } from "react";
import InboxView from "@/components/InboxView";

export const metadata = { title: "الرسايل" };

export default function Page() {
  return (
    <Suspense fallback={<p className="loading" role="status">بنحمّل الرسايل…</p>}>
      <InboxView />
    </Suspense>
  );
}

import OrdersBoard from "@/components/OrdersBoard";
import { requireTeam } from "@/lib/pageGuard";

export const metadata = { title: "الأوردرات" };

export default async function Page() {
  const blocked = await requireTeam("/orders");
  if (blocked) return blocked;
  return <OrdersBoard />;
}

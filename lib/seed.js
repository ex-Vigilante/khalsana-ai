// Demo orders for the analytics page: ~25 orders over the last 14 days.
// Deterministic (seeded PRNG), so the numbers look the same on every fresh load.
import { DEFAULT_STORE } from "./catalog.js";
import { computeTotals } from "./order.js";

export const STATUSES = [
  { id: "new", label: "جديد" },
  { id: "confirmed", label: "مؤكَّد" },
  { id: "shipped", label: "اتشحن" },
  { id: "delivered", label: "اتسلّم" },
  { id: "returned", label: "مرتجع" },
];
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "منى سمير", "هبة محمود", "كريم أحمد", "نورهان عبد الله", "سارة خالد", "يوسف عادل", "ريهام فتحي", "دينا مصطفى",
  "أحمد حسن", "مريم علي", "إيمان صلاح", "محمد طارق", "شيماء رضا", "آية ناصر", "هدير سعيد", "عمر إبراهيم",
];
const PLACES = [
  ["القاهرة", "مدينة نصر - شارع مصطفى النحاس"], ["القاهرة", "المعادي - شارع 9"], ["الجيزة", "6 أكتوبر - الحي المتميز"],
  ["الجيزة", "الدقي - شارع التحرير"], ["الإسكندرية", "سموحة - شارع فوزي معاذ"], ["القليوبية", "شبرا الخيمة - شارع الترعة"],
  ["الدقهلية", "المنصورة - شارع الجمهورية"], ["الغربية", "طنطا - شارع البحر"], ["الشرقية", "الزقازيق - شارع سعد زغلول"],
  ["أسيوط", "أسيوط - شارع الجمهورية"], ["سوهاج", "سوهاج - شارع الكورنيش"], ["المنوفية", "شبين الكوم - شارع الجلاء"],
];
const GOV_WEIGHT = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 0];
const CHANNELS = ["whatsapp", "whatsapp", "whatsapp", "messenger", "messenger", "instagram"];

export function seedOrders(now = new Date()) {
  const r = rng(20261107);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const orders = [];
  const store = DEFAULT_STORE;
  const count = 25;
  for (let i = 0; i < count; i++) {
    // newer orders first in id order; spread over 14 days, 4 of them today
    const daysAgo = i < 4 ? 0 : Math.min(13, Math.floor(((i - 4) / (count - 4)) * 14 + r() * 1.2));
    const when = new Date(now.getTime() - daysAgo * 86400000 - Math.floor(r() * 5 * 3600000) - (i < 4 ? i * 600000 : 0));
    const [gov, address] = PLACES[GOV_WEIGHT[Math.floor(r() * GOV_WEIGHT.length)]];
    const nItems = r() < 0.3 ? 2 : 1;
    const items = [];
    for (let k = 0; k < nItems; k++) {
      const p = pick(store.products.filter((x) => x.available));
      if (items.some((x) => x.productId === p.id)) continue;
      items.push({
        productId: p.id, name: p.name, size: pick(p.sizes), color: pick(p.colors),
        qty: r() < 0.2 ? 2 : 1, price: p.price,
      });
    }
    const ex = { items, governorate: gov };
    const t = computeTotals(ex, store);
    let status;
    if (daysAgo === 0) status = pick(["new", "new", "confirmed"]);
    else if (daysAgo <= 2) status = pick(["confirmed", "shipped", "shipped"]);
    else status = r() < 0.12 ? "returned" : pick(["delivered", "delivered", "delivered", "shipped"]);
    orders.push({
      id: String(1001 + (count - 1 - i)),
      createdAt: when.toISOString(),
      channel: pick(CHANNELS),
      status,
      name: pick(NAMES),
      phone: "01" + pick(["0", "1", "2", "5"]) + String(10000000 + Math.floor(r() * 89999999)),
      governorate: gov,
      address,
      items,
      notes: "",
      subtotal: t.subtotal,
      shipping: t.shipping,
      total: t.total,
      demo: true,
    });
  }
  return orders;
}

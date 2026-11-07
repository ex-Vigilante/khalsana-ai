"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STORE } from "@/lib/catalog";
import { seedOrders, STATUSES } from "@/lib/seed";
import { validateStore } from "@/lib/order";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const K = { store: "khalsana.store.v1", orders: "khalsana.orders.v1", inbox: "khalsana.inbox.v1" };
// "Messages processed" starts from a demo base so the time-saved KPI is not empty on day one.
export const DEMO_PROCESSED_BASE = 30;

// Orders come from localStorage, so check the shape before trusting them.
const validOrder = (o) =>
  o && typeof o === "object" && typeof o.id === "string" && typeof o.name === "string" && typeof o.governorate === "string" &&
  typeof o.createdAt === "string" && !Number.isNaN(Date.parse(o.createdAt)) && STATUSES.some((s) => s.id === o.status) &&
  Number.isFinite(o.total) && Number.isFinite(o.subtotal) && Number.isFinite(o.shipping) &&
  Array.isArray(o.items) && o.items.every((it) => it && typeof it.name === "string" && Number.isFinite(it.qty));

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be blocked or full; the app keeps working in memory */
  }
}

export default function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState(DEFAULT_STORE);
  const [orders, setOrders] = useState([]);
  const [inbox, setInbox] = useState({ pasted: [], added: {}, processed: [] });
  const [extractions, setExtractions] = useState({});
  const [live, setLive] = useState(null);
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    const s = load(K.store, null);
    const o = load(K.orders, null);
    const i = load(K.inbox, null);
    const vs = s ? validateStore(s) : null;
    setStore(vs && !vs.error ? vs.value : DEFAULT_STORE);
    setOrders(Array.isArray(o) ? o.filter(validOrder) : seedOrders());
    if (i && typeof i === "object" && !Array.isArray(i)) {
      setInbox({
        pasted: Array.isArray(i.pasted) ? i.pasted.filter((m) => m && typeof m.id === "string" && typeof m.text === "string" && typeof m.ts === "number").slice(0, 30) : [],
        added: i.added && typeof i.added === "object" ? i.added : {},
        processed: Array.isArray(i.processed) ? i.processed.filter((x) => typeof x === "string") : [],
      });
    }
    setThemeState(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    setReady(true);
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setLive(Boolean(d.live)))
      .catch(() => setLive(false));
  }, []);

  useEffect(() => {
    if (!ready) return;
    save(K.store, store);
    save(K.orders, orders);
    save(K.inbox, inbox);
  }, [ready, store, orders, inbox]);

  const setTheme = useCallback((t) => {
    document.documentElement.dataset.theme = t;
    setThemeState(t);
    try {
      localStorage.setItem("khalsana.theme", t);
    } catch {}
  }, []);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const addOrder = useCallback((draft) => {
    const id = String(ordersRef.current.reduce((m, o) => Math.max(m, Number(o.id) || 0), 1000) + 1);
    const order = { ...draft, id, createdAt: new Date().toISOString(), status: "new" };
    ordersRef.current = [order, ...ordersRef.current];
    setOrders((prev) => [order, ...prev]);
    return id;
  }, []);

  const value = useMemo(
    () => ({
      ready, store, orders, inbox, extractions, live, theme, setTheme,
      messagesProcessed: DEMO_PROCESSED_BASE + inbox.processed.length,
      setStore,
      resetStore: () => setStore(DEFAULT_STORE),
      setOrders,
      addOrder,
      moveOrder: (id, status) => setOrders((p) => p.map((o) => (o.id === id ? { ...o, status } : o))),
      deleteOrder: (id) => setOrders((p) => p.filter((o) => o.id !== id)),
      resetOrders: () => setOrders(seedOrders()),
      addPasted: (m) => setInbox((p) => ({ ...p, pasted: [m, ...p.pasted].slice(0, 30) })),
      markProcessed: (id) =>
        setInbox((p) => (p.processed.includes(id) ? p : { ...p, processed: [...p.processed, id] })),
      markAdded: (msgId, orderId) => setInbox((p) => ({ ...p, added: { ...p.added, [msgId]: orderId } })),
      setExtraction: (id, data) => setExtractions((p) => ({ ...p, [id]: typeof data === "function" ? data(p[id]) : data })),
    }),
    [ready, store, orders, inbox, extractions, live, theme, setTheme, addOrder]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

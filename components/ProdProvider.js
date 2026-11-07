"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STORE } from "@/lib/catalog";
import { validateStore } from "@/lib/order";
import { Ctx, useCommon } from "./appContext";

const POLL_MS = 15_000;
const SAVE_DELAY = 700;

// Calls our own workspace API. A 401 means the session ended, so go back to the login page.
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("انتهت الجلسة. سجّل دخول تاني.");
  }
  if (!res.ok) throw new Error(data.error || "حصلت مشكلة. جرّب تاني.");
  return data;
}

// The real workspace: data lives in Supabase and is read/written through the API routes (RLS applies).
export default function ProdProvider({ children }) {
  const common = useCommon();
  const [ready, setReady] = useState(false);
  const [store, setStoreState] = useState(DEFAULT_STORE);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [processed, setProcessed] = useState(0);
  const [extractions, setExtractionsState] = useState({});
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("");

  const extRef = useRef({});
  const pending = useRef(0); // mutations in flight: polling waits so it cannot overwrite optimistic changes
  const timers = useRef({});
  const dirtyStore = useRef(false);
  const ordersRefHolder = useRef(orders);
  ordersRefHolder.current = orders;

  const fail = useCallback((e) => setNotice(e?.message || "حصلت مشكلة. جرّب تاني."), []);

  // Saved extractions come from the database; local edits in progress are never overwritten.
  const mergeExtractions = useCallback((list) => {
    let changed = false;
    const next = { ...extRef.current };
    for (const m of list) {
      const x = m.extraction;
      if (x?.ex && !next[m.id]) {
        next[m.id] = { ex: x.ex, source: x.source === "ai" ? "ai" : "demo", unavailable: Boolean(x.unavailable), reply: null };
        changed = true;
      }
    }
    if (changed) {
      extRef.current = next;
      setExtractionsState(next);
    }
  }, []);

  const refresh = useCallback(async () => {
    const [m, o] = await Promise.all([api("/api/messages"), api("/api/orders")]);
    if (pending.current > 0) return;
    setMessages(m.messages);
    setProcessed(m.processed);
    setOrders(o.orders);
    mergeExtractions(m.messages);
  }, [mergeExtractions]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await api("/api/settings");
        const v = validateStore(s.store);
        if (alive) setStoreState(v.error ? DEFAULT_STORE : v.value);
        await refresh();
      } catch (e) {
        if (alive) fail(e);
      } finally {
        if (alive) setReady(true);
      }
    })();
    const tick = () => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    };
    const iv = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    const pendingTimers = timers.current;
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
      Object.values(pendingTimers).forEach(clearTimeout);
    };
  }, [refresh, fail]);

  /* ---------- settings: debounced save ---------- */
  const setStore = useCallback((u) => {
    dirtyStore.current = true;
    setStoreState((prev) => (typeof u === "function" ? u(prev) : u));
  }, []);
  useEffect(() => {
    if (!ready || !dirtyStore.current) return;
    const v = validateStore(store);
    if (v.error) {
      setSaveState("invalid");
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      dirtyStore.current = false;
      try {
        await api("/api/settings", { method: "PUT", body: { store: v.value } });
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        fail(e);
      }
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [ready, store, fail]);

  /* ---------- extraction: kept locally, saved (debounced) on the message ---------- */
  const setExtraction = useCallback(
    (id, data) => {
      const prev = extRef.current[id];
      const next = typeof data === "function" ? data(prev) : data;
      extRef.current = { ...extRef.current, [id]: next };
      setExtractionsState(extRef.current);
      if (next?.ex && next.ex !== prev?.ex) {
        clearTimeout(timers.current[id]);
        timers.current[id] = setTimeout(async () => {
          try {
            const r = await api(`/api/messages/${id}`, {
              method: "PATCH",
              body: { extraction: { ex: next.ex, source: next.source, unavailable: next.unavailable } },
            });
            setMessages((p) => p.map((m) => (m.id === id ? { ...m, status: r.message.status } : m)));
          } catch (e) {
            fail(e);
          }
        }, SAVE_DELAY);
      }
    },
    [fail]
  );

  /* ---------- mutations ---------- */
  const mutate = useCallback(
    async (fn) => {
      pending.current++;
      try {
        return await fn();
      } finally {
        pending.current--;
      }
    },
    []
  );

  const addOrder = useCallback(
    (draft) =>
      mutate(async () => {
        const r = await api("/api/orders", {
          method: "POST",
          body: {
            messageId: draft.messageId,
            name: draft.name,
            phone: draft.phone,
            governorate: draft.governorate,
            address: draft.address,
            items: draft.items,
            notes: draft.notes,
          },
        });
        setOrders((p) => [r.order, ...p]);
        return r.order.id;
      }),
    [mutate]
  );

  const moveOrders = useCallback(
    (ids, status) => {
      const set = new Set(ids);
      const before = ordersRefHolder.current;
      setOrders((p) => p.map((o) => (set.has(o.id) ? { ...o, status } : o)));
      return mutate(async () => {
        try {
          await (ids.length === 1
            ? api(`/api/orders/${ids[0]}`, { method: "PATCH", body: { status } })
            : api("/api/orders", { method: "PATCH", body: { ids, status } }));
        } catch (e) {
          setOrders(before);
          fail(e);
        }
      });
    },
    [mutate, fail]
  );
  const deleteOrder = useCallback(
    (id) => {
      const before = ordersRefHolder.current;
      setOrders((p) => p.filter((o) => o.id !== id));
      return mutate(async () => {
        try {
          await api(`/api/orders/${id}`, { method: "DELETE" });
        } catch (e) {
          setOrders(before);
          fail(e);
        }
      });
    },
    [mutate, fail]
  );

  const addManual = useCallback(
    (m) =>
      mutate(async () => {
        const r = await api("/api/messages", { method: "POST", body: m });
        setMessages((p) => [r.message, ...p]);
        return r.message;
      }),
    [mutate]
  );

  const setMessageStatus = useCallback(
    (id, status, replyText) =>
      mutate(async () => {
        const r = await api(`/api/messages/${id}`, { method: "PATCH", body: { status, replyText } });
        setMessages((p) => p.map((m) => (m.id === id ? { ...m, status: r.message.status } : m)));
      }),
    [mutate]
  );

  const sendWhatsApp = useCallback(
    (messageId, text) =>
      mutate(async () => {
        const r = await api("/api/whatsapp/send", { method: "POST", body: { messageId, text } });
        setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, status: "replied" } : m)));
        return r;
      }),
    [mutate]
  );

  const integrations = common.status?.integrations || null;
  const email = common.status?.email;
  const role = common.status?.role;
  const user = useMemo(() => (email ? { email, role } : null), [email, role]);

  const orderIds = useMemo(() => {
    const added = {};
    for (const o of orders) if (o.messageId) added[o.messageId] = o.id;
    return added;
  }, [orders]);
  const inbox = useMemo(() => ({ pasted: [], added: orderIds, processed: [] }), [orderIds]);

  const value = useMemo(
    () => ({
      mode: "prod", base: "",
      ready, store, orders, inbox, extractions, messages,
      live: common.live, theme: common.theme, setTheme: common.setTheme,
      integrations, status: common.status, user, notice, clearNotice: () => setNotice(""), saveState,
      messagesProcessed: processed,
      setStore,
      resetStore: () => setStore(DEFAULT_STORE),
      setOrders,
      addOrder,
      moveOrder: (id, status) => moveOrders([id], status),
      moveOrders,
      deleteOrder,
      resetOrders: null,
      addManual,
      markProcessed: () => {},
      markAdded: () => {},
      setExtraction,
      setMessageStatus,
      sendWhatsApp,
    }),
    [ready, store, orders, inbox, extractions, messages, common.live, common.theme, common.setTheme, common.status, integrations, user, notice, saveState, processed, setStore, addOrder, moveOrders, deleteOrder, addManual, setExtraction, setMessageStatus, sendWhatsApp]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

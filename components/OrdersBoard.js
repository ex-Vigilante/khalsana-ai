"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import LabelSheet from "./LabelSheet";
import { STATUSES } from "@/lib/seed";
import { downloadCsv } from "@/lib/csv";
import { channelLabel } from "@/lib/samples";
import { fmtMoney, fmtNum } from "@/lib/arabic";

const fmtDate = (iso) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function OrdersBoard() {
  const { ready, orders, store, moveOrder, deleteOrder, setOrders, resetOrders } = useApp();
  const [q, setQ] = useState("");
  const [gov, setGov] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [col, setCol] = useState("new");
  const [labels, setLabels] = useState(false);
  const [bulk, setBulk] = useState("");

  const govs = useMemo(() => [...new Set(orders.map((o) => o.governorate))].sort((a, b) => a.localeCompare(b, "ar")), [orders]);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (gov && o.governorate !== gov) return false;
      if (!n) return true;
      const hay = [o.id, o.name, o.phone, o.address, o.governorate, ...o.items.map((i) => i.name)].join(" ").toLowerCase();
      return hay.includes(n);
    });
  }, [orders, q, gov]);

  if (!ready) return <p className="loading" role="status">بنحمّل الأوردرات…</p>;

  const selected = orders.filter((o) => sel.has(o.id));
  const visibleIds = filtered.map((o) => o.id);
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id));
  const toggle = (id) =>
    setSel((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const exportList = selected.length ? selected : filtered;

  return (
    <div className="page">
      <div className="page-head">
        <h1>الأوردرات</h1>
        <p className="sub">
          {fmtNum(orders.length)} أوردر. جزء منهم أوردرات تجريبية للعرض. <Link href="/inbox">ضيف أوردر من الرسايل</Link>
        </p>
      </div>

      <div className="toolbar card" role="search">
        <div className="tb-field">
          <label htmlFor="q">بحث</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم، التليفون، رقم الأوردر…" />
        </div>
        <div className="tb-field">
          <label htmlFor="gov">المحافظة</label>
          <select id="gov" value={gov} onChange={(e) => setGov(e.target.value)}>
            <option value="">كل المحافظات</option>
            {govs.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={allVisible}
            onChange={() =>
              setSel((p) => {
                const n = new Set(p);
                allVisible ? visibleIds.forEach((id) => n.delete(id)) : visibleIds.forEach((id) => n.add(id));
                return n;
              })
            }
          />
          تحديد كل المعروض ({fmtNum(filtered.length)})
        </label>
      </div>

      <div className="bulkbar" role="region" aria-label="إجراءات على المحدد" aria-live="polite">
        <span><strong>{fmtNum(selected.length)}</strong> محدد</span>
        <button type="button" className="btn btn-primary" disabled={!selected.length} onClick={() => setLabels(true)}>
          اطبع ليبلات ({fmtNum(selected.length)})
        </button>
        <button type="button" className="btn btn-ghost" disabled={!exportList.length} onClick={() => downloadCsv(exportList)}>
          تصدير CSV ({fmtNum(exportList.length)}{selected.length ? " محدد" : " معروض"})
        </button>
        <label className="sr-only" htmlFor="bulk">نقل المحدد إلى</label>
        <select
          id="bulk"
          value={bulk}
          disabled={!selected.length}
          onChange={(e) => {
            const s = e.target.value;
            if (!s) return;
            setOrders((p) => p.map((o) => (sel.has(o.id) ? { ...o, status: s } : o)));
            setBulk("");
          }}
        >
          <option value="">انقل المحدد إلى…</option>
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" className="btn btn-ghost" disabled={!selected.length} onClick={() => setSel(new Set())}>مسح التحديد</button>
      </div>

      <div className="col-tabs" role="tablist" aria-label="مراحل الأوردر">
        {STATUSES.map((s) => (
          <button key={s.id} role="tab" type="button" aria-selected={col === s.id} onClick={() => setCol(s.id)}>
            {s.label} <span className="count">{fmtNum(filtered.filter((o) => o.status === s.id).length)}</span>
          </button>
        ))}
      </div>

      <div className="board">
        {STATUSES.map((s, si) => {
          const list = filtered.filter((o) => o.status === s.id);
          const prev = STATUSES[si - 1];
          const next = STATUSES[si + 1];
          return (
            <section key={s.id} className={`col col-${s.id}`} data-show={col === s.id} aria-labelledby={`h-${s.id}`}>
              <h2 id={`h-${s.id}`}>
                {s.label} <span className="count">{fmtNum(list.length)}</span>
              </h2>
              {list.length === 0 && <p className="muted small pad">مفيش أوردرات هنا.</p>}
              <ul>
                {list.map((o) => (
                  <li key={o.id} className={`ocard ${sel.has(o.id) ? "is-sel" : ""}`}>
                    <div className="ocard-top">
                      <label className="check">
                        <input type="checkbox" checked={sel.has(o.id)} onChange={() => toggle(o.id)} aria-label={`تحديد أوردر ${o.id}`} />
                        <strong dir="ltr">#{o.id}</strong>
                      </label>
                      <span className="small muted">{fmtDate(o.createdAt)}</span>
                    </div>
                    <div className="ocard-name">{o.name}</div>
                    <div className="ocard-meta">
                      <span className="badge badge-muted">{o.governorate}</span>
                      <span className="badge badge-muted">{channelLabel(o.channel)}</span>
                      {o.demo && <span className="badge badge-muted">تجريبي</span>}
                    </div>
                    <ul className="ocard-items">
                      {o.items.map((it, i) => (
                        <li key={i}>
                          {fmtNum(it.qty)} × {it.name}
                          {[it.size, it.color].filter(Boolean).length > 0 && <span className="muted"> ({[it.size, it.color].filter(Boolean).join(" / ")})</span>}
                        </li>
                      ))}
                    </ul>
                    <div className="ocard-total">
                      <span className="muted small">عند الاستلام</span>
                      <strong>{fmtMoney(o.total)}</strong>
                    </div>
                    <div className="ocard-actions">
                      {prev && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveOrder(o.id, prev.id)} aria-label={`رجّع أوردر ${o.id} إلى ${prev.label}`}>
                          رجّع: {prev.label}
                        </button>
                      )}
                      {next && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => moveOrder(o.id, next.id)} aria-label={`حرّك أوردر ${o.id} إلى ${next.label}`}>
                          حرّك: {next.label}
                        </button>
                      )}
                      <label className="sr-only" htmlFor={`mv-${o.id}`}>نقل أوردر {o.id} إلى</label>
                      <select id={`mv-${o.id}`} className="mv" value="" onChange={(e) => e.target.value && moveOrder(o.id, e.target.value)}>
                        <option value="">انقل إلى…</option>
                        {STATUSES.filter((x) => x.id !== o.status).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        onClick={() => {
                          if (window.confirm(`تمسح أوردر #${o.id}؟`)) {
                            deleteOrder(o.id);
                            setSel((p) => {
                              const n = new Set(p);
                              n.delete(o.id);
                              return n;
                            });
                          }
                        }}
                        aria-label={`امسح أوردر ${o.id}`}
                      >
                        مسح
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="footnote small muted">
        الحالة الحالية محفوظة في متصفحك بس.{" "}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            if (window.confirm("ترجّع الأوردرات للبيانات التجريبية الأصلية؟ هتتمسح أوردراتك.")) {
              resetOrders();
              setSel(new Set());
            }
          }}
        >
          رجّع البيانات التجريبية
        </button>
      </p>

      {labels && selected.length > 0 && <LabelSheet orders={selected} storeName={store.name} onClose={() => setLabels(false)} />}
    </div>
  );
}

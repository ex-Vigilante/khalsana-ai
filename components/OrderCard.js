"use client";
import Link from "next/link";
import { useId, useMemo } from "react";
import { useApp } from "./AppProvider";
import { GOV_NAMES } from "@/lib/governorates";
import { computeMissing, computeTotals, itemPrice, itemProblem, normalizePhone, PHONE_RE } from "@/lib/order";
import { fmtMoney } from "@/lib/arabic";

const LOW = 0.7;
const sigOf = (ex) =>
  (ex.items || []).map((i) => `${i.productId}|${i.size || ""}|${i.color || ""}|${i.qty}`).sort().join(";");

// Field wrapper that marks missing / low-confidence values.
function Field({ label, state, hint, children, htmlFor }) {
  return (
    <div className={`field ${state ? `field-${state}` : ""}`}>
      <div className="field-top">
        <label htmlFor={htmlFor}>{label}</label>
        {state === "missing" && <span className="tag tag-warn">ناقص</span>}
        {state === "low" && <span className="tag tag-orange">راجعه</span>}
      </div>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export default function OrderCard({ msg, entry }) {
  const app = useApp();
  const { store, orders, extractions, inbox } = app;
  const uid = useId();
  const ex = entry.ex;
  const conf = ex.confidence || {};
  const added = inbox.added[msg.id];

  const patch = (p) =>
    app.setExtraction(msg.id, (prev) => {
      const next = { ...prev.ex, ...p };
      next.missing_fields = computeMissing(next, store);
      return { ...prev, ex: next };
    });
  const setItem = (i, p) => patch({ items: ex.items.map((it, k) => (k === i ? { ...it, ...p } : it)) });

  const totals = useMemo(() => computeTotals(ex, store), [ex, store]);
  const phoneOk = PHONE_RE.test(ex.phone || "");

  const dup = useMemo(() => {
    if (!ex.phone || !ex.items?.length) return null;
    const s = sigOf(ex);
    const o = orders.find((x) => x.phone === ex.phone && sigOf({ items: x.items }) === s);
    if (o) return `ممكن يكون مكرر: فيه أوردر #${new Intl.NumberFormat("ar-EG").format(Number(o.id))} على البورد بنفس الرقم والأصناف.`;
    const other = Object.entries(extractions).find(([id, e]) => id !== msg.id && e.ex.phone === ex.phone && sigOf(e.ex) === s);
    if (other) return "ممكن يكون مكرر: فيه رسالة تانية بنفس الرقم والأصناف.";
    return null;
  }, [ex, orders, extractions, msg.id]);

  const state = (key, value) => (!value ? "missing" : (conf[key] ?? 1) < LOW ? "low" : "");
  const isOrder = ex.intent === "order";

  const problems = (ex.items || []).map((it) => itemProblem(store, it));
  const blockers = [];
  if (!ex.name) blockers.push("الاسم");
  if (problems.includes("deleted")) blockers.push("صنف اتمسح من الإعدادات (شيله أو غيّره)");
  if (problems.includes("unavailable")) blockers.push("صنف خلصان (شيله أو غيّره)");
  if (!ex.items?.length) blockers.push("الأصناف");
  if (!phoneOk) blockers.push("رقم تليفون صحيح");
  if (!ex.governorate) blockers.push("المحافظة");
  if (!ex.address) blockers.push("العنوان");

  function addToBoard() {
    const items = ex.items.map((it) => ({ ...it, price: itemPrice(store, it) }));
    const t = computeTotals(ex, store);
    const id = app.addOrder({
      channel: msg.channel,
      name: ex.name,
      phone: ex.phone,
      governorate: ex.governorate,
      address: ex.address,
      items,
      notes: ex.notes || "",
      subtotal: t.subtotal,
      shipping: t.shipping,
      total: t.total,
    });
    app.markAdded(msg.id, id);
  }

  return (
    <div className="card order-card">
      <div className="card-head">
        <h2>كارت الأوردر</h2>
        <span className="small muted">{entry.source === "ai" ? "من الـ AI" : "من القواعد"}</span>
      </div>

      {!isOrder && (
        <p className="alert alert-warn small">
          الرسالة دي شكلها {ex.intent === "question" ? "سؤال" : ex.intent === "complaint" ? "شكوى" : "مش أوردر"}، مش طلب. اكتب الرد المناسب، ولو فعلاً أوردر كمّل الحقول وضيفه.
        </p>
      )}
      {dup && <p className="alert alert-warn small" role="status">{dup}</p>}
      {ex.notes && <p className="note small">ملاحظة: {ex.notes}</p>}

      <Field label="الاسم" state={isOrder ? state("name", ex.name) : ""} htmlFor={`${uid}-name`}>
        <input id={`${uid}-name`} value={ex.name || ""} maxLength={60} onChange={(e) => patch({ name: e.target.value || null, confidence: { ...conf, name: 1 } })} />
        {!ex.name && msg.from && (!msg.pasted || msg.named) && (
          <button type="button" className="link-btn" onClick={() => patch({ name: msg.from, confidence: { ...conf, name: 0.6 } })}>
            استخدم اسم البروفايل: {msg.from}
          </button>
        )}
      </Field>

      <Field
        label="التليفون"
        state={isOrder ? (ex.phone && !phoneOk ? "missing" : state("phone", ex.phone)) : ""}
        htmlFor={`${uid}-phone`}
        hint={ex.phone && !phoneOk ? "الرقم لازم يبدأ بـ 010 أو 011 أو 012 أو 015 وطوله 11 رقم." : null}
      >
        <input
          id={`${uid}-phone`}
          dir="ltr"
          inputMode="tel"
          className="ltr-input"
          value={ex.phone || ""}
          maxLength={20}
          onChange={(e) => patch({ phone: e.target.value || null })}
          onBlur={(e) => {
            const p = normalizePhone(e.target.value);
            if (p) patch({ phone: p, confidence: { ...conf, phone: 1 } });
          }}
        />
      </Field>

      <Field label="المحافظة" state={isOrder ? state("governorate", ex.governorate) : ""} htmlFor={`${uid}-gov`}>
        <select id={`${uid}-gov`} value={ex.governorate || ""} onChange={(e) => patch({ governorate: e.target.value || null, confidence: { ...conf, governorate: 1 } })}>
          <option value="">اختار المحافظة</option>
          {GOV_NAMES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </Field>

      <Field label="العنوان بالتفصيل" state={isOrder ? state("address", ex.address) : ""} htmlFor={`${uid}-addr`}>
        <textarea id={`${uid}-addr`} rows={2} value={ex.address || ""} maxLength={200} onChange={(e) => patch({ address: e.target.value || null, confidence: { ...conf, address: 1 } })} />
      </Field>

      <fieldset className={`items ${isOrder && (!ex.items?.length || (conf.items ?? 1) < LOW) ? "field-low" : ""}`}>
        <legend>الأصناف</legend>
        {ex.items?.length === 0 && <p className="hint">مفيش أصناف متعرّفة. ضيف صنف.</p>}
        {ex.items?.map((it, i) => {
          const p = store.products.find((x) => x.id === it.productId);
          const prob = problems[i];
          return (
            <div className="item-row" key={i}>
              <div className="item-grid">
                <label className="sr-only" htmlFor={`${uid}-p${i}`}>المنتج</label>
                <select
                  id={`${uid}-p${i}`}
                  value={it.productId}
                  onChange={(e) => {
                    const np = store.products.find((x) => x.id === e.target.value);
                    setItem(i, {
                      productId: np.id,
                      name: np.name,
                      size: np.sizes.length === 1 ? np.sizes[0] : np.sizes.includes(it.size) ? it.size : null,
                      color: np.colors.length === 1 ? np.colors[0] : np.colors.includes(it.color) ? it.color : null,
                    });
                  }}
                >
                  {!p && <option value={it.productId}>{it.name} (اتمسح)</option>}
                  {store.products.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}{x.available ? "" : " (خلصان)"}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`${uid}-s${i}`}>المقاس</label>
                <select id={`${uid}-s${i}`} className={isOrder && !it.size && p?.sizes.length ? "miss" : ""} value={it.size || ""} onChange={(e) => setItem(i, { size: e.target.value || null })}>
                  <option value="">المقاس؟</option>
                  {p?.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="sr-only" htmlFor={`${uid}-c${i}`}>اللون</label>
                <select id={`${uid}-c${i}`} className={isOrder && !it.color && p?.colors.length ? "miss" : ""} value={it.color || ""} onChange={(e) => setItem(i, { color: e.target.value || null })}>
                  <option value="">اللون؟</option>
                  {p?.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="sr-only" htmlFor={`${uid}-q${i}`}>الكمية</label>
                <input
                  id={`${uid}-q${i}`}
                  type="number"
                  min={1}
                  max={20}
                  value={it.qty}
                  onChange={(e) => setItem(i, { qty: Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
                />
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`شيل ${it.name}`} onClick={() => patch({ items: ex.items.filter((_, k) => k !== i) })}>
                  ✕
                </button>
              </div>
              {prob ? (
                <span className="alert alert-warn small" role="status">
                  {prob === "deleted" ? "المنتج ده اتمسح من الإعدادات، السعر مش معروف." : "الصنف ده خلصان دلوقتي. الرد هيعرض بدائل."}
                </span>
              ) : (
                <span className="small muted">{fmtMoney(itemPrice(store, it) * it.qty)}</span>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const p = store.products.find((x) => x.available) || store.products[0];
            if (!p) return;
            patch({
              items: [...(ex.items || []), { productId: p.id, name: p.name, size: p.sizes.length === 1 ? p.sizes[0] : null, color: p.colors.length === 1 ? p.colors[0] : null, qty: 1 }].slice(0, 12),
            });
          }}
          disabled={(ex.items?.length || 0) >= 12 || store.products.length === 0}
        >
          + ضيف صنف
        </button>
      </fieldset>

      <Field label="ملاحظات" htmlFor={`${uid}-notes`}>
        <input id={`${uid}-notes`} value={ex.notes || ""} maxLength={200} onChange={(e) => patch({ notes: e.target.value || null })} />
      </Field>

      <dl className="totals">
        <div><dt>مجموع الأصناف</dt><dd>{fmtMoney(totals.subtotal)}</dd></div>
        <div><dt>الشحن {ex.governorate ? `(${ex.governorate})` : ""}</dt><dd>{ex.governorate ? fmtMoney(totals.shipping) : "—"}</dd></div>
        <div className="grand"><dt>المطلوب عند الاستلام</dt><dd>{fmtMoney(totals.total)}</dd></div>
      </dl>

      {isOrder && ex.missing_fields?.length > 0 && (
        <p className="alert alert-warn small">فاضل: {ex.missing_fields.join("، ")}</p>
      )}

      {added ? (
        <p className="alert alert-ok" role="status">
          اتضاف للبورد، أوردر #{new Intl.NumberFormat("ar-EG").format(Number(added))}. <Link href="/orders">افتح الأوردرات</Link>
        </p>
      ) : (
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={addToBoard} disabled={blockers.length > 0}>
            ضيف للأوردرات
          </button>
          {blockers.length > 0 && <p className="hint">لسه محتاج: {blockers.join("، ")}.</p>}
        </>
      )}
    </div>
  );
}

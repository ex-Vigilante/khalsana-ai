"use client";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { GOV_NAMES } from "@/lib/governorates";
import { validateStore } from "@/lib/order";

const parseList = (s) =>
  s.split(/[,،/\n]+/).map((x) => x.trim()).filter(Boolean);

// Text input for a list: keeps what you type (commas included) and
// only pushes the parsed array up.
function ListInput({ id, label, value, onChange, max, len, hint }) {
  const [text, setText] = useState(value.join("، "));
  useEffect(() => {
    if (JSON.stringify(parseList(text)) !== JSON.stringify(value)) setText(value.join("، "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="field">
      <div className="field-top"><label htmlFor={id}>{label}</label></div>
      <input
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseList(e.target.value).slice(0, max).map((x) => x.slice(0, len)));
        }}
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export default function SettingsView() {
  const { ready, store, setStore, resetStore } = useApp();
  if (!ready) return <p className="loading" role="status">بنحمّل الإعدادات…</p>;

  const check = validateStore(store);
  const setProduct = (id, p) => setStore((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const addProduct = () =>
    setStore((s) => {
      const n = s.products.reduce((m, p) => Math.max(m, Number(String(p.id).replace(/\D/g, "")) || 0), 0) + 1;
      return {
        ...s,
        products: [...s.products, { id: `p${n}`, name: "منتج جديد", aliases: [], price: 100, sizes: ["M", "L"], colors: ["أسود"], available: true }],
      };
    });

  return (
    <div className="page">
      <div className="page-head">
        <h1>الإعدادات</h1>
        <p className="sub">كل تعديل بيتحفظ لوحده في متصفحك. بنبعت الإعدادات دي مع كل طلب AI عشان الاستخراج والردود تمشي على منتجاتك وأسعارك.</p>
      </div>

      {check.error && (
        <p className="alert alert-bad" role="alert">
          {check.error} لحد ما تتصلّح، الاستخراج والردود هيوقفوا.
        </p>
      )}

      <section className="card form-card" aria-labelledby="s-store">
        <h2 id="s-store">المتجر</h2>
        <div className="grid-2">
          <div className="field">
            <div className="field-top"><label htmlFor="sname">اسم المتجر</label></div>
            <input id="sname" value={store.name} maxLength={40} onChange={(e) => setStore((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="field">
            <div className="field-top"><label htmlFor="ssig">توقيع الرد</label></div>
            <input id="ssig" value={store.signature} maxLength={120} onChange={(e) => setStore((s) => ({ ...s, signature: e.target.value }))} />
            <p className="hint">بيتحط في آخر كل رد للزبون.</p>
          </div>
        </div>
      </section>

      <section className="card form-card" aria-labelledby="s-prod">
        <div className="card-head">
          <h2 id="s-prod">المنتجات ({store.products.length})</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={addProduct} disabled={store.products.length >= 40}>+ منتج جديد</button>
        </div>
        <ul className="prod-list">
          {store.products.map((p, i) => (
            <li key={p.id} className="prod">
              <div className="prod-head">
                <strong>{p.name || "منتج من غير اسم"}</strong>
                <span className="muted small" dir="ltr">{p.id}</span>
              </div>
              <div className="grid-3">
                <div className="field">
                  <div className="field-top">
                    <label htmlFor={`pn${i}`}>الاسم</label>
                    {!p.name.trim() && <span className="tag tag-warn">مطلوب</span>}
                  </div>
                  <input id={`pn${i}`} value={p.name} maxLength={60} onChange={(e) => setProduct(p.id, { name: e.target.value })} />
                </div>
                <div className="field">
                  <div className="field-top"><label htmlFor={`pp${i}`}>السعر (ج.م)</label></div>
                  <input id={`pp${i}`} type="number" min={0} max={1000000} value={p.price} onChange={(e) => setProduct(p.id, { price: Math.min(1000000, Math.max(0, Math.round(Number(e.target.value)) || 0)) })} />
                </div>
                <label className="check prod-av">
                  <input type="checkbox" checked={p.available} onChange={(e) => setProduct(p.id, { available: e.target.checked })} />
                  متاح
                </label>
              </div>
              <div className="grid-3">
                <ListInput id={`ps${i}`} label="المقاسات" value={p.sizes} max={12} len={10} onChange={(v) => setProduct(p.id, { sizes: v })} hint="افصل بفاصلة: S, M, L" />
                <ListInput id={`pc${i}`} label="الألوان" value={p.colors} max={12} len={20} onChange={(v) => setProduct(p.id, { colors: v })} hint="مثال: أسود، بيج، كحلي" />
                <ListInput id={`pa${i}`} label="أسماء تانية للمنتج" value={p.aliases} max={8} len={30} onChange={(v) => setProduct(p.id, { aliases: v })} hint="بيستخدمها الاستخراج: طقم، taqm" />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm danger"
                disabled={store.products.length <= 1}
                onClick={() => {
                  if (window.confirm(`تمسح «${p.name}»؟`)) setStore((s) => ({ ...s, products: s.products.filter((x) => x.id !== p.id) }));
                }}
              >
                مسح المنتج
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card form-card" aria-labelledby="s-ship">
        <h2 id="s-ship">الشحن لكل محافظة (ج.م)</h2>
        <p className="hint">الدفع عند الاستلام. السعر بيتجمع على الإجمالي حسب محافظة الزبون.</p>
        <div className="ship-grid">
          {GOV_NAMES.map((g, i) => (
            <div className="field" key={g}>
              <div className="field-top"><label htmlFor={`sh${i}`}>{g}</label></div>
              <input
                id={`sh${i}`}
                type="number"
                min={0}
                max={2000}
                value={store.shipping[g] ?? 0}
                onChange={(e) => setStore((s) => ({ ...s, shipping: { ...s.shipping, [g]: Math.min(2000, Math.max(0, Math.round(Number(e.target.value)) || 0)) } }))}
              />
            </div>
          ))}
        </div>
      </section>

      <p>
        <button
          type="button"
          className="btn btn-ghost danger"
          onClick={() => {
            if (window.confirm("ترجّع إعدادات «بيت الكتان» الأصلية؟ هتتمسح تعديلاتك.")) resetStore();
          }}
        >
          رجّع الإعدادات الأصلية
        </button>
      </p>
    </div>
  );
}

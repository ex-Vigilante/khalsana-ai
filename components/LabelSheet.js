"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { code128Bars } from "@/lib/code128";
import { fmtMoney, fmtNum } from "@/lib/arabic";
import { channelLabel } from "@/lib/samples";

const MAX_LINES = 5;

function Barcode({ value }) {
  const { width, bars } = code128Bars(value);
  return (
    <svg className="barcode" viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" role="img" aria-label={`باركود رقم ${value}`} shapeRendering="crispEdges">
      <rect width={width} height="40" fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="40" fill="#000" />
      ))}
    </svg>
  );
}

// A6 shipping labels. Rendered in a portal on <body>; print CSS hides the app
// and prints only these pages.
export default function LabelSheet({ orders, storeName, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const root = document.getElementById("app-root");
    const prevFocus = document.activeElement;
    if (root) root.inert = true;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (root) root.inert = false;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="label-overlay" role="dialog" aria-modal="true" aria-label="معاينة ليبلات الشحن">
      <div className="label-bar no-print">
        <strong>معاينة الليبلات ({fmtNum(orders.length)})</strong>
        <span className="muted small">مقاس A6. من نافذة الطباعة اختار «بدون هوامش» لو ظهرت.</span>
        <div className="row-gap">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>اطبع</button>
          <button type="button" className="btn btn-ghost" onClick={onClose} ref={closeRef}>قفل</button>
        </div>
      </div>
      <div className="label-sheet">
        {orders.map((o) => (
          <article className="label" key={o.id}>
            <div className="label-in">
            <header className="label-head">
              <span className="label-store">{storeName}</span>
              <span className="label-chan">{channelLabel(o.channel)}</span>
            </header>
            <div className="label-no">
              <span>أوردر</span>
              <strong dir="ltr">#{o.id}</strong>
            </div>
            <Barcode value={o.id} />
            <div className="label-to">
              <div className="label-name">{o.name}</div>
              <div className="label-phone" dir="ltr">{o.phone}</div>
              <div className="label-gov">{o.governorate}</div>
              <div className="label-addr">{o.address}</div>
            </div>
            <ul className="label-items">
              {o.items.slice(0, MAX_LINES).map((it, i) => (
                <li key={i}>
                  {fmtNum(it.qty)} × {it.name}
                  {[it.size, it.color].filter(Boolean).length > 0 && ` (${[it.size, it.color].filter(Boolean).join(" / ")})`}
                </li>
              ))}
              {o.items.length > MAX_LINES && <li>+ {fmtNum(o.items.length - MAX_LINES)} أصناف تانية</li>}
            </ul>
            {o.notes && <p className="label-notes">ملاحظة: {o.notes}</p>}
            <footer className="label-cod">
              <span>المطلوب تحصيله</span>
              <strong>{fmtMoney(o.total)}</strong>
            </footer>
            </div>
          </article>
        ))}
      </div>
    </div>,
    document.body
  );
}

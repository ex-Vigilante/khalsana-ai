"use client";
import { useMemo } from "react";
import { highlightSegments, HL_KINDS } from "@/lib/highlight";

// Shows the original message with the parts the AI picked up marked in the same
// colours as the fields in the order card. Text is rendered as plain React text.
export default function HighlightedMessage({ text, ex, store, showSaved }) {
  const segs = useMemo(() => (ex ? highlightSegments(text, ex, store) : [{ text, kind: null }]), [text, ex, store]);
  const kinds = Object.keys(HL_KINDS).filter((k) => segs.some((s) => s.kind === k));
  return (
    <>
      <p className="bubble" dir="auto">
        {segs.map((s, i) =>
          s.kind ? (
            <mark key={i} className={`hl hl-${s.kind}`} title={HL_KINDS[s.kind]}>{s.text}</mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </p>
      {ex && kinds.length > 0 && (
        <ul className="hl-legend" aria-label="الألوان في الرسالة">
          {kinds.map((k) => (
            <li key={k}><span className={`swatch hl-${k}`} aria-hidden="true" />{HL_KINDS[k]}</li>
          ))}
        </ul>
      )}
      {ex && showSaved && (
        <p className="saved">
          <strong>⏱ وفّرت حوالي ٣ دقايق</strong>
          <span className="muted small">قبل: نسخ وسؤال وحساب شحن بإيدك (≈ ٣ دقايق) ← بعد: ثواني ومراجعة سريعة. تقدير تقريبي.</span>
        </p>
      )}
    </>
  );
}

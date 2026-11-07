"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { streamText, parseReply } from "@/lib/streamClient";
import { validateStore, waNumber } from "@/lib/order";

export default function ReplyPanel({ msg, entry }) {
  const { store, setExtraction } = useApp();
  const [tone, setTone] = useState("friendly");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const abort = useRef(null);
  const reply = entry.reply;

  // stop any running stream when this panel goes away or the order card changes
  useEffect(() => {
    const stop = () => abort.current?.abort();
    return stop;
  }, [entry.ex, msg.id]);
  const phone = entry.ex.phone;
  const wa = waNumber(phone);

  const setReply = (r) => setExtraction(msg.id, (p) => ({ ...p, reply: r }));

  async function write() {
    if (busy) return;
    setErr("");
    setEditing(false);
    const v = validateStore(store);
    if (v.error) {
      setErr(v.error);
      return;
    }
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    let raw = "";
    setReply({ text: "", unavailable: false, interrupted: false });
    try {
      await streamText(
        "/api/reply",
        { message: msg.text, extraction: entry.ex, tone, store: v.value },
        (chunk) => {
          raw += chunk;
          setReply(parseReply(raw));
        },
        ctl.signal
      );
      setReply(parseReply(raw));
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "حصلت مشكلة. جرّب تاني.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const text = reply?.text || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const text = reply?.text || "";
  return (
    <div className="card reply">
      <div className="reply-head">
        <h2>الرد على الزبون</h2>
        <fieldset className="seg">
          <legend className="sr-only">نبرة الرد</legend>
          {[["friendly", "ودود"], ["formal", "رسمي-خفيف"]].map(([id, label]) => (
            <label key={id} className={tone === id ? "on" : ""}>
              <input type="radio" name={`tone-${msg.id}`} checked={tone === id} onChange={() => setTone(id)} />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      <button type="button" className="btn btn-accent" onClick={write} disabled={busy}>
        {busy ? "بنكتب الرد…" : text ? "اكتب الرد تاني" : "اكتب الرد"}
      </button>

      <div className="reply-out" role="status" aria-live="polite" aria-busy={busy} aria-label="نص الرد">
        {editing ? (
          <textarea
            className="reply-edit"
            rows={9}
            value={text}
            dir="auto"
            maxLength={2000}
            aria-label="عدّل نص الرد"
            onChange={(e) => setReply({ ...reply, text: e.target.value })}
          />
        ) : text ? (
          <p dir="auto" className="reply-text">{text}</p>
        ) : (
          <p className="muted">{busy ? "…" : "لسه مفيش رد. اختار النبرة واضغط «اكتب الرد»."}</p>
        )}
      </div>

      {reply?.unavailable && <p className="alert alert-warn small">الـ AI مش متاح دلوقتي، ده رد تجريبي من قالب جاهز.</p>}
      {reply?.interrupted && <p className="alert alert-warn small">الرد اتقطع في النص. اضغط «اكتب الرد تاني».</p>}
      {err && <p className="alert alert-bad small" role="alert">{err}</p>}

      <div className="row-gap">
        <button type="button" className="btn btn-ghost" onClick={copy} disabled={!text || busy}>
          {copied ? "اتنسخ ✓" : "نسخ الرد"}
        </button>
        {wa && text && !busy ? (
          <a className="btn btn-ghost" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            افتح في واتساب
          </a>
        ) : (
          <span className="btn btn-ghost is-disabled" aria-disabled="true" title={wa ? "اكتب الرد الأول" : "محتاج رقم تليفون صحيح في كارت الأوردر"}>
            افتح في واتساب
          </span>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setEditing((v) => !v)} disabled={!text || busy}>
          {editing ? "خلّصت التعديل" : "عدّل الرد"}
        </button>
      </div>
      <span className="sr-only" role="status">{copied ? "اتنسخ الرد" : ""}</span>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { streamText, parseReply } from "@/lib/streamClient";
import { normalizePhone, validateStore, waNumber } from "@/lib/order";
import AiMark from "./AiMark";

export default function ReplyPanel({ msg, entry }) {
  const { store, setExtraction, integrations, setMessageStatus, sendWhatsApp, mode } = useApp();
  const [tone, setTone] = useState("friendly");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const abort = useRef(null);
  const reply = entry.reply;

  // stop any running stream when this panel goes away or the order card changes
  useEffect(() => {
    const stop = () => abort.current?.abort();
    return stop;
  }, [entry.ex, msg.id]);
  const phone = entry.ex.phone;
  const wa = waNumber(phone) || waNumber(normalizePhone(msg.phone));
  // Replies through the official API only work for chats that arrived through it.
  const canSend = Boolean(integrations?.whatsappSend && sendWhatsApp && msg.api && msg.channel === "whatsapp");
  const stale = Date.now() - msg.ts > 24 * 3600 * 1000;

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

  async function send() {
    if (sending || !text) return;
    if (!window.confirm("تبعت الرد ده للزبون على واتساب دلوقتي؟")) return;
    setSending(true);
    setErr("");
    setSent("");
    try {
      await sendWhatsApp(msg.id, text);
      setSent("اتبعت للزبون على واتساب ✓");
    } catch (e) {
      setErr(e.message || "حصلت مشكلة. جرّب تاني.");
    } finally {
      setSending(false);
    }
  }

  async function markReplied() {
    setErr("");
    setSent("");
    try {
      await setMessageStatus(msg.id, "replied", text);
      setSent("اتعلّم إنه اتردّ عليه ✓");
    } catch (e) {
      setErr(e.message || "حصلت مشكلة. جرّب تاني.");
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
        <h2><span className="step-chip" aria-hidden="true">٣</span> الرد على الزبون</h2>
        <AiMark>الـ AI بيكتب</AiMark>
      </div>

      <button type="button" className="btn btn-accent btn-lg" onClick={write} disabled={busy}>
        {busy ? "بنكتب الرد…" : text ? "اكتب الرد تاني" : "اكتب الرد"}
      </button>

      <details className="opts">
        <summary>خيارات: نبرة الرد</summary>
        <fieldset className="seg">
          <legend className="sr-only">نبرة الرد</legend>
          {[["friendly", "ودود"], ["formal", "رسمي-خفيف"]].map(([id, label]) => (
            <label key={id} className={tone === id ? "on" : ""}>
              <input type="radio" name={`tone-${msg.id}`} checked={tone === id} onChange={() => setTone(id)} />
              {label}
            </label>
          ))}
        </fieldset>
      </details>

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
          <p className="muted">{busy ? "…" : "لسه مفيش رد. اضغط «اكتب الرد»."}</p>
        )}
      </div>

      {reply?.unavailable && <p className="alert alert-warn small">الـ AI مش متاح دلوقتي، ده رد تجريبي من قالب جاهز.</p>}
      {reply?.interrupted && <p className="alert alert-warn small">الرد اتقطع في النص. اضغط «اكتب الرد تاني».</p>}
      {err && <p className="alert alert-bad small" role="alert">{err}</p>}
      {sent && <p className="alert alert-ok small" role="status">{sent}</p>}
      {canSend && stale && text && (
        <p className="alert alert-warn small">عدّى أكتر من ٢٤ ساعة على رسالة الزبون. واتساب غالباً هيرفض الإرسال من الـ API، ولو حصل افتح المحادثة في واتساب وردّ منها.</p>
      )}

      <div className="row-gap">
        <button type="button" className="btn btn-ghost" onClick={copy} disabled={!text || busy}>
          {copied ? "اتنسخ ✓" : "نسخ الرد"}
        </button>
        {canSend && (
          <button type="button" className="btn btn-primary" onClick={send} disabled={!text || busy || sending} aria-busy={sending}>
            {sending ? "بنبعت…" : "ابعت على واتساب"}
          </button>
        )}
        {wa && text && !busy ? (
          <a className="btn btn-primary" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
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
        {mode === "prod" && (
          <button type="button" className="btn btn-ghost" onClick={markReplied} disabled={busy || msg.status === "replied"}>
            {msg.status === "replied" ? "اتردّ عليه ✓" : "علّم إنه اتردّ عليه"}
          </button>
        )}
      </div>
      <span className="sr-only" role="status">{copied ? "اتنسخ الرد" : ""}</span>
    </div>
  );
}

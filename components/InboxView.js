"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "./AppProvider";
import OrderCard from "./OrderCard";
import ReplyPanel from "./ReplyPanel";
import AiMark from "./AiMark";
import HighlightedMessage from "./HighlightedMessage";
import { CHANNELS, channelLabel } from "@/lib/samples";
import { validateStore, MAX_MESSAGE } from "@/lib/order";

const INTENT = {
  order: { label: "طلب", cls: "badge-teal" },
  question: { label: "سؤال", cls: "badge-warn" },
  complaint: { label: "شكوى", cls: "badge-bad" },
  other: { label: "تانية", cls: "badge-muted" },
};

const STATUS = {
  new: { label: "جديدة", cls: "badge-teal" },
  extracted: { label: "اتحلّلت", cls: "badge-muted" },
  replied: { label: "اتردّ عليها", cls: "badge-ok" },
  ignored: { label: "متجاهلة", cls: "badge-muted" },
};
const STATUS_FILTERS = [["all", "كل الحالات"], ["new", "جديدة"], ["extracted", "اتحلّلت"], ["replied", "اتردّ عليها"], ["ignored", "متجاهلة"]];

const TABS = [["list", "الرسايل"], ["msg", "١ الرسالة"], ["order", "٢ الأوردر"], ["reply", "٣ الرد"]];

function ago(mins) {
  if (mins < 1) return "دلوقتي";
  if (mins < 60) return `من ${new Intl.NumberFormat("ar-EG").format(Math.round(mins))} د`;
  const h = Math.round(mins / 60);
  return `من ${new Intl.NumberFormat("ar-EG").format(h)} س`;
}

export default function InboxView() {
  const app = useApp();
  const { ready, store, inbox, extractions } = app;
  const prod = app.mode === "prod";
  const fromHome = useSearchParams().get("sample") === "1";
  const [channel, setChannel] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [selId, setSelId] = useState(prod ? "" : "m1");
  const [tab, setTab] = useState(fromHome ? "msg" : "list");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState("");
  const [draftChannel, setDraftChannel] = useState(prod ? "manual" : "whatsapp");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const chanList = prod ? [...CHANNELS, { id: "manual", label: "يدوي" }] : CHANNELS;

  // On a phone, bring the step bar back into view whenever the step changes.
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    const bar = document.querySelector(".pane-tabs");
    if (bar && bar.offsetParent) window.scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + window.scrollY - 60) });
  }, [tab]);

  const source = app.messages;
  const messages = useMemo(() => {
    const now = Date.now();
    return source.map((m) => ({ ...m, minsAgo: Math.max(0, (now - m.ts) / 60000) }));
  }, [source]);

  if (!ready) return <p className="loading" role="status">بنحمّل الرسايل…</p>;

  const list = messages.filter((m) => (channel === "all" || m.channel === channel) && (statusF === "all" || m.status === statusF));
  const msg = messages.find((m) => m.id === selId) || list[0] || messages[0];
  const entry = msg ? extractions[msg.id] : null;
  const counts = Object.fromEntries(chanList.map((c) => [c.id, messages.filter((m) => m.channel === c.id).length]));

  async function extract() {
    if (!msg || busy) return;
    setErr("");
    const v = validateStore(store);
    if (v.error) {
      setErr(v.error);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.text.slice(0, MAX_MESSAGE), store: v.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "حصلت مشكلة في الاستخراج. جرّب تاني.");
      app.setExtraction(msg.id, { ex: data.extraction, source: data.source, unavailable: Boolean(data.unavailable), reply: null });
      app.markProcessed(msg.id);
      setTab("order");
    } catch (e) {
      setErr(e.message || "حصلت مشكلة. جرّب تاني.");
    } finally {
      setBusy(false);
    }
  }

  async function addPasted(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || adding) return;
    setErr("");
    setAdding(true);
    try {
      const m = await app.addManual({
        text: text.slice(0, MAX_MESSAGE),
        name: draftFrom.trim().slice(0, 40),
        phone: draftPhone.trim(),
        channel: draftChannel,
      });
      setDraft("");
      setDraftFrom("");
      setDraftPhone("");
      setSelId(m.id);
      setChannel("all");
      setStatusF("all");
      setTab("msg");
    } catch (e2) {
      setErr(e2.message || "حصلت مشكلة. جرّب تاني.");
    } finally {
      setAdding(false);
    }
  }

  const pick = (id) => {
    setSelId(id);
    setErr("");
    setTab("msg");
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>الرسايل</h1>
        <p className="sub">
          ٣ خطوات: <strong>١</strong> اختار رسالة واضغط «استخرج الأوردر»، <strong>٢</strong> راجع الأوردر، <strong>٣</strong> اكتب الرد.{prod ? " الرسايل بتتحدّث لوحدها." : " كل الرسايل هنا تجريبية ومتخيّلة."}
        </p>
      </div>

      <div className="pane-tabs" role="tablist" aria-label="خطوات الشاشة">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="inbox" data-tab={tab}>
        {/* list */}
        <section className="pane card" data-show={tab === "list"} aria-label="قايمة الرسايل">
          <h2 className="pane-title">اختار رسالة</h2>
          <ul className="msg-list">
            {list.map((m) => {
              const e = extractions[m.id];
              const added = inbox.added[m.id];
              return (
                <li key={m.id}>
                  <button type="button" className="msg-item" aria-current={msg?.id === m.id ? "true" : undefined} onClick={() => pick(m.id)}>
                    <span className="msg-top">
                      <strong>{m.from}</strong>
                      <span className="muted small">{ago(m.minsAgo)}</span>
                    </span>
                    <span className="msg-prev" dir="auto">{m.text}</span>
                    <span className="msg-tags">
                      <span className="badge badge-muted">{channelLabel(m.channel)}</span>
                      {prod && STATUS[m.status] && <span className={`badge ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>}
                      {e && <span className={`badge ${INTENT[e.ex.intent].cls}`}>{INTENT[e.ex.intent].label}</span>}
                      {added && <span className="badge badge-ok">على البورد</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="muted pad">
                {prod && messages.length === 0 ? "مفيش رسايل لسه. الرسايل بتدخل من واتساب لوحدها، أو ضيف رسالة جديدة من تحت." : "مفيش رسايل في الفلتر ده."}
              </li>
            )}
          </ul>

          <details className="opts" open={prod && messages.length === 0 ? true : undefined}>
            <summary>{prod ? "رسالة جديدة وفلاتر" : "خيارات: ضيف رسالتك أو فلتر بالقناة"}</summary>
            <div className="chan-tabs" role="group" aria-label="القناة">
              <button type="button" aria-pressed={channel === "all"} onClick={() => setChannel("all")}>
                الكل <span className="count">{new Intl.NumberFormat("ar-EG").format(messages.length)}</span>
              </button>
              {chanList.map((c) => (
                <button key={c.id} type="button" aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}>
                  {c.label} <span className="count">{new Intl.NumberFormat("ar-EG").format(counts[c.id])}</span>
                </button>
              ))}
            </div>
            {prod && (
              <div className="chan-tabs" role="group" aria-label="الحالة">
                {STATUS_FILTERS.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={statusF === id} onClick={() => setStatusF(id)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <form className="paste" onSubmit={addPasted}>
              <label htmlFor="paste-text">{prod ? "رسالة جديدة: الصق رسالة الزبون" : "الصق رسالة زبون"}</label>
              <textarea
                id="paste-text"
                rows={3}
                maxLength={MAX_MESSAGE}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="الصق هنا رسالة زبون من واتساب أو ماسنجر…"
                dir="auto"
              />
              <div className="row-gap">
                <label className="sr-only" htmlFor="paste-chan">القناة</label>
                <select id="paste-chan" value={draftChannel} onChange={(e) => setDraftChannel(e.target.value)}>
                  {prod && <option value="manual">القناة (اختياري)</option>}
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="paste-from">اسم الزبون</label>
                <input id="paste-from" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} placeholder="اسم الزبون (اختياري)" maxLength={40} />
                {prod && (
                  <>
                    <label className="sr-only" htmlFor="paste-phone">تليفون الزبون</label>
                    <input id="paste-phone" dir="ltr" inputMode="tel" value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} placeholder="تليفون الزبون (اختياري)" maxLength={20} />
                  </>
                )}
              </div>
              {prod && err && <p className="alert alert-bad small" role="alert">{err}</p>}
              <button type="submit" className="btn btn-ghost" disabled={!draft.trim() || adding}>{adding ? "بنضيف…" : "ضيف للرسايل"}</button>
            </form>
          </details>
        </section>

        {/* middle: step 1 (message) and step 3 (reply) */}
        <section className="pane" data-show={tab === "msg" || tab === "reply"} aria-label="الرسالة والرد">
          {msg && (
            <>
              <div className="card msg-view step-msg">
                <div className="msg-head">
                  <div>
                    <h2><span className="step-chip" aria-hidden="true">١</span> الرسالة من {msg.from}</h2>
                    <span className="muted small">{channelLabel(msg.channel)} · {ago(msg.minsAgo)}</span>
                  </div>
                  {entry && <span className={`badge ${INTENT[entry.ex.intent].cls}`}>{INTENT[entry.ex.intent].label}</span>}
                </div>
                <HighlightedMessage text={msg.text} ex={entry?.ex} store={store} showSaved />
                <button type="button" className={`btn btn-lg ${entry ? "btn-ghost" : "btn-primary"}`} onClick={extract} disabled={busy} aria-busy={busy}>
                  {busy ? "الـ AI بيقرا الرسالة…" : entry ? "استخرج تاني" : <>استخرج الأوردر <AiMark /></>}
                </button>
                {entry && (
                  <p className="small muted">
                    {entry.source === "ai" ? "اتحلّلت بالـ AI. الألوان فوق بتوريك أخد إيه من الرسالة." : "اتحلّلت بقواعد الوضع التجريبي. الألوان فوق بتوريك أخد إيه من الرسالة."}
                  </p>
                )}
                <div aria-live="polite" className="msg-status">
                  {err && <p className="alert alert-bad" role="alert">{err}</p>}
                  {entry?.unavailable && (
                    <p className="alert alert-warn">الـ AI مش متاح دلوقتي، فاستخدمنا القواعد الجاهزة بدله. راجع الحقول كويس.</p>
                  )}
                </div>
                {prod && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => app.setMessageStatus(msg.id, msg.status === "ignored" ? "new" : "ignored").catch((e2) => setErr(e2.message))}
                  >
                    {msg.status === "ignored" ? "رجّع الرسالة للجديدة" : "تجاهل الرسالة"}
                  </button>
                )}
                <button type="button" className="btn btn-ghost mobile-next" onClick={() => setTab("list")}>اختار رسالة تانية</button>
                {entry && (
                  <button type="button" className="btn btn-accent btn-lg mobile-next" onClick={() => setTab("order")}>٢ كمّل: راجع الأوردر</button>
                )}
              </div>
              <div className="step-reply">
                {entry ? (
                  <ReplyPanel msg={msg} entry={entry} />
                ) : (
                  <div className="card empty">
                    <h2><span className="step-chip" aria-hidden="true">٣</span> الرد على الزبون</h2>
                    <p>بعد ما تستخرج الأوردر، هنكتبلك هنا رد جاهز للزبون.</p>
                    <button type="button" className="btn btn-ghost mobile-next" onClick={() => setTab("msg")}>ارجع للخطوة ١</button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* right/left column: step 2 (order card) */}
        <section className="pane" data-show={tab === "order"} aria-label="كارت الأوردر">
          {entry ? (
            <OrderCard msg={msg} entry={entry} onNext={() => setTab("reply")} />
          ) : (
            <div className="card empty">
              <h2><span className="step-chip" aria-hidden="true">٢</span> كارت الأوردر</h2>
              <p>اضغط «استخرج الأوردر» وهنملى الاسم والتليفون والمحافظة والأصناف لوحدنا، وانت بس تراجع.</p>
              <p className="muted small">الحقول الناقصة بتتعلّم بلون مختلف عشان تراجعها بسرعة.</p>
              <button type="button" className="btn btn-primary mobile-next" onClick={() => setTab("msg")}>ارجع للخطوة ١</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

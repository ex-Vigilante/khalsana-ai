"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "./AppProvider";
import OrderCard from "./OrderCard";
import ReplyPanel from "./ReplyPanel";
import AiMark from "./AiMark";
import HighlightedMessage from "./HighlightedMessage";
import { CHANNELS, SAMPLE_MESSAGES, channelLabel } from "@/lib/samples";
import { validateStore, MAX_MESSAGE } from "@/lib/order";

const INTENT = {
  order: { label: "طلب", cls: "badge-teal" },
  question: { label: "سؤال", cls: "badge-warn" },
  complaint: { label: "شكوى", cls: "badge-bad" },
  other: { label: "تانية", cls: "badge-muted" },
};

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
  const fromHome = useSearchParams().get("sample") === "1";
  const [channel, setChannel] = useState("all");
  const [selId, setSelId] = useState("m1");
  const [tab, setTab] = useState(fromHome ? "msg" : "list");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState("");
  const [draftChannel, setDraftChannel] = useState("whatsapp");
  const [draftFrom, setDraftFrom] = useState("");

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

  const messages = useMemo(() => {
    const now = Date.now();
    const pasted = inbox.pasted.map((m) => ({ ...m, minsAgo: (now - m.ts) / 60000 }));
    return [...pasted, ...SAMPLE_MESSAGES];
  }, [inbox.pasted]);

  if (!ready) return <p className="loading" role="status">بنحمّل الرسايل…</p>;

  const list = messages.filter((m) => channel === "all" || m.channel === channel);
  const msg = messages.find((m) => m.id === selId) || list[0] || messages[0];
  const entry = msg ? extractions[msg.id] : null;
  const counts = Object.fromEntries(CHANNELS.map((c) => [c.id, messages.filter((m) => m.channel === c.id).length]));

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
        body: JSON.stringify({ message: msg.text, store: v.value }),
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

  function addPasted(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const m = {
      id: "u" + Date.now(),
      channel: draftChannel,
      from: draftFrom.trim().slice(0, 40) || "رسالة ملصوقة",
      ts: Date.now(),
      text: text.slice(0, MAX_MESSAGE),
      pasted: true,
      named: Boolean(draftFrom.trim()),
    };
    app.addPasted(m);
    setDraft("");
    setDraftFrom("");
    setSelId(m.id);
    setChannel("all");
    setTab("msg");
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
          ٣ خطوات: <strong>١</strong> اختار رسالة واضغط «استخرج الأوردر»، <strong>٢</strong> راجع الأوردر، <strong>٣</strong> اكتب الرد. كل الرسايل هنا تجريبية ومتخيّلة.
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
                      {e && <span className={`badge ${INTENT[e.ex.intent].cls}`}>{INTENT[e.ex.intent].label}</span>}
                      {added && <span className="badge badge-ok">على البورد</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="muted pad">مفيش رسايل في القناة دي.</li>}
          </ul>

          <details className="opts">
            <summary>خيارات: ضيف رسالتك أو فلتر بالقناة</summary>
            <div className="chan-tabs" role="group" aria-label="القناة">
              <button type="button" aria-pressed={channel === "all"} onClick={() => setChannel("all")}>
                الكل <span className="count">{new Intl.NumberFormat("ar-EG").format(messages.length)}</span>
              </button>
              {CHANNELS.map((c) => (
                <button key={c.id} type="button" aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}>
                  {c.label} <span className="count">{new Intl.NumberFormat("ar-EG").format(counts[c.id])}</span>
                </button>
              ))}
            </div>
            <form className="paste" onSubmit={addPasted}>
              <label htmlFor="paste-text">الصق رسالة زبون</label>
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
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="paste-from">اسم الزبون</label>
                <input id="paste-from" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} placeholder="اسم الزبون (اختياري)" maxLength={40} />
              </div>
              <button type="submit" className="btn btn-ghost" disabled={!draft.trim()}>ضيف للرسايل</button>
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

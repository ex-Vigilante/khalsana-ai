"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "./AppProvider";
import { channelLabel } from "@/lib/samples";
import { fmtMoney, fmtNum } from "@/lib/arabic";

const BarChart = dynamic(() => import("./Charts"), {
  ssr: false,
  loading: () => <p className="muted small pad" role="status">بنحمّل الرسم…</p>,
});

const MIN_PER_MESSAGE = 3;

function tally(entries, take = 8) {
  const m = new Map();
  for (const [k, v] of entries) m.set(k, (m.get(k) || 0) + v);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, take);
}

function ChartCard({ title, rows, theme, horizontal = true, color, unit, note }) {
  const labels = rows.map((r) => r[0]);
  const values = rows.map((r) => r[1]);
  return (
    <figure className="card chart-card">
      <figcaption>
        <h2>{title}</h2>
        {note && <span className="muted small">{note}</span>}
      </figcaption>
      {rows.length === 0 ? (
        <p className="muted pad">مفيش بيانات لسه.</p>
      ) : (
        <>
          <div className="chart-box" style={{ height: horizontal ? Math.max(180, rows.length * 34 + 40) : 240 }} role="img" aria-label={`${title}: ${rows.map((r) => `${r[0]} ${fmtNum(r[1])}`).join("، ")}`}>
            <BarChart labels={labels} values={values} theme={theme} horizontal={horizontal} color={color} unit={unit} />
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}><th scope="row">{r[0]}</th><td>{fmtNum(r[1])}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

export default function Analytics() {
  const { ready, orders, messagesProcessed, theme, store, mode, base } = useApp();

  const k = useMemo(() => {
    const today = new Date().toDateString();
    const cutoff = Date.now() - 14 * 86400000;
    const recent = orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
    const todays = recent.filter((o) => new Date(o.createdAt).toDateString() === today);
    const open = orders.filter((o) => ["new", "confirmed", "shipped"].includes(o.status));
    const cod = open.reduce((s, o) => s + o.total, 0);
    const govs = tally(recent.map((o) => [o.governorate, 1]));
    const prods = tally(recent.flatMap((o) => o.items.map((i) => [i.name, i.qty])), 6);
    const chans = tally(recent.map((o) => [channelLabel(o.channel), 1]), 3);
    return { todays: todays.length, cod, openCount: open.length, govs, prods, chans, recentCount: recent.length };
  }, [orders]);

  if (!ready) return <p className="loading" role="status">بنحمّل الأرقام…</p>;

  const mins = messagesProcessed * MIN_PER_MESSAGE;
  const hours = mins / 60;
  const topGov = k.govs[0];

  return (
    <div className="page">
      <div className="page-head">
        <h1>أرقام المتجر</h1>
        <p className="sub">
          {mode === "prod" ? (
            <>أرقام «{store.name}» آخر ١٤ يوم، محسوبة من أوردراتك الحقيقية. <Link href="/inbox">كل أوردر جديد بتضيفه</Link> بيظهر هنا.</>
          ) : (
            <>أرقام «{store.name}» آخر ١٤ يوم. البيانات تجريبية ومحفوظة في متصفحك، و<Link href={base || "/inbox"}>كل أوردر جديد بتضيفه</Link> بيظهر هنا.</>
          )}
        </p>
      </div>

      <div className="kpis">
        <div className="kpi card">
          <span className="kpi-l">أوردرات النهاردة</span>
          <strong className="kpi-v">{fmtNum(k.todays)}</strong>
          <span className="kpi-n muted small">من {fmtNum(k.recentCount)} أوردر آخر ١٤ يوم</span>
        </div>
        <div className="kpi card">
          <span className="kpi-l">فلوس الدفع عند الاستلام</span>
          <strong className="kpi-v">{fmtMoney(k.cod)}</strong>
          <span className="kpi-n muted small">{fmtNum(k.openCount)} أوردر لسه ماتسلّمش (من كل الأوردرات)</span>
        </div>
        <div className="kpi card">
          <span className="kpi-l">أكتر محافظة</span>
          <strong className="kpi-v">{topGov ? topGov[0] : "—"}</strong>
          <span className="kpi-n muted small">{topGov ? `${fmtNum(topGov[1])} أوردر` : "مفيش أوردرات"}</span>
        </div>
        <div className="kpi card kpi-accent">
          <span className="kpi-l">وقت اتوفّر (تقدير)</span>
          <strong className="kpi-v">{hours >= 1 ? `${fmtNum(Math.round(hours * 10) / 10)} ساعة` : `${fmtNum(mins)} دقيقة`}</strong>
          <span className="kpi-n small">
            {fmtNum(messagesProcessed)} رسالة × {fmtNum(MIN_PER_MESSAGE)} دقايق. ده تقدير مش قياس فعلي.
          </span>
        </div>
      </div>

      <div className="charts">
        <ChartCard title="الأوردرات حسب المحافظة" rows={k.govs} theme={theme} note="أعلى ٨ محافظات" />
        <ChartCard title="أكتر المنتجات طلباً" rows={k.prods} theme={theme} color="--orange-bar" unit=" قطعة" note="بعدد القطع" />
        <ChartCard title="الأوردرات حسب القناة" rows={k.chans} theme={theme} horizontal={false} color="--ink-bar" />
      </div>
    </div>
  );
}

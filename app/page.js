import Link from "next/link";
import AiMark from "@/components/AiMark";
import { SAMPLE_MESSAGES } from "@/lib/samples";

const STEPS = [
  { n: "١", t: "رسالة", d: "الزبون يبعتلك طلبه زي ما هو، بغلطاته وأرقامه العربي.", ai: false },
  { n: "٢", t: "أوردر", d: "الـ AI يقرا الرسالة ويملى الاسم والتليفون والمحافظة والعنوان والأصناف. وانت بس تراجع.", ai: true },
  { n: "٣", t: "رد وشحن", d: "رد جاهز بالعامية للزبون، وبعدها الأوردر على البورد وليبل الشحن جاهز للطباعة.", ai: true },
];

export default function Home() {
  const sample = SAMPLE_MESSAGES[0];
  return (
    <div className="page home">
      <section className="hero" aria-labelledby="hero-h">
        <h1 id="hero-h">رسايل الزباين تدخل… والأوردرات تطلع خلّصانة.</h1>
        <p className="hero-sub">
          للبياعين الأونلاين: الصق رسالة الزبون من واتساب أو ماسنجر أو إنستجرام، والـ AI يطلّعلك الأوردر كامل ورد جاهز وليبل شحن.
        </p>
        <div className="hero-cta">
          <Link href="/inbox?sample=1" className="btn btn-primary btn-xl">جرّب على رسالة حقيقية</Link>
          <span className="muted small">من غير تسجيل. الرسايل والبيانات تجريبية.</span>
        </div>
        <figure className="hero-sample">
          <figcaption className="small muted">مثال لرسالة زبون، هتجرّبها بنفسك:</figcaption>
          <blockquote className="bubble" dir="auto">{sample.text}</blockquote>
        </figure>
      </section>

      <section aria-labelledby="how-h" className="how">
        <h2 id="how-h">بتشتغل إزاي في ٣ خطوات</h2>
        <ol className="how-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="card">
              <span className="step-n" aria-hidden="true">{s.n}</span>
              <div>
                <h3>{s.t} {s.ai && <AiMark />}</h3>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="home-links">
        <Link href="/dashboard">شوف أرقام المتجر</Link>
        <Link href="/orders">الأوردرات</Link>
        <Link href="/about">عن خلّصانة</Link>
      </p>
    </div>
  );
}

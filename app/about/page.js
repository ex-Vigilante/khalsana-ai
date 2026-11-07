import Link from "next/link";

export const metadata = { title: "عن خلّصانة" };

const STEPS = [
  { t: "الصق أو استقبل الرسالة", d: "الرسايل بتوصل من واتساب وماسنجر وإنستجرام زي ما هي: غلطات إملائية، أرقام عربي، وكلام مخلوط." },
  { t: "استخرج الأوردر", d: "الاسم، التليفون المظبوط، المحافظة، العنوان والأصناف بمقاساتها وألوانها. اللي ناقص أو مش واضح بيتعلّم عليك تراجعه." },
  { t: "ردّ وشحّن", d: "رد جاهز بالعامية فيه الملخص والإجمالي عند الاستلام، وبعدها الأوردر ينزل على البورد وتطبع الليبل وتصدّر CSV." },
];

const PLANS = [
  { n: "بداية", p: "٢٩٩", d: "لحد ٣٠٠ رسالة في الشهر، مستخدم واحد" },
  { n: "تاجر", p: "٥٩٩", d: "لحد ١٥٠٠ رسالة في الشهر، ٣ مستخدمين" },
  { n: "براند", p: "١٢٩٩", d: "لحد ٦٠٠٠ رسالة في الشهر، ١٠ مستخدمين" },
];

export default function About() {
  return (
    <div className="page prose">
      <div className="page-head">
        <h1>خلّصانة</h1>
        <p className="lead">رسايل الزباين تدخل… والأوردرات تطلع خلّصانة.</p>
        <p className="muted small" dir="ltr" lang="en">Customer messages in. Orders out — sorted.</p>
        <p>
          <Link className="btn btn-primary" href="/try?sample=1">جرّب على رسايل «بيت الكتان»</Link>
        </p>
      </div>

      <section aria-labelledby="a-problem" className="card">
        <h2 id="a-problem">المشكلة</h2>
        <p>
          البياع الصغير اللي بيشتغل أونلاين (هدوم، كوزمتكس، حاجات بيت) بيستقبل الأوردرات رسايل مبعثرة:
          «عايزة الطقم الاسود مقاس L واحد و٢ من البيج M، العنوان مدينة نصر الحي السابع عمارة ١٢». حد لازم ينقلها في شيت بإيده،
          يسأل الزبون على الناقص، يحسب الشحن لكل محافظة، ويطبع الليبلات. شغل متكرر ومليان أخطاء، وبياخد من وقت اليوم.
        </p>
      </section>

      <section aria-labelledby="a-ba" className="card">
        <h2 id="a-ba">قبل وبعد</h2>
        <div className="ba">
          <div>
            <h3>الشغل اليدوي</h3>
            <p className="big">≈ ٣ دقايق للرسالة</p>
            <ul>
              <li>قراءة الرسالة ونسخ البيانات في الشيت</li>
              <li>مراسلة الزبون للناقص</li>
              <li>حساب الشحن والإجمالي بالآلة الحاسبة</li>
              <li>كتابة الليبل بإيدك</li>
            </ul>
          </div>
          <div>
            <h3>مع خلّصانة</h3>
            <p className="big">ثواني ومراجعة سريعة</p>
            <ul>
              <li>ضغطة واحدة تستخرج الأوردر</li>
              <li>الناقص متعلّم والرد جاهز</li>
              <li>الشحن والإجمالي بيتحسبوا لوحدهم</li>
              <li>ليبلات A6 بباركود وCSV لإكسل</li>
            </ul>
          </div>
        </div>
        <p className="muted small">الـ ٣ دقايق تقدير تقريبي بنستخدمه في عداد «وقت اتوفّر»، مش قياس على متجر حقيقي.</p>
      </section>

      <section aria-labelledby="a-how" className="card">
        <h2 id="a-how">بتشتغل إزاي</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="step-n" aria-hidden="true">{["١", "٢", "٣"][i]}</span>
              <div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="a-priv" className="card">
        <h2 id="a-priv">الخصوصية</h2>
        <ul>
          <li>مفتاح الذكاء الاصطناعي موجود على السيرفر بس، ومش بيوصل للمتصفح.</li>
          <li>في التجربة المفتوحة: بيانات المتجر والأوردرات والإعدادات محفوظة في متصفحك أنت بس.</li>
          <li>في الاستخدام الحقيقي: البيانات في قاعدة بيانات المتجر نفسه (Supabase)، والدخول لفريق المتجر بس بحسابات بيعملها صاحب المتجر.</li>
          <li>الرسالة بتتبعت للـ AI وقت الاستخراج أو كتابة الرد بس.</li>
          <li>من غير مفتاح، التطبيق بيشتغل «وضع تجريبي» بقواعد جاهزة ومفيش حاجة بتخرج من جهازك.</li>
        </ul>
      </section>

      <section aria-labelledby="a-price" className="card">
        <h2 id="a-price">أسعار مثال</h2>
        <p className="alert alert-warn small">أسعار مثال للعرض فقط، المشروع ده نموذج تجريبي وملوش باقات حقيقية.</p>
        <ul className="plans">
          {PLANS.map((p) => (
            <li key={p.n}>
              <h3>{p.n}</h3>
              <p className="price">{p.p} <span>ج.م / شهر</span></p>
              <p className="muted small">{p.d}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

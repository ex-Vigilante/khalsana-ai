export const metadata = { title: "سياسة الخصوصية" };

export default function Privacy() {
  return (
    <div className="page prose">
      <div className="page-head">
        <h1>سياسة الخصوصية</h1>
        <p className="muted small">آخر تحديث: نوفمبر ٢٠٢٦</p>
      </div>

      <section className="card" aria-labelledby="p-what">
        <h2 id="p-what">البيانات اللي بنتعامل معاها</h2>
        <p>
          خلّصانة أداة لفريق المتجر. لما المتجر يربط رقم واتساب بيزنس، بنستقبل رسايل الزباين اللي بيبعتوها للرقم ده
          (نص الرسالة، اسم الزبون الظاهر على واتساب، ورقم تليفونه) عشان نطلّع منها بيانات الأوردر: الاسم، التليفون، المحافظة،
          العنوان والأصناف. وبنحفظ الردود اللي فريق المتجر بيبعتها.
        </p>
      </section>

      <section className="card" aria-labelledby="p-use">
        <h2 id="p-use">بنستخدمها في إيه</h2>
        <ul>
          <li>تجهيز الأوردر والرد على الزبون وطباعة ليبل الشحن، وبس.</li>
          <li>نص الرسالة بيتبعت لخدمة ذكاء اصطناعي عشان تطلّع منه الأوردر، ومش بيُستخدم في أي إعلانات أو تدريب.</li>
          <li>مش بنبيع البيانات ولا بنشاركها مع أي طرف تالت غير مزوّدي الخدمة اللازمين للتشغيل (الاستضافة وقاعدة البيانات وواتساب).</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="p-access">
        <h2 id="p-access">مين يقدر يشوفها</h2>
        <p>
          بس أعضاء فريق المتجر اللي صاحب المتجر ضافهم، بعد تسجيل الدخول. البيانات محمية بصلاحيات على مستوى قاعدة البيانات.
        </p>
      </section>

      <section className="card" id="data-deletion" aria-labelledby="p-delete">
        <h2 id="p-delete">طلب حذف البيانات</h2>
        <p>
          لو انت زبون وعايز بياناتك تتمسح، ابعت للمتجر على نفس رقم الواتساب رسالة فيها «امسح بياناتي»، أو ابعت إيميل لصاحب
          المتجر. فريق المتجر بيمسح رسايلك وأوردراتك من النظام خلال ٣٠ يوم. وصاحب المتجر يقدر يمسح أي رسالة أو أوردر في أي وقت
          من داخل خلّصانة.
        </p>
      </section>

      <section className="card" lang="en" dir="ltr" aria-labelledby="p-en">
        <h2 id="p-en">Privacy policy (English)</h2>
        <p>
          Khalsana is a workspace for an online shop&apos;s team. When the shop connects a WhatsApp Business number, Khalsana
          receives the messages customers send to that number (message text, WhatsApp display name and phone number) and uses
          them only to prepare orders, reply to the customer and print shipping labels. Message text is sent to an AI service to
          extract the order; it is not used for advertising or model training. Data is never sold, and is shared only with the
          providers needed to run the service (hosting, database, WhatsApp). Only team members added by the shop owner can sign
          in and see it.
        </p>
        <p>
          <strong>Data deletion:</strong> customers can ask for their data to be deleted by sending &ldquo;delete my data&rdquo;
          to the shop&apos;s WhatsApp number or by emailing the shop owner. The shop deletes the customer&apos;s messages and
          orders within 30 days. The shop owner can delete any message or order at any time inside Khalsana.
        </p>
      </section>
    </div>
  );
}

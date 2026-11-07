import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { PROD_CONFIGURED } from "@/lib/mode";

export const metadata = { title: "دخول فريق المتجر" };

export default async function Page({ searchParams }) {
  const { next } = await searchParams;
  return (
    <div className="page">
      <div className="page-head">
        <h1>دخول فريق المتجر</h1>
        <p className="sub">للشغل الحقيقي: الرسايل والأوردرات الفعلية للمتجر.</p>
      </div>
      {PROD_CONFIGURED ? (
        <LoginForm next={typeof next === "string" ? next : ""} />
      ) : (
        <div className="card auth-card">
          <p>الدخول مش متفعّل على النسخة دي، لكن التجربة مفتوحة للكل.</p>
          <Link className="btn btn-primary" href="/try">جرّب خلّصانة</Link>
        </div>
      )}
    </div>
  );
}

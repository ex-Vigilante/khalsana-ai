import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import Unavailable from "@/components/Unavailable";

export const metadata = { title: "مفيش صلاحية" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const a = await getAccess();
  if (a.state === "anon") redirect("/login");
  if (a.state === "error") return <Unavailable />;
  return (
    <div className="page">
      <div className="card auth-card">
        <h1>حسابك مش ضمن فريق المتجر</h1>
        <p>
          {a.email ? <>الإيميل <strong dir="ltr">{a.email}</strong> مش مضاف في فريق المتجر.</> : "لازم تسجّل دخول بحساب من الفريق."}
          {" "}اطلب من صاحب المتجر يضيفك، أو ادخل بحساب تاني.
        </p>
        <div className="row-gap">
          <LogoutButton />
          <Link className="btn btn-ghost" href="/try">جرّب النسخة التجريبية</Link>
        </div>
      </div>
    </div>
  );
}

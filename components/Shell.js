"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";
import { PROD_CONFIGURED, isSandboxPath, isWorkspacePath } from "@/lib/mode";

// Workspace pages live at /inbox, /orders…; the public sandbox mirrors them under /try.
const workNav = (b) => [
  { href: "/", label: "الرئيسية" },
  { href: b || "/inbox", label: "الرسايل", exact: Boolean(b) },
  { href: b + "/orders", label: "الأوردرات" },
  { href: b + "/dashboard", label: "الأرقام" },
  { href: b + "/settings", label: "الإعدادات" },
];
const PUBLIC_NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/try", label: "جرّب" },
  { href: "/login", label: "دخول فريق المتجر" },
];

async function logout() {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
  } catch {}
  window.location.href = "/login";
}

export function AiBadge() {
  const { live } = useApp();
  if (live === null) return <span className="badge badge-muted">...</span>;
  return (
    <span
      className={`badge ${live ? "badge-ok" : "badge-warn"}`}
      title={live ? "الذكاء الاصطناعي متوصّل من السيرفر" : "مفيش مفتاح AI: الاستخراج والردود بقواعد جاهزة"}
    >
      <span className="dot" aria-hidden="true" />
      {live ? "AI شغّال" : "وضع تجريبي"}
    </span>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useApp();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "ارجع للوضع الفاتح" : "فعّل الوضع الداكن"}
      title={dark ? "وضع فاتح" : "وضع داكن"}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export default function Shell({ children }) {
  const path = usePathname() || "/";
  const { mode, notice, clearNotice, user } = useApp();
  const sandbox = isSandboxPath(path);
  const nav = PROD_CONFIGURED && !sandbox && !isWorkspacePath(path) ? PUBLIC_NAV : workNav(sandbox ? "/try" : "");
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" className="wordmark" aria-label="خلّصانة - الصفحة الرئيسية">
            خلّصانة
          </Link>
          <nav className="nav" aria-label="التنقل الرئيسي">
            {nav.map((n) => {
              const current = n.href === "/" || n.exact ? path === n.href : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={current ? "page" : undefined}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="top-tools">
            <AiBadge />
            <ThemeToggle />
            {mode === "prod" && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout} title={user?.email || ""}>
                خروج
              </button>
            )}
          </div>
        </div>
      </header>
      {sandbox && (
        <p className="sandbox-bar" role="note">
          تجربة — بيانات تجريبية. <Link href="/">الرئيسية</Link>
        </p>
      )}
      <main id="main" tabIndex={-1} className="main">
        {notice && (
          <p className="alert alert-bad notice" role="alert">
            {notice} <button type="button" className="link-btn" onClick={clearNotice}>إخفاء</button>
          </p>
        )}
        {children}
      </main>
    </>
  );
}

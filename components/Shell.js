"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

const NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/inbox", label: "الرسايل" },
  { href: "/orders", label: "الأوردرات" },
  { href: "/dashboard", label: "الأرقام" },
  { href: "/settings", label: "الإعدادات" },
];

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
  const path = usePathname();
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" className="wordmark" aria-label="خلّصانة - الصفحة الرئيسية">
            خلّصانة
          </Link>
          <nav className="nav" aria-label="التنقل الرئيسي">
            {NAV.map((n) => {
              const current = n.href === "/" ? path === "/" : path.startsWith(n.href);
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
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="main">
        {children}
      </main>
    </>
  );
}

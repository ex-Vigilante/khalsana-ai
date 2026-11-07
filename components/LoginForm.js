"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Only same-site workspace paths are allowed as the post-login target.
const safeNext = (n) => (typeof n === "string" && /^\/(inbox|orders|dashboard|settings)(\/|\?|$)/.test(n) ? n : "/inbox");

export default function LoginForm({ next }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const wrong = error.code === "invalid_credentials" || error.status === 400;
        setErr(wrong ? "الإيميل أو الباسورد غلط. راجعهم وجرّب تاني." : "مقدرناش نوصل لقاعدة البيانات دلوقتي. جرّب بعد شوية.");
        setBusy(false);
        return;
      }
      window.location.href = safeNext(next); // full load so the server sees the new session cookie
    } catch {
      setErr("مقدرناش نوصل للسيرفر. تأكد من النت وجرّب تاني.");
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <div className="field">
        <div className="field-top"><label htmlFor="login-email">الإيميل</label></div>
        <input id="login-email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <div className="field-top"><label htmlFor="login-pass">الباسورد</label></div>
        <input id="login-pass" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {err && <p className="alert alert-bad small" role="alert">{err}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !email || !password} aria-busy={busy}>
        {busy ? "بندخّلك…" : "دخول"}
      </button>
      <p className="hint">الحسابات بيعملها صاحب المتجر. مفيش تسجيل جديد من هنا.</p>
    </form>
  );
}

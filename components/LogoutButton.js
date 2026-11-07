"use client";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={async () => {
        try {
          await createClient().auth.signOut();
        } catch {}
        window.location.href = "/login";
      }}
    >
      تسجيل خروج
    </button>
  );
}

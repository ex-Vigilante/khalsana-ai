"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Theme + public status flags, shared by the sandbox and the real workspace.
export function useCommon() {
  const [live, setLive] = useState(null);
  const [status, setStatus] = useState(null);
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        setLive(Boolean(d.live));
        setStatus(d);
      })
      .catch(() => setLive(false));
  }, []);

  const setTheme = useCallback((t) => {
    document.documentElement.dataset.theme = t;
    setThemeState(t);
    try {
      localStorage.setItem("khalsana.theme", t);
    } catch {}
  }, []);

  return { live, status, theme, setTheme };
}

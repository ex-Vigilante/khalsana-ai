"use client";
import { usePathname } from "next/navigation";
import { PROD_CONFIGURED, isSandboxPath, isWorkspacePath } from "@/lib/mode";
import SandboxProvider, { DEMO_PROCESSED_BASE } from "./SandboxProvider";
import ProdProvider from "./ProdProvider";

export { useApp } from "./appContext";
export { DEMO_PROCESSED_BASE };

// Picks the data source. The real workspace (Supabase) only runs on the workspace routes when
// production mode is configured; everything else, including /try, is the localStorage sandbox.
export default function AppProvider({ children }) {
  const path = usePathname() || "/";
  if (PROD_CONFIGURED && isWorkspacePath(path)) return <ProdProvider key="prod">{children}</ProdProvider>;
  return (
    <SandboxProvider key="sandbox" base={isSandboxPath(path) ? "/try" : ""}>
      {children}
    </SandboxProvider>
  );
}

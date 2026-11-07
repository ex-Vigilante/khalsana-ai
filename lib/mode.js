// Decides between production mode (Supabase) and the public sandbox.
// NEXT_PUBLIC_* values are inlined at build time, so these literals must stay as written.
// The anon key and URL are public by design; every table is protected by Row Level Security.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const PROD_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Routes that need a signed-in team member when production mode is on.
export const WORKSPACE_PATHS = ["/inbox", "/orders", "/dashboard", "/settings"];
export const isWorkspacePath = (p) => WORKSPACE_PATHS.some((w) => p === w || p.startsWith(w + "/"));
export const isSandboxPath = (p) => p === "/try" || p.startsWith("/try/");

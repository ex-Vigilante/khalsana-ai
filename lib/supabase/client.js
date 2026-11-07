"use client";
// Browser client: used only for sign-in and sign-out. Data goes through our API routes.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/mode";

export const createClient = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

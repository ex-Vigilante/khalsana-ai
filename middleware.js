import { NextResponse } from "next/server";
import { PROD_CONFIGURED } from "@/lib/mode";
import { updateSession } from "@/lib/supabase/middleware";

// Production mode only. Without Supabase env vars the app is the public sandbox and this does nothing.
export async function middleware(request) {
  if (!PROD_CONFIGURED) return NextResponse.next();
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/login" && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/inbox/:path*", "/orders/:path*", "/dashboard/:path*", "/settings/:path*", "/login"],
};

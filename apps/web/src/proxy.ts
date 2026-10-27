import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readServerPublicEnv } from "@/lib/supabase/env";

// Refreshes the Supabase session cookie on every page, and does an optimistic sign-in check for the admin.
// Real authorization happens in requireOwner() and in row-level security.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Not configured yet (fresh deploy): serve pages that don't need Supabase rather than failing all of them.
  const { supabaseUrl: url, supabasePublishableKey: key } = readServerPublicEnv();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !data?.claims && pathname !== "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Every page except static files, images and webhooks (which don't use sessions).
  matcher: ["/((?!_next/static|_next/image|api/webhooks|runtime-env|favicon.ico|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

import { NextResponse, type NextRequest } from "next/server";
import { ensureCustomer } from "@/lib/customer";
import { DEFAULT_STORE_SLUG, listStores, storePath } from "@/lib/stores";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Facebook sends the customer back here with a one-time code; exchange it for a session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const slug = url.searchParams.get("store") ?? DEFAULT_STORE_SLUG;
  const store = (await listStores()).find((s) => s.slug === slug) ?? null;
  const fallback = storePath(store?.slug ?? DEFAULT_STORE_SLUG, "/account");
  const nextParam = url.searchParams.get("next") ?? fallback;
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : fallback;

  if (code && store) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // The customer profile belongs to the store they signed in from.
      await ensureCustomer(data.user, store.id);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(
    new URL(storePath(store?.slug ?? DEFAULT_STORE_SLUG, `/login?error=facebook&next=${encodeURIComponent(next)}`), url.origin),
  );
}

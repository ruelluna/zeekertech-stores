import { NextResponse, type NextRequest } from "next/server";
import { ensureCustomer } from "@/lib/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Facebook sends the customer back here with a one-time code; exchange it for a session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureCustomer(data.user);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/login?error=facebook&next=${encodeURIComponent(next)}`, url.origin));
}

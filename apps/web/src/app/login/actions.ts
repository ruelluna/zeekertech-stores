"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionState } from "@/lib/action-state";
import { ensureCustomer } from "@/lib/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Only allow redirects back into the site. */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export async function signInWithFacebook(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const site = process.env.SITE_URL ?? "http://localhost:3100";
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: { redirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`, scopes: "email,public_profile" },
  });
  if (error || !data.url) redirect(`/login?error=facebook&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

const DevLogin = z.object({ email: z.email(), password: z.string().min(1), next: z.string().optional() });

/** Email + password sign-in for local testing only (Facebook needs a Meta app). Disabled in production. */
export async function devSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (process.env.NODE_ENV === "production") return fail("Not available");
  const parsed = DevLogin.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Enter an email and password");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return fail("Wrong email or password");
  await ensureCustomer(data.user);
  redirect(safeNext(parsed.data.next));
}

export async function customerSignOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionState } from "@/lib/action-state";
import { ensureCustomer } from "@/lib/customer";
import { DEFAULT_STORE_SLUG, listStores, storePath } from "@/lib/stores";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The active store named by the form's "store" field (Weekend Food Hub if missing). */
async function formStore(formData: FormData) {
  const slug = String(formData.get("store") ?? DEFAULT_STORE_SLUG);
  return (await listStores()).find((s) => s.slug === slug && s.active) ?? null;
}

/** Only allow redirects back into the site. */
function safeNext(next: unknown, slug: string): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : storePath(slug, "/account");
}

export async function signInWithFacebook(formData: FormData) {
  const store = await formStore(formData);
  if (!store) redirect("/");
  const supabase = await createSupabaseServerClient();
  const site = process.env.SITE_URL ?? "http://localhost:3100";
  const next = safeNext(formData.get("next"), store.slug);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${site}/auth/callback?store=${store.slug}&next=${encodeURIComponent(next)}`,
      scopes: "email,public_profile",
    },
  });
  if (error || !data.url) redirect(storePath(store.slug, `/login?error=facebook&next=${encodeURIComponent(next)}`));
  redirect(data.url);
}

const DevLogin = z.object({ email: z.email(), password: z.string().min(1), next: z.string().optional(), store: z.string().optional() });

/** Email + password sign-in for local testing only (Facebook needs a Meta app). Disabled in production. */
export async function devSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (process.env.NODE_ENV === "production") return fail("Not available");
  const parsed = DevLogin.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Enter an email and password");

  const store = await formStore(formData);
  if (!store) return fail("Unknown store");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return fail("Wrong email or password");
  await ensureCustomer(data.user, store.id);
  redirect(safeNext(parsed.data.next, store.slug));
}

export async function customerSignOut(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const store = await formStore(formData);
  redirect(storePath(store?.slug ?? DEFAULT_STORE_SLUG));
}

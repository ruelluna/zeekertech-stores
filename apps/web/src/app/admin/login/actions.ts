"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionState } from "@/lib/action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LoginInput = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Enter your email and password.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return fail("Wrong email or password.");

  // Only allow redirects within the admin.
  const next = parsed.data.next?.startsWith("/admin") ? parsed.data.next : "/admin";
  redirect(next);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

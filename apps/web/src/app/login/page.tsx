import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { devSignIn, signInWithFacebook } from "./actions";
import { readServerPublicEnv } from "@/lib/supabase/env";

export const metadata = { title: "Log in · Weekend Food Hub" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h1 className="text-xl font-semibold">Log in to Weekend Food Hub</h1>
        <p className="mb-5 mt-1 text-sm text-stone-600 dark:text-stone-400">
          Save your details and addresses, see your orders, and get a welcome discount on your first order.
        </p>
        <Suspense>
          <LoginOptions searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-xs text-stone-500">
          By logging in you agree to our <Link href="/privacy" className="underline">privacy notice</Link>. You can also order as a guest.
        </p>
      </div>
    </main>
  );
}

async function LoginOptions({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/account";
  const facebook = readServerPublicEnv().facebookLogin;
  const dev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex flex-col gap-5">
      {params.error === "facebook" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Facebook login didn&apos;t work. Please try again.</p>
      )}
      {facebook ? (
        <form action={signInWithFacebook}>
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="w-full rounded-lg bg-[#1877F2] px-4 py-2.5 font-medium text-white hover:bg-[#166fe0]">
            Continue with Facebook
          </button>
        </form>
      ) : (
        <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">Facebook login is coming soon.</p>
      )}

      {dev && (
        <div className="border-t border-dashed border-stone-300 pt-4 dark:border-stone-700">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-500">Local testing only</p>
          <ActionForm action={devSignIn} submitLabel="Sign in as test customer">
            <input type="hidden" name="next" value={next} />
            <Field label="Email">
              <Input name="email" type="email" defaultValue="customer@wfh.test" />
            </Field>
            <Field label="Password" hint="DEV_CUSTOMER_PASSWORD in apps/web/.env.local">
              <Input name="password" type="password" />
            </Field>
          </ActionForm>
        </div>
      )}
    </div>
  );
}

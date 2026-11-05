import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { devSignIn, signInWithFacebook } from "./actions";
import { readServerPublicEnv } from "@/lib/supabase/env";
import type { Metadata } from "next";
import { getStore, storePath } from "@/lib/stores";
import { StoreHeader } from "@/components/store-header";
import { StoreTheme } from "@/components/store-theme";

export async function generateMetadata({ params }: PageProps<"/s/[store]/login">): Promise<Metadata> {
  const store = await getStore((await params).store);
  return { title: `Log in · ${store.name}` };
}

export default function LoginPage({ params, searchParams }: PageProps<"/s/[store]/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-surface p-6 dark:border-ink-800 dark:bg-ink-900">
        <Suspense>
          <LoginOptions params={params} searchParams={searchParams} />
        </Suspense>
        <Suspense>
          <PrivacyLine params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function PrivacyLine({ params }: { params: PageProps<"/s/[store]/login">["params"] }) {
  const { store } = await params;
  return (
    <p className="mt-6 text-xs text-muted">
      By logging in you agree to our{" "}
      <Link href={`/privacy?store=${store}`} className="underline">
        privacy notice
      </Link>
      . You can also order as a guest.
    </p>
  );
}

async function LoginOptions({
  params,
  searchParams,
}: {
  params: PageProps<"/s/[store]/login">["params"];
  searchParams: PageProps<"/s/[store]/login">["searchParams"];
}) {
  const store = await getStore((await params).store);
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : storePath(store.slug, "/account");
  const facebook = readServerPublicEnv().facebookLogin;
  const dev = process.env.NODE_ENV !== "production";

  return (
    <StoreTheme accent={store.accent_color} className="flex flex-col gap-5">
      <StoreHeader store={store} size="sm" />
      <div>
        <h1 className="text-xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-muted">
          Save your details and addresses, see your orders, and get a welcome discount on your first order.
        </p>
      </div>
      {query.error === "facebook" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Facebook login didn&apos;t work. Please try again.</p>
      )}
      {facebook ? (
        <form action={signInWithFacebook}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="store" value={store.slug} />
          <button type="submit" className="w-full rounded-lg bg-[#1877F2] px-4 py-2.5 font-medium text-white hover:bg-[#166fe0]">
            Continue with Facebook
          </button>
        </form>
      ) : (
        <p className="rounded-lg bg-ink-100 p-3 text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">Facebook login is coming soon.</p>
      )}

      {dev && (
        <div className="border-t border-dashed border-ink-300 pt-4 dark:border-ink-700">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Local testing only</p>
          <ActionForm action={devSignIn} submitLabel="Sign in as test customer">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="store" value={store.slug} />
            <Field label="Email">
              <Input name="email" type="email" defaultValue="customer@wfh.test" />
            </Field>
            <Field label="Password" hint="DEV_CUSTOMER_PASSWORD in apps/web/.env.local">
              <Input name="password" type="password" />
            </Field>
          </ActionForm>
        </div>
      )}
    </StoreTheme>
  );
}

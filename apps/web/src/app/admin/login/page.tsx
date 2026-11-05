import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { signIn } from "./actions";

export const metadata = { title: "Admin sign in" };

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-surface p-6 dark:border-ink-800 dark:bg-ink-900">
        <h1 className="text-xl font-semibold">Store admin</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Sign in with your staff account.</p>
        <Suspense>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginForm({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const notStaff = params.error === "not_staff";
  return (
    <>
      {notStaff && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This account isn&apos;t a staff account. Ask the owner to add you on the Staff page.
        </p>
      )}
      <ActionForm action={signIn} submitLabel="Sign in">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
      </ActionForm>
    </>
  );
}

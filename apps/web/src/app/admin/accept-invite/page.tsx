import { AcceptInviteForm } from "./accept-invite-form";

export const metadata = { title: "Set your password", robots: { index: false } };

/** Where the invite email lands: the invited person sets a password, then goes to their store's admin. */
export default function AcceptInvitePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-surface p-6 dark:border-ink-800 dark:bg-ink-900">
        <h1 className="text-xl font-semibold">Set your password</h1>
        <p className="mb-5 mt-1 text-sm text-muted">You&apos;ve been invited to manage a store. Choose a password to finish.</p>
        <AcceptInviteForm />
      </div>
    </main>
  );
}

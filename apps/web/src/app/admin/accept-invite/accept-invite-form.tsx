"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Field, Input } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Status = { state: "checking" } | { state: "ready"; email: string | null } | { state: "invalid"; message: string };

/**
 * The invite link signs the person in (tokens in the URL fragment, never sent to the server); this
 * stores that session in the site's cookies, then lets them set a password.
 */
export function AcceptInviteForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ state: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Remove the tokens from the address bar (and history) straight away.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);

    void (async () => {
      const linkError = params.get("error_description");
      if (linkError) return setStatus({ state: "invalid", message: linkError.replaceAll("+", " ") });

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessionError) return setStatus({ state: "invalid", message: sessionError.message });
      }
      // Reloading the page keeps the session from the first visit.
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setStatus({ state: "invalid", message: "This invite link has expired or was already used." });
      setStatus({ state: "ready", email: data.user.email ?? null });
    })();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters");
    if (password !== confirm) return setError("The passwords don't match");
    setError(null);
    startTransition(async () => {
      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (updateError) return setError(updateError.message);
      router.replace("/admin");
      router.refresh();
    });
  }

  if (status.state === "checking") return <p className="text-sm text-stone-500">Checking your invite…</p>;
  if (status.state === "invalid") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{status.message}</p>
        <p className="text-stone-600 dark:text-stone-400">
          Ask the person who invited you for a new invite. If you already set a password,{" "}
          <Link href="/admin/login" className="underline">
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {status.email && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Signing in as <strong>{status.email}</strong>
        </p>
      )}
      <Field label="New password" hint="At least 8 characters">
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field label="Type it again">
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set password and continue"}
      </button>
    </form>
  );
}

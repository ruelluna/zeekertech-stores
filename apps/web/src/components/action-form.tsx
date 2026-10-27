"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

/** A form bound to a Server Action, with a pending state and a success/error message. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  danger = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel?: string;
  className?: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? "flex flex-col gap-4"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state && !pending && (
          <span role="status" className={`text-sm ${state.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

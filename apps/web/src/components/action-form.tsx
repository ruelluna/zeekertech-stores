"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass, type ButtonVariant } from "./ui";

/** A form bound to a Server Action, with a pending state and a success/error message. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  danger = false,
  variant,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel?: string;
  className?: string;
  danger?: boolean;
  variant?: ButtonVariant;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? "flex flex-col gap-4"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass(variant ?? (danger ? "danger" : "primary"))}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state && !pending && (
          <span role="status" className={`text-sm ${state.ok ? "text-green-800 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

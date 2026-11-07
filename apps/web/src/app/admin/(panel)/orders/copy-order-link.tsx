"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

/** Copies the customer's order page link, for customers who closed the page and ask for it again. */
export function CopyOrderLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/o/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The browser blocked it, so show the link to copy by hand.
      toast({ title: "Couldn't copy the link", body: url, tone: "error" });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="py-1 text-left text-sm underline decoration-ink-400 underline-offset-2 hover:decoration-accent dark:decoration-ink-500"
    >
      <span role="status">{copied ? "Link copied" : "Copy order link"}</span>
    </button>
  );
}

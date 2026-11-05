import { buttonClass } from "./ui";

/**
 * "Like our page" card linking to the store's Facebook Page. A plain link (Facebook's external Like button
 * was retired in February 2026): nothing loads from Facebook, and on phones it opens the Facebook app.
 * Shown at checkout and on the order page; an outline button so it never competes with "Place order".
 */
export function FacebookPrompt({ url, storeName, className }: { url: string; storeName: string; className?: string }) {
  return (
    <aside className={`flex flex-col gap-3 rounded-xl bg-kraft-soft p-4 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}>
      <p className="text-sm text-foreground">Hey, like our page if you haven&apos;t already. That will help us a lot.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className={`${buttonClass("secondary")} min-h-11 shrink-0 gap-2`}>
        <FacebookMark />
        Like {storeName} on Facebook
      </a>
    </aside>
  );
}

/** Facebook's "f" mark, one colour (follows the text). */
function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="currentColor">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

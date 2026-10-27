import { DEFAULT_DELIVERY_SETTINGS } from "@wfh/shared";

// Placeholder until the storefront is built in Phase 1–2 (PLAN.md §15).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Weekend Food Hub</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">Online ordering is coming soon.</p>
      <p className="text-sm text-zinc-500">
        Open daily, 1:00 PM – 9:00 PM · Delivery within mainland Daanbantayan from ₱
        {DEFAULT_DELIVERY_SETTINGS.baseFee}
      </p>
    </main>
  );
}

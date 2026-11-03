import type { ComponentProps, ReactNode } from "react";

// Small shared building blocks for admin forms and tables.

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 dark:border-stone-800 dark:bg-stone-900">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {description && <p className="mb-4 mt-1 text-sm text-stone-600 dark:text-stone-400">{description}</p>}
      {!description && title && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-stone-700 dark:text-stone-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:focus:ring-orange-900";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={2} {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

/** Peso input: blank means "not set yet". */
export function PesoInput({ defaultValue, ...props }: Omit<ComponentProps<"input">, "defaultValue"> & { defaultValue: number | null }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500">₱</span>
      <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="—" defaultValue={defaultValue ?? ""} {...props} className="pl-7" />
    </div>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" value="on" {...props} className="size-4 accent-orange-600" />
      <span>{label}</span>
    </label>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "green" | "amber" | "red" | "orange" | "pink"; children: ReactNode }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    pink: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-stone-500">{label}</p>;
}

export function peso(n: number | null | undefined): string {
  if (n === null || n === undefined) return "₱—";
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

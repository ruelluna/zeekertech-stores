import type { ComponentProps, ReactNode } from "react";

// Small shared building blocks, styled with the storefront theme (DESIGN.md "Storefront theme"): ink letters,
// flat print (no shadows), and the store's accent only as a field (buttons, chips, focus rings).

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-ink-200 bg-surface p-4 sm:p-5 dark:border-ink-800">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {description && <p className="mb-4 mt-1 text-sm text-muted">{description}</p>}
      {!description && title && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-ink-700 dark:text-ink-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-ink-500 bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:bg-ink-100 dark:border-ink-400 dark:disabled:bg-ink-800";

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
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">₱</span>
      <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="—" defaultValue={defaultValue ?? ""} {...props} className="pl-7" />
    </div>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" value="on" {...props} className="size-4 accent-accent-button" />
      <span>{label}</span>
    </label>
  );
}

export type ButtonVariant = "primary" | "secondary" | "danger";

/**
 * Button styles. Primary is the store's accent field with ink or white letters (whichever reaches 4.5:1,
 * see accentTheme); secondary is an ink outline; danger is a deep red field.
 */
export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" | "lg" = "md"): string {
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-4 py-2.5 text-base" };
  const variants = {
    primary: "bg-accent-button text-on-accent hover:brightness-95",
    secondary: "border border-ink-300 bg-surface text-foreground hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return `inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sizes[size]} ${variants[variant]}`;
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" {...props} className={`${buttonClass(variant, size)} ${className ?? ""}`} />;
}

/** Link styled as text: ink, underlined (the accent is never used for letters). */
export const linkClass = "underline decoration-ink-400 underline-offset-2 hover:decoration-accent dark:decoration-ink-500";

export type BadgeTone = "neutral" | "green" | "amber" | "red" | "accent";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone | "orange" | "pink"; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-200",
    green: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    accent: "bg-accent-soft text-foreground",
  };
  // "orange" and "pink" were the old accent tones; both are now the store's accent.
  const key: BadgeTone = tone === "orange" || tone === "pink" ? "accent" : tone;
  return <span className={`stamp inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] leading-4 ${tones[key]}`}>{children}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-muted">{label}</p>;
}

export function peso(n: number | null | undefined): string {
  if (n === null || n === undefined) return "₱—";
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

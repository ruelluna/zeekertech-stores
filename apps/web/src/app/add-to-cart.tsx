"use client";

import { useState } from "react";
import { groupApplies } from "@wfh/shared";
import { cartFor, type CartEntry } from "@/lib/cart-store";
import type { MenuItem } from "@/lib/menu";
import { peso } from "@/components/ui";

/** "Add" button and the options sheet for one menu item, adding to that store's cart. */
export function AddToCart({ item, canOrder, store }: { item: MenuItem; canOrder: boolean; store: string }) {
  const [open, setOpen] = useState(false);
  const orderable = canOrder && (item.badge === "available" || item.badge === "subject_to_availability");
  if (!orderable) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 self-start rounded-lg bg-accent-button px-4 py-2 text-sm font-medium text-on-accent hover:brightness-95"
      >
        Add
      </button>
      {open && <OptionsSheet item={item} onClose={() => setOpen(false)} onAdd={cartFor(store).add} />}
    </>
  );
}

/**
 * Options, size, notes and quantity for one item. Used by the menu (cart), checkout (editing a line,
 * pre-filled from `initial`) and the admin manual order.
 */
export function OptionsSheet({
  item,
  onClose,
  onAdd,
  initial,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (entry: CartEntry) => void;
  initial?: CartEntry;
}) {
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [weightKg, setWeightKg] = useState<number | null>(() => {
    if (item.soldBy !== "weight") return null;
    return initial?.weightKg !== null && initial?.weightKg !== undefined && item.weightOptionsKg.includes(initial.weightKg)
      ? initial.weightKg
      : (item.weightOptionsKg[0] ?? null);
  });
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      item.groups.map((g) => [
        g.id,
        initial
          ? g.options.filter((o) => initial.modifierIds.includes(o.id)).map((o) => o.id)
          : g.required && g.maxSelect === 1 && g.options[0]
            ? [g.options[0].id]
            : [],
      ]),
    ),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  // Conditional groups (e.g. Egg style after Add egg) show only once their option is picked.
  const allPicked = Object.values(picked).flat();
  const visibleGroups = item.groups.filter((g) => g.options.length > 0 && groupApplies(g, allPicked));
  const selected = visibleGroups.flatMap((g) => g.options.filter((o) => picked[g.id]?.includes(o.id)));
  const deltas = selected.reduce((s, o) => s + o.priceDelta, 0);
  const market = item.priceMode === "market";
  const basis = market ? (item.price ?? item.estimatedPrice ?? 0) : (item.price ?? 0);
  const unit = Math.round((basis * (weightKg ?? 1) + deltas) * 100) / 100;
  const requiresCooking = item.type === "frozen" ? selected.some((o) => o.requiresCooking) : item.type !== "ready_made";

  function toggle(groupId: string, optionId: string, maxSelect: number) {
    setPicked((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect === 1) return { ...prev, [groupId]: [optionId] };
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      return current.length >= maxSelect ? prev : { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function add() {
    for (const g of visibleGroups) {
      const count = picked[g.id]?.length ?? 0;
      const min = g.required ? Math.max(1, g.minSelect) : g.minSelect;
      if (count < min) return setError(`Choose ${g.name.toLowerCase()}`);
    }
    onAdd({
      lineId: initial?.lineId ?? crypto.randomUUID(),
      productId: item.id,
      qty,
      weightKg,
      modifierIds: selected.map((o) => o.id),
      notes: notes.trim(),
      name: item.name,
      optionLabels: [...(weightKg ? [`${weightKg} kg`] : []), ...selected.map((o) => o.name)],
      displayUnitPrice: unit,
      isEstimate: market,
      needsAvailability: market || item.badge === "subject_to_availability",
      requiresCooking,
      prepMinutes: requiresCooking ? (item.prepMinutes ?? 0) : 0,
      noticeDays: item.noticeDays,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface border border-ink-300 p-5 sm:rounded-2xl dark:border-ink-700 dark:bg-ink-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{item.name}</h3>
            {market && <p className="text-sm text-muted">Market price. We confirm the final price before you pay.</p>}
            {item.noticeDays > 0 && (
              <p className="text-sm text-muted">
                Made to order. The earliest pickup or delivery is {item.noticeDays === 1 ? "tomorrow" : `${item.noticeDays} days from today`}.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="-m-2 flex min-h-11 min-w-11 items-center justify-center text-2xl leading-none text-muted" aria-label="Close">
            ×
          </button>
        </div>

        {item.soldBy === "weight" && (
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium">Size</legend>
            <div className="flex flex-wrap gap-2">
              {item.weightOptionsKg.map((kg) => (
                <button
                  key={kg}
                  type="button"
                  onClick={() => setWeightKg(kg)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${weightKg === kg ? "border-accent-button bg-accent-button text-on-accent" : "border-ink-300 dark:border-ink-700"}`}
                >
                  {kg} kg
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Groups with no priced options (nothing to pick yet) and unmet conditions stay hidden. */}
        {visibleGroups.map((g) => (
          <fieldset key={g.id} className="mb-4">
            <legend className="mb-2 text-sm font-medium">
              {g.name}
              <span className="ml-1 font-normal text-muted">
                {g.required ? "(required)" : g.maxSelect > 1 ? `(up to ${g.maxSelect})` : "(optional)"}
              </span>
            </legend>
            <div className="flex flex-col gap-2">
              {g.options.map((o) => (
                <label key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700">
                  <span className="flex items-center gap-2">
                    <input
                      type={g.maxSelect === 1 ? "radio" : "checkbox"}
                      name={g.id}
                      checked={picked[g.id]?.includes(o.id) ?? false}
                      onChange={() => toggle(g.id, o.id, g.maxSelect)}
                      onClick={() => {
                        // Optional single-choice groups can be cleared by tapping the selected option again.
                        if (g.maxSelect === 1 && !g.required && picked[g.id]?.includes(o.id)) setPicked((p) => ({ ...p, [g.id]: [] }));
                      }}
                      className="accent-accent-button"
                    />
                    {o.name}
                  </span>
                  {o.priceDelta > 0 && <span className="text-muted">+{peso(o.priceDelta)}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="mb-4 flex flex-col gap-1 text-sm">
          <span className="font-medium">{item.notePrompt ?? "Notes"} (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            rows={3}
            className="resize-y rounded-lg border border-ink-500 bg-surface px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-ink-400 dark:bg-ink-950"
          />
          <span className="self-end text-xs text-muted">{notes.length}/200</span>
        </label>

        {error && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-ink-300 dark:border-ink-700">
            <button type="button" className="min-h-11 min-w-11 px-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">
              −
            </button>
            <span className="w-8 text-center text-sm" aria-live="polite">
              {qty}
            </span>
            <button type="button" className="min-h-11 min-w-11 px-3" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="More">
              +
            </button>
          </div>
          <button type="button" onClick={add} className="flex-1 rounded-lg bg-accent-button px-4 py-2.5 font-medium text-on-accent hover:brightness-95">
            {initial ? "Update" : "Add"} · {market ? "~" : ""}
            {peso(unit * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

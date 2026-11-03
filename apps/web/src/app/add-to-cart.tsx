"use client";

import { useState } from "react";
import { groupApplies } from "@wfh/shared";
import { cart, type CartEntry } from "@/lib/cart-store";
import type { MenuItem } from "@/lib/menu";
import { peso } from "@/components/ui";

/** "Add" button and the options sheet for one menu item. */
export function AddToCart({ item, canOrder }: { item: MenuItem; canOrder: boolean }) {
  const [open, setOpen] = useState(false);
  const orderable = canOrder && (item.badge === "available" || item.badge === "subject_to_availability");
  if (!orderable) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 self-start rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
      >
        Add
      </button>
      {open && <OptionsSheet item={item} onClose={() => setOpen(false)} onAdd={cart.add} />}
    </>
  );
}

/** Options, size, notes and quantity for one item. Used by the menu (cart) and the admin manual order. */
export function OptionsSheet({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (entry: CartEntry) => void }) {
  const [qty, setQty] = useState(1);
  const [weightKg, setWeightKg] = useState<number | null>(item.soldBy === "weight" ? (item.weightOptionsKg[0] ?? null) : null);
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(item.groups.map((g) => [g.id, g.required && g.maxSelect === 1 && g.options[0] ? [g.options[0].id] : []])),
  );
  const [notes, setNotes] = useState("");
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
      lineId: crypto.randomUUID(),
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-stone-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{item.name}</h3>
            {market && <p className="text-sm text-stone-500">Market price. We confirm the final price before you pay.</p>}
            {item.noticeDays > 0 && (
              <p className="text-sm text-stone-500">
                Made to order. The earliest pickup or delivery is {item.noticeDays === 1 ? "tomorrow" : `${item.noticeDays} days from today`}.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-stone-400" aria-label="Close">
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
                  className={`rounded-full border px-3 py-1 text-sm ${weightKg === kg ? "border-orange-600 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "border-stone-300 dark:border-stone-700"}`}
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
              <span className="ml-1 font-normal text-stone-500">
                {g.required ? "(required)" : g.maxSelect > 1 ? `(up to ${g.maxSelect})` : "(optional)"}
              </span>
            </legend>
            <div className="flex flex-col gap-2">
              {g.options.map((o) => (
                <label key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-700">
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
                      className="accent-orange-600"
                    />
                    {o.name}
                  </span>
                  {o.priceDelta > 0 && <span className="text-stone-500">+{peso(o.priceDelta)}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="mb-4 flex flex-col gap-1 text-sm">
          <span className="font-medium">{item.notePrompt ?? "Notes"} (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-950"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-stone-300 dark:border-stone-700">
            <button type="button" className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">
              −
            </button>
            <span className="w-8 text-center text-sm" aria-live="polite">
              {qty}
            </span>
            <button type="button" className="px-3 py-2" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="More">
              +
            </button>
          </div>
          <button type="button" onClick={add} className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 font-medium text-white hover:bg-orange-700">
            Add · {market ? "~" : ""}
            {peso(unit * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

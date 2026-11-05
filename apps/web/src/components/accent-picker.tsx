"use client";

import { useState, type CSSProperties } from "react";
import { ACCENT_SWATCHES, accentStyle, accentTheme, normalizeHex } from "@wfh/shared";

/**
 * The store's one accent colour: brand swatches or any hex, with a live preview of how the menu header,
 * a chip and a button will look. Button labels are kept readable automatically (see accentTheme).
 */
export function AccentPicker({ name = "accent_color", defaultValue, storeName }: { name?: string; defaultValue: string; storeName: string }) {
  const [value, setValue] = useState(defaultValue);
  const [text, setText] = useState(defaultValue);
  const theme = accentTheme(value);
  const adjusted = theme.accentButton !== theme.accent;

  const choose = (hex: string) => {
    setValue(hex);
    setText(hex);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <input type="hidden" name={name} value={value} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink-700 dark:text-ink-300">Accent colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_SWATCHES.map((s) => (
            <button
              key={s.hex}
              type="button"
              onClick={() => choose(s.hex)}
              aria-pressed={value === s.hex}
              title={s.name}
              className={`size-8 rounded-full border-2 ${value === s.hex ? "border-ink-900 dark:border-mist" : "border-transparent"}`}
              style={{ background: s.hex }}
            >
              <span className="sr-only">{s.name}</span>
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="color"
              value={value}
              onChange={(e) => choose(e.target.value.toUpperCase())}
              className="size-8 cursor-pointer rounded border border-ink-300 bg-transparent dark:border-ink-700"
              aria-label="Custom colour"
            />
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                const hex = normalizeHex(e.target.value);
                if (hex) setValue(hex);
              }}
              className="w-24 rounded-lg border border-ink-300 bg-surface px-2 py-1.5 font-mono text-sm uppercase outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-ink-700"
              aria-label="Hex code"
              maxLength={7}
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          Used for buttons, the cart bar, selected chips and dotted rules. Text is never set in it.
          {adjusted && " Buttons use a slightly adjusted shade so their labels stay readable."}
        </p>
      </fieldset>

      <div className="store-theme rounded-lg border border-ink-200 bg-background p-4 dark:border-ink-800" style={accentStyle(value) as CSSProperties}>
        <p className="font-script text-3xl leading-none text-foreground">{storeName || "Your store"}</p>
        <div className="rule-dotted mt-2 w-40" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="stamp rounded-full bg-accent-button px-3 py-1 text-xs text-on-accent">Selected</span>
          <span className="stamp rounded-full border border-ink-300 px-3 py-1 text-xs dark:border-ink-700">Category</span>
          <span className="rounded-lg bg-accent-button px-4 py-2 text-sm font-medium text-on-accent">Add to cart</span>
          <span className="rounded-md bg-accent-soft px-2 py-1 text-xs">Soft note</span>
        </div>
      </div>
    </div>
  );
}

import { describe, expect, it } from "vitest";
import { ACCENT_SWATCHES, BUTTON_CONTRAST, INK, LINE_CONTRAST, WHITE, accentTheme, contrast, normalizeHex, textOn } from "./theme";

describe("contrast", () => {
  it("matches known WCAG ratios", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // Today's white-on-orange-600 buttons fall short of AA.
    expect(contrast(WHITE, "#EA580C")).toBeLessThan(4.5);
  });
});

describe("normalizeHex", () => {
  it("accepts six-digit hex with or without #", () => {
    expect(normalizeHex("ea580c")).toBe("#EA580C");
    expect(normalizeHex(" #b21e4b ")).toBe("#B21E4B");
  });
  it("rejects anything else", () => {
    expect(normalizeHex("#fff")).toBeNull();
    expect(normalizeHex("orange")).toBeNull();
  });
});

describe("accentTheme", () => {
  const passes = (hex: string) => {
    const t = accentTheme(hex);
    expect(contrast(t.onAccent, t.accentButton)).toBeGreaterThanOrEqual(BUTTON_CONTRAST);
    return t;
  };

  it("keeps the accent but shades the button for Market Orange", () => {
    const t = passes("#EA580C");
    expect(t.accent).toBe("#EA580C");
    expect(t.accentButton).not.toBe("#EA580C");
  });

  it("uses Cabbage Ruby as is, with white labels", () => {
    const t = passes("#B21E4B");
    expect(t.accentButton).toBe("#B21E4B");
    expect(t.onAccent).toBe(WHITE);
  });

  it("puts ink on light accents", () => {
    const t = passes("#F5C542");
    expect(t.accentButton).toBe("#F5C542");
    expect(t.onAccent).toBe(INK);
  });

  it("handles very dark and mid-grey accents", () => {
    expect(passes("#111111").onAccent).toBe(WHITE);
    passes("#777777");
    passes("#5C7F4A");
  });

  it("falls back to the default accent for bad input", () => {
    expect(accentTheme("nope").accent).toBe("#EA580C");
    expect(accentTheme(null).accent).toBe("#EA580C");
  });

  it("keeps soft tints readable with ink (light) and mist-ish text (dark)", () => {
    const t = accentTheme("#B21E4B");
    expect(contrast(INK, t.accentSoft)).toBeGreaterThanOrEqual(7);
    expect(contrast("#F7F5EE", t.accentSoftDark)).toBeGreaterThanOrEqual(7);
  });
});

describe("accentTheme lines and dark mode", () => {
  const LIGHT = ["#F7F5EE", WHITE];
  const DARK = [INK, "#1F1C19"];
  const accents = [...ACCENT_SWATCHES.map((s) => s.hex), "#F5C542", "#1A1A1A", "#FFFFFF", "#000000"];

  it.each(accents)("keeps rules and rings visible for %s", (hex) => {
    const t = accentTheme(hex);
    for (const g of LIGHT) expect(contrast(t.accentLine, g)).toBeGreaterThanOrEqual(LINE_CONTRAST);
    for (const g of DARK) expect(contrast(t.accentLineDark, g)).toBeGreaterThanOrEqual(LINE_CONTRAST);
  });

  it.each(accents)("keeps dark-mode buttons readable and visible for %s", (hex) => {
    const t = accentTheme(hex);
    expect(contrast(t.onAccentDark, t.accentButtonDark)).toBeGreaterThanOrEqual(BUTTON_CONTRAST);
    for (const g of DARK) expect(contrast(t.accentButtonDark, g)).toBeGreaterThanOrEqual(LINE_CONTRAST);
  });

  it("leaves Market Orange unchanged where it already passes", () => {
    const t = accentTheme("#EA580C");
    expect(t.accentLine).toBe("#EA580C");
    expect(t.accentLineDark).toBe("#EA580C");
  });
});

describe("textOn", () => {
  it("picks the more readable of ink and white", () => {
    expect(textOn("#FFFFFF")).toBe(INK);
    expect(textOn("#000000")).toBe(WHITE);
  });
});

// Store accent colours (DESIGN.md "Storefront theme"). Every store shares the kitchen-label look and picks
// one accent. The accent is only ever a field (buttons, bars, chips, rules), never letters, and button
// labels must reach WCAG AA (4.5:1). When neither ink nor white reaches that on the accent itself,
// buttons use the nearest lighter or darker shade of the accent that does.

/** Ink Charcoal: every letter on light grounds and on light accents. */
export const INK = "#2E2A26";
/** Letters on dark accents. */
export const WHITE = "#FFFFFF";
/** Default accent (Weekend Food Hub's Market Orange). */
export const DEFAULT_ACCENT = "#EA580C";
/** Minimum contrast for button labels. */
export const BUTTON_CONTRAST = 4.5;

/** Accent swatches offered in the admin (from the brand palette, plus a few that pass with ink or white). */
export const ACCENT_SWATCHES: { name: string; hex: string }[] = [
  { name: "Market orange", hex: "#EA580C" },
  { name: "Cabbage ruby", hex: "#B21E4B" },
  { name: "Dill", hex: "#5C7F4A" },
  { name: "Kraft", hex: "#CDAE86" },
  { name: "Mango", hex: "#F5B82E" },
  { name: "Sea", hex: "#1F7A8C" },
  { name: "Ube", hex: "#6B4C9A" },
];

const HEX = /^#?([0-9a-f]{6})$/i;

/** "#ea580c", "EA580C" → "#EA580C"; anything else → null. */
export function normalizeHex(value: string): string | null {
  const m = HEX.exec(value.trim());
  return m ? `#${m[1]!.toUpperCase()}` : null;
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// OKLCH, to lighten or darken a colour without shifting its hue.
type Oklch = { l: number; c: number; h: number };

function toOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Rgb;
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function fromOklch({ l, c, h }: Oklch): string {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const b = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return rgbToHex([fromLinear(r), fromLinear(g), fromLinear(b)]);
}

/** Ink or white, whichever reads better on this colour. */
export function textOn(hex: string): string {
  return contrast(INK, hex) >= contrast(WHITE, hex) ? INK : WHITE;
}

/** Grounds the accent sits on: Mist page and white cards (light), and the charcoal page and cards (dark). */
const LIGHT_GROUNDS = ["#F7F5EE", WHITE];
const DARK_GROUNDS = [INK, "#1F1C19"];
/** Minimum contrast for lines, rings, bars and button edges against the page (WCAG non-text contrast). */
export const LINE_CONTRAST = 3;

export interface AccentTheme {
  /** The store's colour as chosen. */
  accent: string;
  /** Rules, bars, borders and focus rings on light grounds: the accent, or the nearest shade reaching 3:1. */
  accentLine: string;
  /** The same on dark grounds. */
  accentLineDark: string;
  /** Button fill in light mode: the accent, or the nearest shade whose label reaches 4.5:1. */
  accentButton: string;
  /** Label colour on accentButton (ink or white). */
  onAccent: string;
  /** Button fill in dark mode: also stands out 3:1 from the charcoal page and cards. */
  accentButtonDark: string;
  /** Label colour on accentButtonDark. */
  onAccentDark: string;
  /** Pale tint of the accent for soft grounds in light mode (ink letters). */
  accentSoft: string;
  /** Deep tint of the accent for soft grounds in dark mode (mist letters). */
  accentSoftDark: string;
}

const minContrast = (hex: string, grounds: string[]) => Math.min(...grounds.map((g) => contrast(hex, g)));

/** The accent itself if it passes, else the nearest lighter or darker shade (same hue) that does. */
function nearestShade(accent: string, passes: (hex: string) => boolean): string {
  if (passes(accent)) return accent;
  const base = toOklch(accent);
  for (let step = 0.01; step <= 1; step += 0.01) {
    const shades = [fromOklch({ ...base, l: Math.max(0, base.l - step) }), fromOklch({ ...base, l: Math.min(1, base.l + step) })];
    const pass = shades.find(passes);
    if (pass) return pass;
  }
  return accent;
}

const readable = (hex: string) => contrast(textOn(hex), hex) >= BUTTON_CONTRAST;

/** Everything a page needs to show one store's accent. Invalid input falls back to the default accent. */
export function accentTheme(value: string | null | undefined): AccentTheme {
  const accent = normalizeHex(value ?? "") ?? DEFAULT_ACCENT;
  const base = toOklch(accent);
  const accentButton = nearestShade(accent, readable);
  const accentButtonDark = nearestShade(accentButton, (hex) => readable(hex) && minContrast(hex, DARK_GROUNDS) >= LINE_CONTRAST);

  return {
    accent,
    accentLine: nearestShade(accent, (hex) => minContrast(hex, LIGHT_GROUNDS) >= LINE_CONTRAST),
    accentLineDark: nearestShade(accent, (hex) => minContrast(hex, DARK_GROUNDS) >= LINE_CONTRAST),
    accentButton,
    onAccent: textOn(accentButton),
    accentButtonDark,
    onAccentDark: textOn(accentButtonDark),
    accentSoft: fromOklch({ l: 0.955, c: Math.min(base.c, 0.2) * 0.18, h: base.h }),
    accentSoftDark: fromOklch({ l: 0.32, c: Math.min(base.c, 0.2) * 0.35, h: base.h }),
  };
}

/**
 * CSS custom properties for one store's accent: a light and a dark value of each, which globals.css picks
 * from by colour scheme (on :root and on .store-theme wrappers).
 */
export function accentStyle(value: string | null | undefined): Record<string, string> {
  const t = accentTheme(value);
  return {
    "--accent": t.accent,
    "--accent-line-light": t.accentLine,
    "--accent-line-dark": t.accentLineDark,
    "--accent-button-light": t.accentButton,
    "--on-accent-light": t.onAccent,
    "--accent-button-dark": t.accentButtonDark,
    "--on-accent-dark": t.onAccentDark,
    "--accent-soft-light": t.accentSoft,
    "--accent-soft-dark": t.accentSoftDark,
  };
}

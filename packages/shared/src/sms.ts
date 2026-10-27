// SMS helpers. Texts stay in the GSM-7 alphabet: one emoji or "₱" switches a text to Unicode,
// which cuts a part from 160 to 70 characters and can triple the cost.

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€"; // each counts as 2 characters
const GSM = new Set([...GSM_BASIC, ...GSM_EXTENDED]);

const REPLACEMENTS: [RegExp, string][] = [
  [/₱\s*/g, "PHP "],
  [/[‘’‚′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[‐‑‒–—―]/g, "-"],
  [/…/g, "..."],
  [/[·•]/g, "-"],
  [/[\t ]/g, " "],
];

/** Rewrites text into characters every phone shows and that keep the text in GSM-7. */
export function toSmsText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  out = [...out]
    .map((ch) => {
      if (GSM.has(ch)) return ch;
      const plain = ch.normalize("NFD").replace(/\p{M}/gu, ""); // á → a
      return [...plain].every((c) => GSM.has(c)) ? plain : "";
    })
    .join("");
  return out
    .replace(/ {2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** How many SMS parts a GSM-7 text is billed as. */
export function smsParts(text: string): number {
  const length = [...text].reduce((n, ch) => n + (GSM_EXTENDED.includes(ch) ? 2 : 1), 0);
  if (length === 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

/** 09XXXXXXXXX (or +63 9XX…) → 639XXXXXXXXX, the format SMS gateways expect. Null if it isn't a PH mobile number. */
export function toPhMobile(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  const local = digits.match(/^(?:63|0)?(9\d{9})$/)?.[1];
  return local ? `63${local}` : null;
}

/** "PHP 349" / "PHP 349.50": the peso sign isn't in GSM-7. */
export function smsPeso(amount: number): string {
  return `PHP ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/**
 * Normalizes a Philippine mobile number to 09XXXXXXXXX.
 * Accepts 09XXXXXXXXX, 9XXXXXXXXX, 639XXXXXXXXX and +639XXXXXXXXX, with spaces or dashes.
 * Returns null if it isn't a valid PH mobile number.
 */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+/, "");
  let local: string;
  if (/^639\d{9}$/.test(digits)) local = `0${digits.slice(2)}`;
  else if (/^09\d{9}$/.test(digits)) local = digits;
  else if (/^9\d{9}$/.test(digits)) local = `0${digits}`;
  else return null;
  return local;
}

import { z } from "zod";

export type ActionState = { ok: boolean; message: string } | null;

export const ok = (message = "Saved"): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/** First zod issue as a readable message. */
export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

// FormData helpers: blank inputs become null, checkboxes become booleans.
export const form = {
  /** Optional peso/number; "" → null. */
  num: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().finite().nullable()),
  int: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().nullable()),
  text: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string()),
  optText: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().nullable()),
  bool: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
};

export function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

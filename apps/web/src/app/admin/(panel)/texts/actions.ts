"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toPhMobile } from "@wfh/shared";
import { fail, form, formObject, ok, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { sendSms, smsMode } from "@/lib/sms";

/** Stores numbers as 09XXXXXXXXX whichever way they were typed. */
const phMobile = form.optText.transform((v, ctx) => {
  if (v === null) return null;
  const intl = toPhMobile(v);
  if (!intl) {
    ctx.addIssue({ code: "custom", message: "Enter a mobile number like 09171234567" });
    return z.NEVER;
  }
  return `0${intl.slice(2)}`;
});

const Settings = z.object({
  enabled: form.bool,
  admin_phone: phMobile,
  customer_review: form.bool,
  customer_payment_rejected: form.bool,
  customer_payment_confirmed: form.bool,
  customer_ready_pickup: form.bool,
  customer_out_for_delivery: form.bool,
  customer_cancelled: form.bool,
  admin_seafood_check: form.bool,
  admin_payment_to_verify: form.bool,
});

export async function saveSmsSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = Settings.safeParse(formObject(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");

  const { supabase } = await requireOwner();
  const { error } = await supabase
    .schema("ops")
    .from("sms_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function sendTestSms(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const phone = phMobile.safeParse(formData.get("phone"));
  if (!phone.success || !phone.data) return fail("Enter a mobile number like 09171234567");
  await requireOwner();

  const error = await sendSms(
    "test",
    phone.data,
    "Weekend Food Hub: This is a test text from your ordering system. Texts are working!",
  );
  refresh();
  if (error) return fail(`Not sent: ${error}`);
  return ok(
    smsMode() === "live"
      ? `Test text sent to ${phone.data}`
      : `Logged only (dry run), not sent to ${phone.data}`,
  );
}

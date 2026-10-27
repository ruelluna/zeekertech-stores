import "server-only";
import { smsParts, toPhMobile, toSmsText, type Tables } from "@wfh/shared";
import { createSupabaseAdminClient } from "./supabase/admin";

// Text messages, only for significant moments (each one has a switch in Admin → Texts).
// Two providers, picked with SMS_PROVIDER:
// - textbee: an Android phone with the textbee app sends from its own SIM. No business registration needed.
// - philsms: PhilSMS gateway with a registered sender name (needs a registered business).
// Never throws: a failed text must not break order processing.

export type SmsSettings = Tables<{ schema: "ops" }, "sms_settings">;
export type CustomerSmsKind =
  | "customer_review"
  | "customer_payment_rejected"
  | "customer_payment_confirmed"
  | "customer_ready_pickup"
  | "customer_out_for_delivery"
  | "customer_cancelled";
export type AdminSmsKind = "admin_seafood_check" | "admin_payment_to_verify";
type SmsKind = CustomerSmsKind | AdminSmsKind | "test";

type SendResult = { providerId: string | null; warning: string | null } | { error: string };
export type SmsStatus = { label: string; detail: string | null; ok: boolean };

interface Provider {
  name: string;
  configured(): boolean;
  send(recipient: string, text: string): Promise<SendResult>;
  status(): Promise<SmsStatus | null>;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const philsms: Provider = (() => {
  const API = "https://dashboard.philsms.com/api/v3";
  const token = () => process.env.PHILSMS_API_TOKEN?.trim() ?? "";
  const headers = () => ({
    Authorization: `Bearer ${token()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  return {
    name: "PhilSMS",
    configured: () => Boolean(token()),
    async send(recipient, text) {
      const res = await fetch(`${API}/sms/send`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          recipient,
          sender_id: process.env.PHILSMS_SENDER_ID || "PhilSMS",
          type: "plain",
          message: text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      // PhilSMS answers errors with HTTP 200 and status "error".
      const body = (await res.json().catch(() => null)) as {
        status?: string;
        message?: string;
        data?: { uid?: string };
      } | null;
      if (res.ok && body?.status === "success")
        return { providerId: body.data?.uid ?? null, warning: null };
      return { error: body?.message ?? `HTTP ${res.status}` };
    },
    async status() {
      const res = await fetch(`${API}/balance`, {
        headers: headers(),
        signal: AbortSignal.timeout(5_000),
      });
      const body = (await res.json()) as {
        status?: string;
        data?: { remaining_balance?: string; expired_on?: string };
      };
      if (body.status !== "success" || !body.data?.remaining_balance) return null;
      return {
        label: `Balance ${body.data.remaining_balance.replace("₱", "₱ ")}`,
        detail: body.data.expired_on ? `expires ${body.data.expired_on}` : null,
        ok: true,
      };
    },
  };
})();

const textbee: Provider = (() => {
  const api = () =>
    (process.env.TEXTBEE_API_URL || "https://api.textbee.dev/api/v1").replace(/\/$/, "");
  const key = () => process.env.TEXTBEE_API_KEY?.trim() ?? "";
  const deviceId = () => process.env.TEXTBEE_DEVICE_ID?.trim() || undefined;
  const headers = () => ({
    "x-api-key": key(),
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  return {
    name: "textbee (your phone)",
    configured: () => Boolean(key()),
    async send(recipient, text) {
      const res = await fetch(`${api()}/gateway/send-sms`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          recipients: [`+${recipient}`],
          message: text,
          deviceId: deviceId(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string | string[];
        error?: string;
        data?: {
          success?: boolean;
          smsBatchId?: string;
          failureCount?: number;
          warning?: { message?: string };
        };
      } | null;
      if (res.ok && body?.data?.success !== false && !body?.data?.failureCount) {
        // Accepted means queued on the phone; it still has to be online to send.
        return {
          providerId: body?.data?.smsBatchId ?? null,
          warning: body?.data?.warning?.message ?? null,
        };
      }
      const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
      return { error: message ?? body?.error ?? `HTTP ${res.status}` };
    },
    async status() {
      const res = await fetch(`${api()}/gateway/devices`, {
        headers: headers(),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        data?: {
          _id: string;
          enabled: boolean;
          isDefault?: boolean;
          model?: string;
          name?: string;
          lastHeartbeat?: string;
        }[];
      };
      const devices = body.data ?? [];
      const device =
        devices.find((d) => d._id === deviceId()) ??
        devices.find((d) => d.isDefault) ??
        devices
          .filter((d) => d.enabled)
          .sort((a, b) => (b.lastHeartbeat ?? "").localeCompare(a.lastHeartbeat ?? ""))[0];
      if (!device)
        return {
          label: "No phone connected",
          detail: "Install the textbee app and sign in.",
          ok: false,
        };
      const minutes = device.lastHeartbeat
        ? Math.round((Date.now() - Date.parse(device.lastHeartbeat)) / 60_000)
        : null;
      const seen =
        minutes === null
          ? "never seen"
          : minutes < 2
            ? "online"
            : `last seen ${formatAgo(minutes)} ago`;
      return {
        label: `Phone: ${device.name || device.model || "Android"}`,
        detail: device.enabled ? seen : "turned off in textbee",
        ok: device.enabled && minutes !== null && minutes < 30,
      };
    },
  };
})();

function formatAgo(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} days`;
}

const provider = (): Provider => (process.env.SMS_PROVIDER === "philsms" ? philsms : textbee);
const dryRun = () => !provider().configured() || process.env.SMS_DRY_RUN === "true";

export const smsProviderName = () => provider().name;
export const smsMode = () =>
  dryRun() ? (provider().configured() ? "dry_run" : "no_token") : "live";

export async function getSmsSettings(): Promise<SmsSettings | null> {
  const { data } = await createSupabaseAdminClient()
    .schema("ops")
    .from("sms_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return data;
}

/** Texts a customer if that kind of text is switched on. */
export async function textCustomer(
  kind: CustomerSmsKind,
  phone: string | null | undefined,
  message: string,
  orderCode: string,
) {
  const settings = await getSmsSettings();
  if (!settings?.enabled || !settings[kind]) return;
  await sendSms(kind, phone, message, orderCode);
}

/** Texts the admin number if it's set and that kind of text is switched on. */
export async function textAdmin(kind: AdminSmsKind, message: string, orderCode: string) {
  const settings = await getSmsSettings();
  if (!settings?.enabled || !settings[kind] || !settings.admin_phone) return;
  await sendSms(kind, settings.admin_phone, message, orderCode);
}

/** Sends one text and logs it. Returns an error message, or null when it went out (or was logged in dry-run mode). */
export async function sendSms(
  kind: SmsKind,
  phone: string | null | undefined,
  message: string,
  orderCode?: string,
): Promise<string | null> {
  const recipient = toPhMobile(phone);
  if (!recipient) return "Not a PH mobile number";
  const text = toSmsText(message);

  let status: "sent" | "failed" | "dry_run" = "dry_run";
  let providerId: string | null = null;
  let error: string | null = null;

  if (dryRun()) {
    console.info(`[sms dry run] ${kind} → ${recipient} (${smsParts(text)} part): ${text}`);
  } else {
    try {
      const result = await provider().send(recipient, text);
      if ("error" in result) {
        status = "failed";
        error = result.error;
      } else {
        status = "sent";
        providerId = result.providerId;
        if (result.warning) error = `Warning: ${result.warning}`;
      }
    } catch (e) {
      status = "failed";
      error = errorMessage(e);
    }
    if (error) console.error(`[sms] ${kind} → ${recipient}: ${error}`);
  }

  try {
    const log = createSupabaseAdminClient().schema("ops").from("sms_log");
    await log.insert({
      kind,
      recipient,
      message: text,
      order_code: orderCode ?? null,
      status,
      provider_id: providerId,
      error,
    });
    await log.delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
  } catch (e) {
    console.error("[sms] couldn't write the log", e);
  }
  return status === "failed" ? error : null;
}

/** Provider status for the admin page: PhilSMS balance, or whether the textbee phone is online. */
export async function getSmsStatus(): Promise<SmsStatus | null> {
  if (!provider().configured()) return null;
  try {
    return await provider().status();
  } catch {
    return null;
  }
}

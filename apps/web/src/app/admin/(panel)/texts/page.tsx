import { Suspense } from "react";
import { smsParts, toSmsText } from "@wfh/shared";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { getSmsStatus, smsMode, smsProviderName, type SmsSettings } from "@/lib/sms";
import { adminPaymentText, adminSeafoodCheckText, customerStatusText } from "@/lib/sms-texts";
import { saveSmsSettings, sendTestSms } from "./actions";

export default function TextsPage() {
  return (
    <>
      <PageHeader
        title="Texts (SMS)"
        description="Text messages for the moments that matter only. Everything else stays on the order page and browser notifications."
      />
      <Suspense fallback={<Loading />}>
        <TextsContent />
      </Suspense>
    </>
  );
}

// Sample texts so the owner sees exactly what goes out.
const site = process.env.SITE_URL ?? "http://localhost:3100";
// Samples use the longest store name, so the length check covers every store.
const SAMPLE_STORE = "Sweet Treats by Yang";

const sampleOrder = {
  store: SAMPLE_STORE,
  code: "WEB-10012",
  total: 349,
  fulfillment: "pickup" as const,
  link: `${site}/o/3f2b9c1e-8a4d-4f6b-9e2a-7c5d1b0a9e44`,
};
const customerSample = (
  status: Parameters<typeof customerStatusText>[0],
  previous: Parameters<typeof customerStatusText>[1],
) => customerStatusText(status, previous, sampleOrder, "Jun")!.message;

const CUSTOMER: { key: keyof SmsSettings; label: string; when: string; sample: string }[] = [
  {
    key: "customer_review",
    label: "Availability check result",
    when: "After the availability check: pay now, or review items that changed. They may have left the page while waiting.",
    sample: customerSample("pending_payment", "awaiting_availability"),
  },
  {
    key: "customer_payment_rejected",
    label: "Payment not accepted",
    when: "When a GCash payment can't be confirmed.",
    sample: customerSample("rejected", "pending_payment"),
  },
  {
    key: "customer_ready_pickup",
    label: "Ready for pickup",
    when: "Pickup orders, when marked Ready.",
    sample: customerSample("ready", "preparing"),
  },
  {
    key: "customer_out_for_delivery",
    label: "Rider on the way",
    when: "Delivery orders, with the rider's name.",
    sample: customerSample("out_for_delivery", "ready"),
  },
  {
    key: "customer_cancelled",
    label: "Cancelled by the store",
    when: "Items aren't available, no reply in time, or staff cancelled it. Not when customers cancel themselves.",
    sample: customerSample("denied", "awaiting_availability"),
  },
  {
    key: "customer_payment_confirmed",
    label: "Payment confirmed",
    when: "Off by default: the order page and notifications already show it.",
    sample: customerSample("queued", "pending_payment"),
  },
];

const ADMIN: { key: keyof SmsSettings; label: string; when: string; sample: string }[] = [
  {
    key: "admin_seafood_check",
    label: "New order needs an availability check",
    when: "Website orders with “subject to availability” items. The customer is waiting before they can pay.",
    sample: adminSeafoodCheckText({
      store: SAMPLE_STORE,
      code: "A-012 (WEB-10012)",
      customer: "Maria Santos",
      fulfillment: "delivery",
      total: 849,
      adminUrl: `${site}/admin/orders`,
    }).message,
  },
  {
    key: "admin_payment_to_verify",
    label: "GCash payment to verify",
    when: "When a customer sends their GCash reference number.",
    sample: adminPaymentText({
      store: SAMPLE_STORE,
      code: "A-012 (WEB-10012)",
      amount: 849,
      referenceNo: "1012345678901",
      senderName: "Maria S.",
      adminUrl: `${site}/admin/orders`,
    }).message,
  },
];

const KIND_LABEL: Record<string, string> = {
  ...Object.fromEntries([...CUSTOMER, ...ADMIN].map((t) => [t.key, t.label])),
  test: "Test",
};

function Toggle({ item, settings }: { item: (typeof CUSTOMER)[number]; settings: SmsSettings }) {
  const text = toSmsText(item.sample);
  const parts = smsParts(text);
  return (
    <li className="py-3">
      <Checkbox name={item.key} label={item.label} defaultChecked={Boolean(settings[item.key])} />
      <p className="mt-1 ml-6 text-sm text-stone-600 dark:text-stone-400">{item.when}</p>
      <p className="mt-1 ml-6 rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs break-words text-stone-700 dark:bg-stone-800 dark:text-stone-300">
        {text}
        <span className={parts > 1 ? "ml-2 text-amber-700" : "ml-2 text-stone-400"}>
          · {text.length} chars, {parts} SMS
        </span>
      </p>
    </li>
  );
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

async function TextsContent() {
  const { supabase, storeId } = await requireOwner();
  const ops = supabase.schema("ops");
  const [{ data: settings, error }, { data: log }, { count: sentLast30Days }, status] =
    await Promise.all([
      ops.from("sms_settings").select("*").eq("store_id", storeId).single(),
      ops.from("sms_log").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(30),
      ops
        .from("sms_log")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "sent")
        .gte("created_at", daysAgo(30)),
      getSmsStatus(),
    ]);
  if (error) throw error;
  const mode = smsMode();
  const provider = process.env.SMS_PROVIDER === "philsms" ? "philsms" : "textbee";

  return (
    <>
      <Card title={`Sending through ${smsProviderName()}`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            Mode:{" "}
            {mode === "live" ? (
              <Badge tone="green">Sending texts</Badge>
            ) : mode === "dry_run" ? (
              <Badge tone="amber">Dry run: logged, not sent</Badge>
            ) : (
              <Badge tone="red">Not set up</Badge>
            )}
          </span>
          {status && (
            <span>
              <strong className={status.ok ? "" : "text-red-700 dark:text-red-400"}>
                {status.label}
              </strong>
              {status.detail && <span className="text-stone-500"> · {status.detail}</span>}
            </span>
          )}
          <span className="text-stone-500">
            Sender:{" "}
            {provider === "textbee"
              ? "your phone's own number"
              : process.env.PHILSMS_SENDER_ID || "PhilSMS"}
          </span>
        </div>
        {mode === "no_token" &&
          (provider === "textbee" ? (
            <ol className="mt-3 list-decimal pl-5 text-sm text-stone-600 dark:text-stone-400">
              <li>
                Sign up at textbee.dev and install the textbee app on a spare Android phone with a
                SIM.
              </li>
              <li>
                Sign in to the app with the same account and allow it to send SMS. Keep the phone
                charged and online.
              </li>
              <li>
                Create an API key in the textbee dashboard and set TEXTBEE_API_KEY in the
                server&apos;s environment.
              </li>
              <li>Put an unli-text promo on the SIM so texts don&apos;t eat your load.</li>
            </ol>
          ) : (
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
              Set PHILSMS_API_TOKEN in the server&apos;s environment to send texts.
            </p>
          ))}
      </Card>

      <Card title="When to text">
        <ActionForm action={saveSmsSettings} className="flex flex-col gap-4">
          <Checkbox
            name="enabled"
            label="Send texts (master switch)"
            defaultChecked={settings.enabled}
          />
          <Field
            label="Admin number"
            hint="Gets the admin texts (if switched on below). Leave blank for none."
            className="max-w-xs"
          >
            <Input
              name="admin_phone"
              type="tel"
              inputMode="tel"
              placeholder="09XXXXXXXXX"
              defaultValue={settings.admin_phone ?? ""}
            />
          </Field>

          <div>
            <h3 className="font-medium">To customers (website orders)</h3>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {CUSTOMER.map((item) => (
                <Toggle key={item.key} item={item} settings={settings} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium">To you (admin number)</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Usually not needed: turn on <strong>phone alerts</strong> on the Orders page (on each
              staff phone) and these arrive as free notifications. Payment alerts go to Owner and
              Payments staff only.
            </p>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {ADMIN.map((item) => (
                <Toggle key={item.key} item={item} settings={settings} />
              ))}
            </ul>
          </div>
        </ActionForm>
      </Card>

      <Card
        title="Send a test text"
        description={
          provider === "textbee"
            ? "Sent from your textbee phone's SIM."
            : "Uses one SMS from your balance."
        }
      >
        <ActionForm
          action={sendTestSms}
          submitLabel="Send test"
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Mobile number" className="w-56">
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="09XXXXXXXXX"
              defaultValue={settings.admin_phone ?? ""}
              required
            />
          </Field>
        </ActionForm>
      </Card>

      <Card
        title="Recent texts"
        description={`Last 30 texts (kept for 90 days). ${sentLast30Days ?? 0} sent in the last 30 days.`}
      >
        {!log?.length ? (
          <p className="text-sm text-stone-500">No texts yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {log.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-stone-500">
                    {new Date(l.created_at).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Asia/Manila",
                    })}
                  </span>
                  <strong>{KIND_LABEL[l.kind] ?? l.kind}</strong>
                  <span className="text-stone-500">
                    → 0{l.recipient.slice(2)}
                    {l.order_code && ` · ${l.order_code}`}
                  </span>
                  <Badge
                    tone={l.status === "sent" ? "green" : l.status === "failed" ? "red" : "amber"}
                  >
                    {l.status === "dry_run" ? "dry run" : l.status}
                  </Badge>
                </span>
                <span className="text-stone-600 dark:text-stone-400">{l.message}</span>
                {l.error && <span className="text-red-700 dark:text-red-400">{l.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

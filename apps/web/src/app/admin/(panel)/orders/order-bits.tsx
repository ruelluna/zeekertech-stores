import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui";
import { removeOrder } from "./actions";
import { STATUS_BADGE } from "./order-status";

export function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" as const };
  return (
    <span className="text-sm">
      <Badge tone={b.tone}>{b.label}</Badge>
    </span>
  );
}

/** Owner only: the permanent delete, tucked behind a disclosure with its warning. */
export function RemoveOrder({ orderId, queueCode }: { orderId: string; queueCode: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">Remove order…</summary>
      <p className="mt-2 max-w-sm text-muted">
        This permanently deletes {queueCode}, its payment record and the customer&apos;s order link. You can&apos;t undo it.
      </p>
      <ActionForm action={removeOrder} submitLabel={`Remove ${queueCode}`} danger className="mt-2 flex flex-wrap items-end gap-3">
        <input type="hidden" name="orderId" value={orderId} />
      </ActionForm>
    </details>
  );
}

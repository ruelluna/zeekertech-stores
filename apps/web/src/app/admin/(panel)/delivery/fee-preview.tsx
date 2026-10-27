"use client";

import { useState } from "react";
import { calculateDeliveryFee, type DeliverySettings } from "@wfh/shared";
import { Field, Input, peso } from "@/components/ui";

/** Try distances against the saved rates (uses the same calculator as checkout). */
export function FeePreview({ settings }: { settings: DeliverySettings }) {
  const [km, setKm] = useState("6.4");
  const distanceKm = Number(km);
  const result = km === "" ? null : calculateDeliveryFee({ settings, distanceKm, subtotal: 0 });

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Distance (km)" className="w-32">
        <Input type="number" step="0.1" min="0" value={km} onChange={(e) => setKm(e.target.value)} />
      </Field>
      <p className="pb-2 text-sm" aria-live="polite">
        {result === null
          ? "Enter a distance"
          : result.ok
            ? <>Delivery fee: <strong className="text-base">{peso(result.fee)}</strong></>
            : result.reason === "too_far"
              ? `Too far: the maximum is ${settings.maxKm} km`
              : "Enter a valid distance"}
      </p>
    </div>
  );
}

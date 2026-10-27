"use client";

import { useState } from "react";
import { MapPicker } from "@/components/map-picker";
import { Field, Input } from "@/components/ui";

type LatLng = { lat: number; lng: number };

/** Kitchen location: tap the map or type the numbers. Both stay in sync and submit with the form. */
export function KitchenPin({ initial, fallbackCenter }: { initial: LatLng | null; fallbackCenter: LatLng }) {
  const [pin, setPin] = useState<LatLng | null>(initial);
  const [focus, setFocus] = useState<LatLng>(initial ?? fallbackCenter);
  const [lat, setLat] = useState(initial ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial ? String(initial.lng) : "");

  function fromMap(p: LatLng) {
    setPin(p);
    setLat(p.lat.toFixed(6));
    setLng(p.lng.toFixed(6));
  }

  function fromInputs(nextLat: string, nextLng: string) {
    setLat(nextLat);
    setLng(nextLng);
    const p = { lat: Number(nextLat), lng: Number(nextLng) };
    if (nextLat && nextLng && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      setPin(p);
      setFocus(p);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:col-span-3">
      <MapPicker value={pin} focus={focus} onChange={fromMap} className="h-64 w-full overflow-hidden rounded-xl border border-stone-300 dark:border-stone-700" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude">
          <Input name="kitchen_lat" type="number" step="any" value={lat} onChange={(e) => fromInputs(e.target.value, lng)} />
        </Field>
        <Field label="Longitude">
          <Input name="kitchen_lng" type="number" step="any" value={lng} onChange={(e) => fromInputs(lat, e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

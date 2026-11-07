"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { publicEnv } from "@/lib/supabase/env";

type LatLng = { lat: number; lng: number };


/**
 * Tap or drag to place a pin. Leaflet is loaded in the browser only. `focus` recenters the map
 * (e.g. when a barangay is picked) without moving the pin.
 */
export function MapPicker({
  value,
  focus,
  onChange,
  kitchen,
  className,
}: {
  value: LatLng | null;
  focus: LatLng;
  onChange: (pin: LatLng) => void;
  kitchen?: LatLng | null;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const leaflet = useRef<typeof import("leaflet") | null>(null);

  const pinIcon = (L: typeof import("leaflet")) =>
    L.divIcon({
      className: "",
      html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--accent,#ea580c);border:3px solid white;transform:rotate(-45deg)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !container.current || map.current) return;
      leaflet.current = L;
      const m = L.map(container.current, { zoomControl: true }).setView([focus.lat, focus.lng], value ? 16 : 14);
      const { mapTileUrl, mapAttribution } = publicEnv();
      L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(m);
      if (kitchen) {
        L.circleMarker([kitchen.lat, kitchen.lng], { radius: 6, color: "#57534e", fillOpacity: 0.8 })
          .addTo(m)
          .bindTooltip("Kitchen");
      }
      m.on("click", (e) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      if (value) placeMarker(L, value);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeMarker(L: typeof import("leaflet"), pin: LatLng) {
    if (!map.current) return;
    if (!marker.current) {
      marker.current = L.marker([pin.lat, pin.lng], { draggable: true, icon: pinIcon(L) }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
    } else {
      marker.current.setLatLng([pin.lat, pin.lng]);
    }
  }

  // Follow the pin, and take it off the map when it's cleared.
  useEffect(() => {
    if (value && leaflet.current) placeMarker(leaflet.current, value);
    if (!value) {
      marker.current?.remove();
      marker.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // Recenter when asked.
  useEffect(() => {
    map.current?.setView([focus.lat, focus.lng], Math.max(map.current.getZoom(), 15));
  }, [focus.lat, focus.lng]);

  return <div ref={container} className={className ?? "h-72 w-full overflow-hidden rounded-xl border border-ink-300 dark:border-ink-700"} />;
}

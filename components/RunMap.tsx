"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import type { PlannedStop } from "@/lib/planner";
import type { LatLng } from "@/lib/types";

function pin(label: string, color: string, big = false) {
  const size = big ? 34 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:600 ${big ? 14 : 12}px/1 system-ui;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</div>`,
  });
}

/** Map of the run: driver position, numbered stops, and the road route of the next leg. */
export default function RunMap({ plan, here, nextLine }: { plan: PlannedStop[]; here: LatLng | null; nextLine: [number, number][] | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    map.current = L.map(el.current!, { zoomControl: false, attributionControl: true }).setView([-33.87, 151.21], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map.current);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g || !map.current) return;
    g.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    // Planned order, dotted.
    const order: L.LatLngExpression[] = [...(here ? [[here.lat, here.lng] as [number, number]] : []), ...plan.map((p) => [p.stop.location.lat, p.stop.location.lng] as [number, number])];
    if (order.length > 1) L.polyline(order, { color: "#64748b", weight: 2, dashArray: "4 6" }).addTo(g);

    if (nextLine?.length) L.polyline(nextLine, { color: "#1d4ed8", weight: 5, opacity: 0.85 }).addTo(g);

    plan.forEach((p, i) => {
      const color = p.stop.type === "pickup" ? "#d97706" : "#1d4ed8";
      L.marker([p.stop.location.lat, p.stop.location.lng], { icon: pin(String(i + 1), color, i === 0), zIndexOffset: i === 0 ? 1000 : 0 })
        .bindTooltip(`${i + 1}. ${p.stop.type === "pickup" ? "Pickup" : "Drop-off"}: ${p.job.customerName}`)
        .addTo(g);
      bounds.push([p.stop.location.lat, p.stop.location.lng]);
    });

    if (here) {
      L.marker([here.lat, here.lng], { icon: pin("", "#10b981"), zIndexOffset: 2000 }).bindTooltip("You").addTo(g);
      bounds.push([here.lat, here.lng]);
    }

    if (bounds.length === 1) map.current.setView(bounds[0], 14);
    else if (bounds.length > 1) map.current.fitBounds(L.latLngBounds(bounds), { padding: [36, 36] });
  }, [plan, here, nextLine]);

  return <div ref={el} className="h-full w-full" />;
}

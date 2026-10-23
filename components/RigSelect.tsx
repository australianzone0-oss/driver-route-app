"use client";

import type { Vehicle } from "@/lib/types";

/** Pick a truck or a trailer. Inactive ones only show if already chosen. */
export function RigSelect({
  id,
  kind,
  vehicles,
  value,
  onChange,
}: {
  id: string;
  kind: Vehicle["kind"];
  vehicles: Vehicle[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{kind === "trailer" ? "No trailer" : "No vehicle"}</option>
      {vehicles
        .filter((v) => v.kind === kind && (v.active || v.id === value))
        .map((v) => (
          <option key={v.id} value={v.id}>
            {v.rego}
            {v.description ? ` · ${v.description}` : v.vehicleType ? ` · ${v.vehicleType}` : ""}
          </option>
        ))}
    </select>
  );
}

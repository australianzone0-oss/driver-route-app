"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import { Modal } from "./Modal";
import { RigSelect } from "./RigSelect";

type Rig = { vehicle: Vehicle | null; trailer: Vehicle | null };

/** Driver app: shows today's truck and trailer and lets the driver swap them. */
export function MyRig({ rig, onChange }: { rig: Rig; onChange: (r: Rig) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen(true)}>
        <span className="min-w-0 text-sm">
          <span className="font-semibold">🚚 {rig.vehicle?.rego ?? "No truck"}</span>
          <span className="text-slate-400"> · </span>
          <span className="font-semibold">🚛 {rig.trailer?.rego ?? "No trailer"}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-brand-700">Change</span>
      </button>
      {open && <RigForm rig={rig} onClose={() => setOpen(false)} onSaved={(r) => (onChange(r), setOpen(false))} />}
    </>
  );
}

function RigForm({ rig, onClose, onSaved }: { rig: Rig; onClose: () => void; onSaved: (r: Rig) => void }) {
  const list = useApi<{ vehicles: Vehicle[] }>("/api/vehicles");
  const vehicles = list.data?.vehicles ?? [];
  const [vehicleId, setVehicleId] = useState(rig.vehicle?.id ?? "");
  const [trailerId, setTrailerId] = useState(rig.trailer?.id ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/me", { method: "PATCH", body: { vehicleId: vehicleId || null, trailerId: trailerId || null } });
      const find = (id: string) => vehicles.find((v) => v.id === id) ?? null;
      onSaved({ vehicle: find(vehicleId), trailer: find(trailerId) });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="My truck and trailer" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="rig-vehicle">Truck</label>
          <RigSelect id="rig-vehicle" kind="truck" vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
        </div>
        <div>
          <label className="label" htmlFor="rig-trailer">Trailer</label>
          <RigSelect id="rig-trailer" kind="trailer" vehicles={vehicles} value={trailerId} onChange={setTrailerId} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !list.data}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { RESOURCE_TABS, SubTabs } from "@/components/SubTabs";
import { api, useApi, useMe } from "@/lib/api";
import type { Driver, Vehicle } from "@/lib/types";

const TYPES = ["Van", "Ute", "Small truck", "Rigid truck", "Semi-trailer", "B-double", "Other"];

export default function Vehicles() {
  const me = useMe("admin");
  const vehicles = useApi<{ vehicles: Vehicle[] }>(me ? "/api/vehicles" : null);
  const drivers = useApi<{ drivers: Driver[] }>(me ? "/api/drivers" : null);
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);

  if (!me) return null;
  const list = vehicles.data?.vehicles ?? [];
  const driverOf = (id: string) => (drivers.data?.drivers ?? []).filter((d) => d.vehicleId === id).map((d) => d.name);

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <SubTabs tabs={RESOURCE_TABS} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Vehicles</h1>
            <p className="text-sm text-slate-500">Assign a vehicle to each driver in the Drivers tab.</p>
          </div>
          <button className="btn-primary" onClick={() => setEditing("new")}>
            + Add vehicle
          </button>
        </div>

        {vehicles.data && list.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No vehicles yet.</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((v) => (
              <li key={v.id} className={`card p-4 ${v.active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="inline-block rounded-md border-2 border-slate-800 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">{v.rego}</p>
                    <p className="mt-2 font-semibold">{v.description || "No make or model"}</p>
                    <p className="text-sm text-slate-500">{[v.vehicleType, v.capacity].filter(Boolean).join(" · ") || "No type set"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {driverOf(v.id).length ? `Driver: ${driverOf(v.id).join(", ")}` : "Not assigned"}
                      {!v.active && " · Inactive"}
                    </p>
                  </div>
                  <button className="btn-ghost py-2" onClick={() => setEditing(v)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editing && (
        <VehicleForm
          vehicle={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            vehicles.refresh();
          }}
        />
      )}
    </div>
  );
}

function VehicleForm({ vehicle, onClose, onSaved }: { vehicle: Vehicle | null; onClose: () => void; onSaved: () => void }) {
  const [rego, setRego] = useState(vehicle?.rego ?? "");
  const [description, setDescription] = useState(vehicle?.description ?? "");
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? "Van");
  const [capacity, setCapacity] = useState(vehicle?.capacity ?? "");
  const [notes, setNotes] = useState(vehicle?.notes ?? "");
  const [active, setActive] = useState(vehicle?.active ?? true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const body = { rego, description, vehicleType, capacity, notes, ...(vehicle ? { active } : {}) };
    try {
      if (vehicle) await api(`/api/vehicles/${vehicle.id}`, { method: "PATCH", body });
      else await api("/api/vehicles", { body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={vehicle ? "Edit vehicle" : "Add vehicle"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rego</label>
            <input className="field font-mono uppercase" value={rego} onChange={(e) => setRego(e.target.value)} placeholder="ABC123" required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="field" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Make and model</label>
          <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Isuzu NPR 45-155" />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input className="field" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 4 pallets, 4.5 t" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="field min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tail lift, service due…" />
        </div>
        {vehicle && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            In service
          </label>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : vehicle ? "Save changes" : "Add vehicle"}
        </button>
      </form>
    </Modal>
  );
}

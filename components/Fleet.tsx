"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { RESOURCE_TABS, SubTabs } from "@/components/SubTabs";
import { api, useApi, useMe } from "@/lib/api";
import type { Driver, Vehicle } from "@/lib/types";

type Kind = Vehicle["kind"];

const COPY = {
  truck: {
    title: "Vehicles",
    noun: "vehicle",
    types: ["Prime mover", "Rigid truck", "Small truck", "Van", "Ute", "B-double", "Other"],
    model: "e.g. Kenworth T610",
    capacity: "e.g. 4 pallets, 4.5 t",
  },
  trailer: {
    title: "Trailers",
    noun: "trailer",
    types: ["Skeletal", "Flat top", "Drop deck", "Tautliner", "Side loader", "Refrigerated", "Tipper", "Low loader", "Dolly", "Other"],
    model: "e.g. Krueger 40' skel",
    capacity: "e.g. 1 x 40' or 2 x 20', 34 t",
  },
};

/** Office list of trucks or trailers (Resources tab). */
export function Fleet({ kind }: { kind: Kind }) {
  const me = useMe("admin");
  const vehicles = useApi<{ vehicles: Vehicle[] }>(me ? "/api/vehicles" : null);
  const drivers = useApi<{ drivers: Driver[] }>(me ? "/api/drivers" : null);
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const copy = COPY[kind];

  if (!me) return null;
  const list = (vehicles.data?.vehicles ?? []).filter((v) => v.kind === kind);
  const driverOf = (id: string) =>
    (drivers.data?.drivers ?? []).filter((d) => (kind === "trailer" ? d.trailerId : d.vehicleId) === id).map((d) => d.name);

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <SubTabs tabs={RESOURCE_TABS} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{copy.title}</h1>
            <p className="text-sm text-slate-500">Assign one in the Drivers tab, or drivers can pick their own in the driver app.</p>
          </div>
          <button className="btn-primary" onClick={() => setEditing("new")}>
            + Add {copy.noun}
          </button>
        </div>

        {vehicles.data && list.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No {copy.title.toLowerCase()} yet.</div>
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
          kind={kind}
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

function VehicleForm({ kind: listKind, vehicle, onClose, onSaved }: { kind: Kind; vehicle: Vehicle | null; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<Kind>(vehicle?.kind ?? listKind);
  const copy = COPY[kind];
  const [rego, setRego] = useState(vehicle?.rego ?? "");
  const [description, setDescription] = useState(vehicle?.description ?? "");
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? COPY[listKind].types[0]);
  const [capacity, setCapacity] = useState(vehicle?.capacity ?? "");
  const [notes, setNotes] = useState(vehicle?.notes ?? "");
  const [active, setActive] = useState(vehicle?.active ?? true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const body = { rego, kind, description, vehicleType, capacity, notes, ...(vehicle ? { active } : {}) };
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
    <Modal title={vehicle ? `Edit ${COPY[listKind].noun}` : `Add ${COPY[listKind].noun}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Truck or trailer">
          {(["truck", "trailer"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`rounded-lg py-2 text-sm font-semibold ${kind === k ? "bg-white shadow" : "text-slate-500"}`}
              onClick={() => {
                setKind(k);
                // Swap a standard type for the other list's default; keep anything custom.
                const other = COPY[k === "truck" ? "trailer" : "truck"].types;
                if (other.includes(vehicleType) && !COPY[k].types.includes(vehicleType)) setVehicleType(COPY[k].types[0]);
              }}
            >
              {k === "truck" ? "🚚 Truck" : "🚛 Trailer"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rego</label>
            <input className="field font-mono uppercase" value={rego} onChange={(e) => setRego(e.target.value)} placeholder="ABC123" required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="field" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {[...copy.types, ...(copy.types.includes(vehicleType) ? [] : [vehicleType])].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Make and model</label>
          <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={copy.model} />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input className="field" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={copy.capacity} />
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
          {busy ? "Saving…" : vehicle ? "Save changes" : `Add ${copy.noun}`}
        </button>
      </form>
    </Modal>
  );
}

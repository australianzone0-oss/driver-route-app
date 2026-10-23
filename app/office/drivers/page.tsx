"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { RESOURCE_TABS, SubTabs } from "@/components/SubTabs";
import { api, useApi, useMe } from "@/lib/api";
import { formatPhone } from "@/lib/phone";
import type { Driver, Me, Vehicle } from "@/lib/types";

const newPin = () => String(Math.floor(100000 + Math.random() * 900000));

type Shared = { name: string; phone: string; pin: string };

export default function DriversPage() {
  return (
    <Suspense>
      <Drivers />
    </Suspense>
  );
}

function Drivers() {
  const me = useMe("admin");
  const welcome = useSearchParams().get("welcome");
  const drivers = useApi<{ drivers: Driver[] }>(me ? "/api/drivers" : null);
  const vehicles = useApi<{ vehicles: Vehicle[] }>(me ? "/api/vehicles" : null);
  const [editing, setEditing] = useState<Driver | "new" | null>(null);
  const [shared, setShared] = useState<Shared | null>(null);

  if (!me) return null;
  const list = drivers.data?.drivers ?? [];
  const vlist = vehicles.data?.vehicles ?? [];
  const rego = (id: string | null) => vlist.find((v) => v.id === id)?.rego;

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <SubTabs tabs={RESOURCE_TABS} />
        {welcome && list.length === 0 && (
          <div className="card border-l-4 border-brand-600 p-4">
            <p className="font-semibold">Welcome to RouteRun</p>
            <p className="mt-1 text-sm text-slate-600">
              Your portal is <PortalLink me={me} />. Add your vehicles and drivers, then create jobs from the Jobs tab.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Drivers</h1>
            <p className="text-sm text-slate-500">
              Drivers log in at <PortalLink me={me} /> with their mobile number and PIN.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setEditing("new")}>
            + Add driver
          </button>
        </div>

        {drivers.data && list.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No drivers yet. Add your first driver.</div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {list.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                  {d.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {d.name} {!d.active && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Inactive</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatPhone(d.phone)}
                    {rego(d.vehicleId) && ` · 🚚 ${rego(d.vehicleId)}`}
                    {d.licenceNumber && ` · Licence ${d.licenceNumber}`}
                  </p>
                </div>
                <button className="btn-ghost py-2" onClick={() => setEditing(d)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editing && (
        <DriverForm
          driver={editing === "new" ? null : editing}
          vehicles={vlist}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setEditing(null);
            drivers.refresh();
            if (s) setShared(s);
          }}
        />
      )}
      {shared && <ShareLogin me={me} shared={shared} onClose={() => setShared(null)} />}
    </div>
  );
}

function PortalLink({ me }: { me: Me }) {
  const url = typeof window === "undefined" ? `/c/${me.company.slug}` : `${window.location.origin}/c/${me.company.slug}`;
  return <span className="font-semibold text-slate-800">{url.replace(/^https?:\/\//, "")}</span>;
}

function DriverForm({ driver, vehicles, onClose, onSaved }: { driver: Driver | null; vehicles: Vehicle[]; onClose: () => void; onSaved: (s?: Shared) => void }) {
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver ? formatPhone(driver.phone) : "");
  const [vehicleId, setVehicleId] = useState(driver?.vehicleId ?? "");
  const [licence, setLicence] = useState(driver?.licenceNumber ?? "");
  const [active, setActive] = useState(driver?.active ?? true);
  const [pin, setPin] = useState(driver ? "" : newPin());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const body = { name, phone, vehicleId: vehicleId || null, licenceNumber: licence, ...(driver ? { active } : {}), ...(pin ? { pin } : {}) };
    try {
      const r = driver
        ? await api<{ driver: Driver }>(`/api/drivers/${driver.id}`, { method: "PATCH", body })
        : await api<{ driver: Driver }>("/api/drivers", { body });
      onSaved(pin ? { name: r.driver.name, phone: r.driver.phone, pin } : undefined);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={driver ? "Edit driver" : "Add driver"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Mobile number (their login)</label>
          <input className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0412 345 678" required />
        </div>
        <div>
          <label className="label">Vehicle</label>
          <select className="field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">No vehicle</option>
            {vehicles
              .filter((v) => v.active || v.id === vehicleId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.rego}
                  {v.description ? ` · ${v.description}` : ""}
                </option>
              ))}
          </select>
          {vehicles.length === 0 && <p className="mt-1 text-xs text-slate-500">Add vehicles in the Vehicles tab.</p>}
        </div>
        <div>
          <label className="label">Licence number</label>
          <input className="field" value={licence} onChange={(e) => setLicence(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">{driver ? "New PIN (leave blank to keep)" : "PIN"}</label>
          <div className="flex gap-2">
            <input
              className="field tracking-[0.3em]"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder={driver ? "••••••" : ""}
              required={!driver}
            />
            <button type="button" className="btn-ghost shrink-0 py-2" onClick={() => setPin(newPin())}>
              Generate
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">6 digits. You&apos;ll see it once to send to the driver.</p>
        </div>
        {driver && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (can log in and get jobs)
          </label>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : driver ? "Save changes" : "Add driver"}
        </button>
      </form>
    </Modal>
  );
}

function ShareLogin({ me, shared, onClose }: { me: Me; shared: Shared; onClose: () => void }) {
  const url = `${window.location.origin}/c/${me.company.slug}`;
  const text = `Hi ${shared.name.split(" ")[0]}, log in to ${me.company.name} on RouteRun: ${url}\nMobile: ${formatPhone(shared.phone)}\nPIN: ${shared.pin}`;
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Send login details" onClose={onClose}>
      <p className="text-sm text-slate-600">Send these to {shared.name}. The PIN won&apos;t be shown again.</p>
      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">{text}</pre>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a className="btn-primary" href={`sms:${shared.phone}?&body=${encodeURIComponent(text)}`}>
          Send by SMS
        </a>
        <button
          className="btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Modal>
  );
}

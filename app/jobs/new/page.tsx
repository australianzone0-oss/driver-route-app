"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ExtractedJob } from "@/app/api/extract/route";
import { AddressInput, geocodeFirst, type AddressValue } from "@/components/AddressInput";
import { AppHeader } from "@/components/AppHeader";
import { DocDrop } from "@/components/DocDrop";
import { actions, uid, useStore } from "@/lib/store";
import type { Attachment, Job, Stop } from "@/lib/types";

const empty: AddressValue = { address: "", location: null };

export default function NewJob() {
  const { session, drivers, ready } = useStore();
  const router = useRouter();
  const isOffice = session?.role === "office";

  const [driverId, setDriverId] = useState("");
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notify, setNotify] = useState(true);
  const [notes, setNotes] = useState("");
  const [hasPickup, setHasPickup] = useState(true);
  const [pickup, setPickup] = useState<AddressValue>(empty);
  const [dropoff, setDropoff] = useState<AddressValue>(empty);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace("/");
    else setDriverId((d) => d || (session.role === "driver" ? session.driverId : drivers[0]?.id ?? ""));
  }, [ready, session, drivers, router]);

  async function fill(f: ExtractedJob) {
    if (f.reference) setReference(f.reference);
    if (f.customerName) setCustomerName(f.customerName);
    if (f.customerEmail) setCustomerEmail(f.customerEmail);
    if (f.customerPhone) setCustomerPhone(f.customerPhone);
    if (f.notes) setNotes(f.notes);
    setHasPickup(Boolean(f.pickupAddress));
    // Look up each address so it lands on the map; the driver can still correct it.
    const [p, d] = await Promise.all([
      f.pickupAddress ? geocodeFirst(f.pickupAddress) : null,
      f.dropoffAddress ? geocodeFirst(f.dropoffAddress) : null,
    ]);
    if (f.pickupAddress) setPickup({ address: p?.label ?? f.pickupAddress, location: p ? { lat: p.lat, lng: p.lng } : null });
    if (f.dropoffAddress) setDropoff({ address: d?.label ?? f.dropoffAddress, location: d ? { lat: d.lat, lng: d.lng } : null });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) return setError("Add the customer name.");
    if (!dropoff.location) return setError("Pick the drop-off address from the list so it can go on the map.");
    if (hasPickup && !pickup.location) return setError("Pick the pickup address from the list, or turn off pickup.");
    if (!driverId) return setError("Choose a driver.");

    const id = uid();
    const stops: Stop[] = [];
    if (hasPickup && pickup.location) stops.push({ id: `${id}-p`, jobId: id, type: "pickup", address: pickup.address, location: pickup.location, status: "pending" });
    stops.push({ id: `${id}-d`, jobId: id, type: "dropoff", address: dropoff.address, location: dropoff.location, status: "pending" });

    const job: Job = {
      id,
      reference: reference.trim() || undefined,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      notifyOnComplete: notify,
      notes: notes.trim() || undefined,
      driverId,
      createdBy: isOffice ? "office" : "driver",
      createdAt: new Date().toISOString(),
      status: "pending",
      stops,
      attachments,
      notices: [],
    };
    actions.addJob(job);
    router.push(isOffice ? "/office" : "/run");
  }

  if (!ready || !session) return null;

  return (
    <div className="min-h-dvh">
      <AppHeader title="New job" back={isOffice ? "/office" : "/run"} />
      <form onSubmit={save} className="mx-auto max-w-xl space-y-4 px-4 pb-32 pt-4">
        <section className="card p-4">
          <DocDrop onFields={fill} onAttach={(a) => setAttachments((list) => [...list, a])} />
          {attachments.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              {attachments.map((a, i) => (
                <li key={i}>📎 {a.name}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="text-sm font-bold text-slate-700">Job details</h2>
          {isOffice && (
            <div>
              <label className="label">Assign to driver</label>
              <select className="field" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">
                Customer<span className="text-red-500"> *</span>
              </label>
              <input className="field" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Business or person" />
            </div>
            <div>
              <label className="label">Reference</label>
              <input className="field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Consignment no." />
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Route</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={hasPickup} onChange={(e) => setHasPickup(e.target.checked)} className="h-4 w-4" />
              Has a pickup
            </label>
          </div>
          {hasPickup && <AddressInput label="Pickup address" value={pickup} onChange={setPickup} required />}
          <AddressInput label="Drop-off address" value={dropoff} onChange={setDropoff} required />
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="text-sm font-bold text-slate-700">Completion notice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Customer email</label>
              <input className="field" type="email" inputMode="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Customer mobile</label>
              <input className="field" type="tel" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional, e.g. 0412 345 678" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4" />
            Send a notice when the job is complete (to whichever is filled in)
          </label>
          <div>
            <label className="label">Notes for driver</label>
            <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, item count, handling…" />
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-[900] border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-xl">
            {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full">
              Save job
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

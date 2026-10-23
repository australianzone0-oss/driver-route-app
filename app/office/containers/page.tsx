"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { RecordForm } from "@/components/RecordForm";
import { api, useApi, useMe } from "@/lib/api";
import { CONTAINER_STATUS, containerFields, type Container, type Customer } from "@/lib/records";

const statusLabel = Object.fromEntries(CONTAINER_STATUS.map((s) => [s.value, s.label]));
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—");

function daysUntil(d: string) {
  return Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86400000);
}

export default function Containers() {
  const me = useMe("admin");
  const list = useApi<{ items: Container[] }>(me ? "/api/containers" : null);
  const customers = useApi<{ items: Customer[] }>(me ? "/api/customers" : null);
  const [editing, setEditing] = useState<Container | "new" | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"open" | "held" | "dehire" | "all">("open");

  const custName = (id: string | null) => customers.data?.items.find((c) => c.id === id)?.name;
  const items = useMemo(() => {
    const term = q.trim().toUpperCase();
    return (list.data?.items ?? []).filter((k) => {
      if (term && !k.containerNumber.includes(term) && !(k.vessel ?? "").toUpperCase().includes(term)) return false;
      if (view === "open") return k.status !== "returned";
      if (view === "held") return k.held && k.status !== "returned";
      if (view === "dehire") return k.status !== "returned" && k.dehireDate != null && daysUntil(k.dehireDate) <= 3;
      return true;
    });
  }, [list.data, q, view]);

  if (!me) return null;

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Containers</h1>
            <p className="text-sm text-slate-500">Track wharf dates, holds and when each empty has to be dehired.</p>
          </div>
          <button className="btn-primary" onClick={() => setEditing("new")}>
            + Add container
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input className="field max-w-xs font-mono uppercase" placeholder="Container or vessel" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field w-auto" value={view} onChange={(e) => setView(e.target.value as typeof view)} aria-label="Show">
            <option value="open">Not yet returned</option>
            <option value="held">On hold</option>
            <option value="dehire">Dehire due in 3 days</option>
            <option value="all">All containers</option>
          </select>
        </div>

        {list.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{list.error}</p>}
        {list.data && items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">{list.data.items.length ? "No containers match." : "No containers yet."}</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Container</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Where</th>
                  <th className="px-4 py-3">Wharf</th>
                  <th className="px-4 py-3">Dehire by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((k) => {
                  const due = k.dehireDate && k.status !== "returned" ? daysUntil(k.dehireDate) : null;
                  return (
                    <tr key={k.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold tracking-wide">{k.containerNumber}</p>
                        <p className="text-xs text-slate-500">
                          {[k.size && `${k.size}'`, k.containerType, k.fullEmpty === "full" ? "Full" : "Empty", k.movement === "import" ? "Import" : "Export"]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </td>
                      <td className="px-4 py-3">{custName(k.customerId) ?? "—"}</td>
                      <td className="px-4 py-3">
                        {statusLabel[k.status]}
                        {k.held && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700" title={k.holdReason ?? undefined}>
                            ⚠ Held
                          </span>
                        )}
                        {k.vessel && <p className="text-xs text-slate-500">{[k.vessel, k.voyage].filter(Boolean).join(" / ")}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {k.wharfPickupDate && <p>Pickup {fmt(k.wharfPickupDate)}</p>}
                        {k.wharfDropoffDate && <p>Drop-off {fmt(k.wharfDropoffDate)}</p>}
                        {!k.wharfPickupDate && !k.wharfDropoffDate && "—"}
                      </td>
                      <td className="px-4 py-3">
                        {fmt(k.dehireDate)}
                        {due != null && due <= 3 && (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${due < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                            {due < 0 ? `⚠ ${-due}d overdue` : due === 0 ? "Today" : `${due}d left`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="btn-ghost py-1.5" onClick={() => setEditing(k)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && (
        <Modal title={editing === "new" ? "Add container" : `Container ${editing.containerNumber}`} onClose={() => setEditing(null)}>
          <RecordForm
            fields={containerFields}
            initial={editing === "new" ? null : editing}
            customers={(customers.data?.items ?? []).filter((c) => c.active)}
            submitLabel={editing === "new" ? "Add container" : "Save changes"}
            onSubmit={async (body) => {
              if (editing === "new") await api("/api/containers", { body });
              else await api(`/api/containers/${editing.id}`, { method: "PATCH", body });
              setEditing(null);
              list.refresh();
            }}
            extra={
              editing !== "new" && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm(`Delete container ${editing.containerNumber}?`)) return;
                    await api(`/api/containers/${editing.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
                    setEditing(null);
                    list.refresh();
                  }}
                >
                  Delete container
                </button>
              )
            }
          />
        </Modal>
      )}
    </div>
  );
}

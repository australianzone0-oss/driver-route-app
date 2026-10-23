"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Modal } from "@/components/Modal";
import { RecordForm } from "@/components/RecordForm";
import { api, useApi, useMe } from "@/lib/api";
import { customerFields, money, type Customer } from "@/lib/records";

export default function Customers() {
  const me = useMe("admin");
  const list = useApi<{ items: Customer[] }>(me ? "/api/customers" : null);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [q, setQ] = useState("");
  const [holdOnly, setHoldOnly] = useState(false);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list.data?.items ?? []).filter(
      (c) =>
        (!holdOnly || c.creditHold) &&
        (!term || [c.name, c.contactName, c.email, c.phone, c.abn].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [list.data, q, holdOnly]);

  if (!me) return null;

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Customers</h1>
            <p className="text-sm text-slate-500">Link jobs and containers to customers, then invoice them from Finance.</p>
          </div>
          <button className="btn-primary" onClick={() => setEditing("new")}>
            + Add customer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input className="field max-w-xs" placeholder="Search name, contact, phone, ABN" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={holdOnly} onChange={(e) => setHoldOnly(e.target.checked)} />
            Credit hold only
          </label>
        </div>

        {list.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{list.error}</p>}
        {list.data && items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">{list.data.items.length ? "No customers match." : "No customers yet."}</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Terms</th>
                  <th className="px-4 py-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className={`border-b border-slate-100 last:border-0 ${c.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-slate-500">{[c.abn && `ABN ${c.abn}`, c.address].filter(Boolean).join(" · ")}</p>
                      {c.deliveryAddress && <p className="text-xs text-slate-500">Deliver to: {c.deliveryAddress}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p>{c.contactName}</p>
                      <p className="text-xs text-slate-500">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.defaultRate != null ? money(c.defaultRate) : "—"}</td>
                    <td className="px-4 py-3">{c.paymentTermsDays != null ? `${c.paymentTermsDays} days` : "Default"}</td>
                    <td className="px-4 py-3">
                      {c.creditHold ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠ Credit hold</span>
                      ) : c.active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost py-1.5" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && (
        <Modal title={editing === "new" ? "Add customer" : "Edit customer"} onClose={() => setEditing(null)}>
          <RecordForm
            fields={customerFields}
            initial={editing === "new" ? null : editing}
            submitLabel={editing === "new" ? "Add customer" : "Save changes"}
            onSubmit={async (body) => {
              if (editing === "new") await api("/api/customers", { body });
              else await api(`/api/customers/${editing.id}`, { method: "PATCH", body });
              setEditing(null);
              list.refresh();
            }}
            extra={
              editing !== "new" && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm(`Delete ${editing.name}? Jobs keep the customer name.`)) return;
                    try {
                      await api(`/api/customers/${editing.id}`, { method: "DELETE" });
                      setEditing(null);
                      list.refresh();
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  }}
                >
                  Delete customer
                </button>
              )
            }
          />
        </Modal>
      )}
    </div>
  );
}

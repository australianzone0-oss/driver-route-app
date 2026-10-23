"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, useApi, useMe } from "@/lib/api";
import { invoiceBadge, type InvoiceRow } from "@/lib/invoices";
import { money } from "@/lib/records";
import { Tile } from "@/components/Tile";

type ReadyJob = {
  id: string;
  reference: string | null;
  customerName: string;
  customerId: string | null;
  price: number | null;
  priceFromDefault: boolean;
  address: string | null;
  completedOn: string | null;
  containerNumber: string | null;
};

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function Finance() {
  const me = useMe("admin");
  const router = useRouter();
  const ready = useApi<{ jobs: ReadyJob[] }>(me ? "/api/finance/ready" : null);
  const invoices = useApi<{ invoices: InvoiceRow[] }>(me ? "/api/invoices" : null);
  const [tab, setTab] = useState<"ready" | "invoices">("ready");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; customerId: string | null; name: string; jobs: ReadyJob[] }>();
    for (const j of ready.data?.jobs ?? []) {
      const key = j.customerId ?? `name:${j.customerName.toLowerCase()}`;
      if (!m.has(key)) m.set(key, { key, customerId: j.customerId, name: j.customerName, jobs: [] });
      m.get(key)!.jobs.push(j);
    }
    return [...m.values()].sort((a, b) => Number(!a.customerId) - Number(!b.customerId) || a.name.localeCompare(b.name));
  }, [ready.data]);

  const inv = invoices.data?.invoices ?? [];
  const readyValue = (ready.data?.jobs ?? []).reduce((s, j) => s + (j.price ?? 0), 0);
  const unpaid = inv.filter((i) => i.status === "sent");
  const overdue = unpaid.filter((i) => i.overdue);
  const month = new Date().toISOString().slice(0, 7);
  const paidMonth = inv.filter((i) => i.status === "paid" && i.issueDate.startsWith(month));

  if (!me) return null;

  async function run(fn: () => Promise<unknown>) {
    setError(undefined);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setPrice(j: ReadyJob, value: string) {
    if (value === String(j.price ?? "")) return;
    await run(() => api(`/api/jobs/${j.id}`, { method: "PATCH", body: { price: value } }));
    ready.refresh();
  }

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <h1 className="text-xl font-bold">Finance</h1>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Completed, not invoiced" value={String(ready.data?.jobs.length ?? "–")} sub={money(readyValue)} tone="blue" />
          <Tile label="Unpaid invoices" value={money(unpaid.reduce((s, i) => s + i.total, 0))} sub={`${unpaid.length} sent`} tone="slate" />
          <Tile label="Overdue" value={money(overdue.reduce((s, i) => s + i.total, 0))} sub={`${overdue.length} invoices`} tone={overdue.length ? "red" : "slate"} />
          <Tile label="Paid (issued this month)" value={money(paidMonth.reduce((s, i) => s + i.total, 0))} sub={`${paidMonth.length} invoices`} tone="green" />
        </div>

        <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {(["ready", "invoices"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {t === "ready" ? "Ready to invoice" : "Invoices"}
            </button>
          ))}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {tab === "ready" ? (
          groups.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">{ready.data ? "Every completed job is invoiced." : "Loading…"}</div>
          ) : (
            groups.map((g) => {
              const chosen = g.jobs.filter((j) => picked[j.id] ?? true);
              const total = chosen.reduce((s, j) => s + (j.price ?? 0), 0);
              return (
                <section key={g.key} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-semibold">{g.name}</p>
                      {!g.customerId && <p className="text-xs text-amber-700">No customer account with this name yet.</p>}
                    </div>
                    {g.customerId ? (
                      <button
                        className="btn-primary py-2"
                        disabled={busy || !chosen.length}
                        onClick={() =>
                          run(async () => {
                            const r = await api<{ id: string }>("/api/invoices", { body: { customerId: g.customerId, jobIds: chosen.map((j) => j.id) } });
                            router.push(`/office/finance/invoices/${r.id}`);
                          })
                        }
                      >
                        Create invoice · {chosen.length} {chosen.length === 1 ? "job" : "jobs"} · {money(total)}
                      </button>
                    ) : (
                      <button
                        className="btn-ghost py-2"
                        disabled={busy}
                        onClick={() => run(async () => { await api("/api/customers", { body: { name: g.name } }); ready.refresh(); })}
                      >
                        Create customer account
                      </button>
                    )}
                  </div>
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {g.jobs.map((j) => (
                        <tr key={j.id} className="border-b border-slate-100 last:border-0">
                          <td className="w-10 px-4 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              aria-label="Include on invoice"
                              disabled={!g.customerId}
                              checked={picked[j.id] ?? true}
                              onChange={(e) => setPicked((p) => ({ ...p, [j.id]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <p>{[j.reference && `Ref ${j.reference}`, j.containerNumber].filter(Boolean).join(" · ") || "Delivery"}</p>
                            <p className="text-xs text-slate-500">{[fmt(j.completedOn), j.address].filter(Boolean).join(" · ")}</p>
                          </td>
                          <td className="w-40 px-4 py-2">
                            <input
                              key={`${j.id}-${j.price}`}
                              className={`field py-1.5 text-right tabular-nums ${j.price == null ? "border-amber-400" : ""}`}
                              inputMode="decimal"
                              aria-label="Price ex GST"
                              placeholder="Price"
                              defaultValue={j.price ?? ""}
                              onBlur={(e) => setPrice(j, e.target.value)}
                            />
                            {j.priceFromDefault && j.price != null && <p className="mt-0.5 text-right text-[11px] text-slate-500">customer rate</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              );
            })
          )
        ) : inv.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No invoices yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {inv.map((i) => {
                  const b = invoiceBadge(i);
                  return (
                    <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/office/finance/invoices/${i.id}`} className="text-brand-700 hover:underline">
                          {i.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{i.customerName}</td>
                      <td className="px-4 py-3">{fmt(i.issueDate)}</td>
                      <td className="px-4 py-3">{fmt(i.dueDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(i.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

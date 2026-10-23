"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { dayLabel, TimeChart } from "@/components/Charts";
import { Tile } from "@/components/Tile";
import { useApi, useMe } from "@/lib/api";
import { money } from "@/lib/records";

type Dash = {
  jobs: { pending: number; inProgress: number; completedToday: number; driversOnRoad: number; activeDrivers: number };
  containers: { held: number; dehireDue: number; dehireOverdue: number; atWharf: number; active: number };
  finance: { notInvoiced: number; notInvoicedValue: number; unpaid: number; overdue: number; overdueValue: number; drafts: number };
  customers: { creditHold: number; active: number };
  pickups: { date: string; count: number }[];
  dropoffs: { date: string; count: number }[];
  dehires: { id: string; containerNumber: string; dehireDate: string; customerName: string | null }[];
  recent: { id: string; customerName: string; driverName: string; completedAt: string }[];
};

export default function Dashboard() {
  const me = useMe("admin");
  const dash = useApi<Dash>(me ? "/api/dashboard" : null, 60000);
  if (!me) return null;
  const d = dash.data;
  const series = (rows: { date: string; count: number }[] = []) => rows.map((r) => ({ label: dayLabel(r.date), value: r.count }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <Link href="/jobs/new" className="btn-primary py-2">
            + New job
          </Link>
        </div>
        {dash.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{dash.error}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Dehire reminders"
            value={d ? String(d.containers.dehireDue) : "–"}
            sub={d?.containers.dehireOverdue ? `⚠ ${d.containers.dehireOverdue} overdue` : "Due in the next 3 days"}
            tone={d?.containers.dehireOverdue ? "red" : "blue"}
            href="/office/containers"
          />
          <Tile
            label="Completed jobs not invoiced"
            value={d ? String(d.finance.notInvoiced) : "–"}
            sub={d ? money(d.finance.notInvoicedValue) : undefined}
            tone="green"
            href="/office/finance"
          />
          <Tile label="Customers on credit hold" value={d ? String(d.customers.creditHold) : "–"} sub={d ? `of ${d.customers.active} active` : undefined} tone="green" href="/office/customers" />
          <Tile label="Held containers" value={d ? String(d.containers.held) : "–"} sub={d ? `${d.containers.atWharf} at the wharf` : undefined} tone="blue" href="/office/containers" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="card p-4">
            <h2 className="text-sm font-bold">Wharf pickups, next 7 days</h2>
            {d && <TimeChart data={series(d.pickups)} kind="bar" label="Wharf pickups per day for the next 7 days" />}
          </section>
          <section className="card p-4">
            <h2 className="text-sm font-bold">Wharf drop-offs, next 7 days</h2>
            {d && <TimeChart data={series(d.dropoffs)} kind="bar" label="Wharf drop-offs per day for the next 7 days" />}
          </section>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Jobs waiting" value={d ? String(d.jobs.pending) : "–"} href="/office/jobs" />
          <Tile label="In progress" value={d ? String(d.jobs.inProgress) : "–"} sub={d ? `${d.jobs.driversOnRoad} of ${d.jobs.activeDrivers} drivers on the road` : undefined} href="/office/jobs" />
          <Tile label="Completed today" value={d ? String(d.jobs.completedToday) : "–"} href="/office/jobs" />
          <Tile
            label="Unpaid invoices"
            value={d ? money(d.finance.unpaid) : "–"}
            sub={d?.finance.overdue ? `⚠ ${d.finance.overdue} overdue (${money(d.finance.overdueValue)})` : d ? `${d.finance.drafts} drafts` : undefined}
            tone={d?.finance.overdue ? "red" : "slate"}
            href="/office/finance"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold">Dehire due</h2>
            {d && d.dehires.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No empties due back in the next 3 days.</p>}
            <ul className="divide-y divide-slate-100 text-sm">
              {d?.dehires.map((k) => (
                <li key={k.id} className="flex justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono font-semibold">{k.containerNumber}</span>
                    {k.customerName && <span className="text-slate-500"> · {k.customerName}</span>}
                  </span>
                  <span className={k.dehireDate < today ? "font-semibold text-red-600" : "text-slate-600"}>
                    {k.dehireDate < today && "⚠ "}
                    {dayLabel(k.dehireDate)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold">Recently completed</h2>
            {d && d.recent.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No completed jobs yet.</p>}
            <ul className="divide-y divide-slate-100 text-sm">
              {d?.recent.map((j) => (
                <li key={j.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {j.customerName} <span className="text-slate-500">· {j.driverName}</span>
                  </span>
                  <span className="text-slate-600">{new Date(j.completedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

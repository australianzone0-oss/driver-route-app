"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { dayLabel, monthLabel, RankBars, TimeChart } from "@/components/Charts";
import { Tile } from "@/components/Tile";
import { useApi, useMe } from "@/lib/api";
import { money } from "@/lib/records";

type Data = {
  days: number;
  jobsPerDay: { date: string; count: number }[];
  revenueByMonth: { month: string; amount: number }[];
  byDriver: { name: string; count: number }[];
  topCustomers: { name: string; amount: number }[];
  totals: { completed: number; avgPrice: number; invoiced: number };
};

const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);

export default function Analytics() {
  const me = useMe("admin");
  const [days, setDays] = useState(30);
  const a = useApi<Data>(me ? `/api/analytics?days=${days}` : null);
  if (!me) return null;
  const d = a.data;

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Analytics</h1>
          <select className="field w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        </div>
        {a.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{a.error}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile label="Jobs completed" value={d ? String(d.totals.completed) : "–"} tone="blue" />
          <Tile label="Invoiced (ex GST)" value={d ? money(d.totals.invoiced) : "–"} tone="green" />
          <Tile label="Average job price" value={d ? money(d.totals.avgPrice) : "–"} />
        </div>

        <section className="card p-4">
          <h2 className="text-sm font-bold">Jobs completed per day</h2>
          {d && (
            <TimeChart
              data={d.jobsPerDay.map((r) => ({ label: dayLabel(r.date), value: r.count }))}
              kind={d.jobsPerDay.length > 60 ? "line" : "bar"}
              label="Jobs completed per day"
            />
          )}
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="card p-4">
            <h2 className="text-sm font-bold">Invoiced per month (ex GST, last 6 months)</h2>
            {d && <TimeChart data={d.revenueByMonth.map((r) => ({ label: monthLabel(r.month), value: r.amount }))} kind="bar" format={short} label="Invoiced per month" />}
          </section>
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Top customers by invoiced value</h2>
            {d && <RankBars data={d.topCustomers.map((r) => ({ label: r.name, value: r.amount }))} format={money} empty="No invoices in this period." />}
          </section>
        </div>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">Jobs completed by driver</h2>
          {d && <RankBars data={d.byDriver.map((r) => ({ label: r.name, value: r.count }))} empty="No completed jobs in this period." />}
        </section>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, useApi, useMe } from "@/lib/api";
import { money } from "@/lib/records";
import type { Driver, Job, Vehicle } from "@/lib/types";

const statusStyle: Record<Job["status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
};
const statusLabel: Record<Job["status"], string> = { pending: "Pending", in_progress: "In progress", completed: "Completed" };

export default function OfficeJobs() {
  const me = useMe("admin");
  const jobsApi = useApi<{ jobs: Job[] }>(me ? "/api/jobs" : null, 15000);
  const driversApi = useApi<{ drivers: Driver[] }>(me ? "/api/drivers" : null);
  const vehiclesApi = useApi<{ vehicles: Vehicle[] }>(me ? "/api/vehicles" : null);
  const jobs = useMemo(() => jobsApi.data?.jobs ?? [], [jobsApi.data]);
  const allDrivers = driversApi.data?.drivers ?? [];
  const drivers = allDrivers.filter((d) => d.active);
  const nameOf = (id: string) => allDrivers.find((d) => d.id === id)?.name ?? "Unknown driver";
  const regoOf = (id: string | null) => vehiclesApi.data?.vehicles.find((v) => v.id === id)?.rego;
  const [error, setError] = useState<string>();
  const [driverFilter, setDriverFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Job["status"]>("all");

  async function run(fn: () => Promise<unknown>) {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    jobsApi.refresh();
  }

  const shown = useMemo(
    () => jobs.filter((j) => (driverFilter === "all" || j.driverId === driverFilter) && (statusFilter === "all" || j.status === statusFilter)),
    [jobs, driverFilter, statusFilter],
  );

  if (!me) return null;

  const counts = (id: string) => {
    const mine = jobs.filter((j) => j.driverId === id);
    return { open: mine.filter((j) => j.status !== "completed").length, done: mine.filter((j) => j.status === "completed").length };
  };

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {drivers.length === 0 && driversApi.data && (
            <Link href="/office/drivers" className="card p-4 text-sm text-slate-600 hover:bg-slate-50">
              <p className="font-semibold text-slate-800">No drivers yet</p>
              Add drivers before creating jobs →
            </Link>
          )}
          {drivers.map((d) => {
            const c = counts(d.id);
            return (
              <div key={d.id} className="card p-4">
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-slate-500">{regoOf(d.vehicleId) ? `🚚 ${regoOf(d.vehicleId)}` : "No vehicle"}</p>
                <p className="mt-1 text-2xl font-bold">
                  {c.open} <span className="text-sm font-medium text-slate-500">open</span>
                </p>
                <p className="text-xs text-slate-500">{c.done} completed</p>
              </div>
            );
          })}
          <Link href="/jobs/new" className="card flex items-center justify-center p-4 font-semibold text-brand-600 hover:bg-brand-50">
            + New job
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
            <option value="all">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <div className="ml-auto flex gap-2">
            <button
              className="btn-ghost py-2"
              disabled={!drivers.length}
              onClick={() => run(() => api("/api/jobs/sample", { body: { driverId: driverFilter === "all" ? drivers[0].id : driverFilter } }))}
            >
              Load sample jobs
            </button>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {shown.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No jobs to show.</div>
        ) : (
          <ul className="space-y-2">
            {shown.map((j) => {
              const drop = j.stops.find((s) => s.type === "dropoff");
              const pickup = j.stops.find((s) => s.type === "pickup");
              return (
                <li key={j.id} className="card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{j.customerName}</span>
                        {j.reference && <span className="text-xs text-slate-500">Ref {j.reference}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[j.status]}`}>{statusLabel[j.status]}</span>
                        {j.createdBy === "driver" && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Added by driver</span>}
                        {j.price != null && <span className="text-xs tabular-nums text-slate-500">{money(j.price)} ex GST</span>}
                        {j.invoiceId && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Invoiced</span>}
                      </div>
                      {pickup && (
                        <p className="mt-1 truncate text-sm text-slate-600">
                          <span className="font-medium text-amber-700">From</span> {pickup.address} {pickup.status === "done" && "✓"}
                        </p>
                      )}
                      {drop && (
                        <p className="truncate text-sm text-slate-600">
                          <span className="font-medium text-brand-700">To</span> {drop.address} {drop.status === "done" && "✓"}
                        </p>
                      )}
                      {drop?.completedAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Completed {new Date(drop.completedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                          {drop.receivedBy && ` · received by ${drop.receivedBy}`}
                          {drop.signature && " · signed"}
                          {drop.photo && " · photo"}
                        </p>
                      )}
                      {j.notices.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {j.notices.map((n) => `${n.channel === "email" ? "Email" : "SMS"} to ${n.to}: ${n.ok ? (n.demo ? "demo" : "sent") : "failed"}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="field w-auto py-1.5 text-sm"
                        value={j.driverId}
                        disabled={j.status === "completed"}
                        onChange={(e) => run(() => api(`/api/jobs/${j.id}`, { method: "PATCH", body: { driverId: e.target.value } }))}
                        aria-label="Assigned driver"
                      >
                        {!drivers.some((d) => d.id === j.driverId) && <option value={j.driverId}>{nameOf(j.driverId)}</option>}
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => confirm(`Delete job for ${j.customerName}?`) && run(() => api(`/api/jobs/${j.id}`, { method: "DELETE" }))}
                        aria-label="Delete job"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

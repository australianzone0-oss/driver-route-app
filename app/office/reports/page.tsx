"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, useMe } from "@/lib/api";

const REPORTS = [
  { value: "jobs", label: "Jobs", about: "Every job created in the period, with driver, addresses, completion and price." },
  { value: "drivers", label: "Driver summary", about: "Jobs completed and still open per driver, with value." },
  { value: "containers", label: "Containers", about: "Containers added in the period with wharf and dehire dates." },
  { value: "invoices", label: "Invoices", about: "Invoices issued in the period with GST, for your bookkeeper." },
];

type Row = Record<string, string | number | null>;

const iso = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

function toCsv(rows: Row[]) {
  const cols = Object.keys(rows[0] ?? {});
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

export default function Reports() {
  const me = useMe("admin");
  const now = new Date();
  const [type, setType] = useState("jobs");
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  async function load() {
    setBusy(true);
    setError(undefined);
    try {
      setRows((await api<{ rows: Row[] }>(`/api/reports?type=${type}&from=${from}&to=${to}`)).rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!rows?.length) return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const cols = Object.keys(rows?.[0] ?? {});
  const about = REPORTS.find((r) => r.value === type)?.about;

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <h1 className="text-xl font-bold">Reports</h1>
        <section className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label" htmlFor="r-type">Report</label>
            <select id="r-type" className="field w-auto" value={type} onChange={(e) => { setType(e.target.value); setRows(undefined); }}>
              {REPORTS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="r-from">From</label>
            <input id="r-from" type="date" className="field w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-to">To</label>
            <input id="r-to" type="date" className="field w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn-primary py-2.5" disabled={busy} onClick={load}>
            {busy ? "Loading…" : "Run report"}
          </button>
          <button className="btn-ghost py-2.5" disabled={!rows?.length} onClick={download}>
            Download CSV
          </button>
          <p className="w-full text-sm text-slate-500">{about}</p>
        </section>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {rows && (
          rows.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">Nothing in that period.</div>
          ) : (
            <div className="card overflow-x-auto">
              <p className="px-4 pt-3 text-xs text-slate-500">{rows.length} rows</p>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      {cols.map((c) => (
                        <td key={c} className={`max-w-[16rem] truncate px-3 py-2 ${typeof r[c] === "number" ? "text-right tabular-nums" : ""}`} title={String(r[c] ?? "")}>
                          {r[c] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </main>
    </div>
  );
}

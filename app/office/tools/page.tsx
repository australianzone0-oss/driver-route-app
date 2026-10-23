"use client";

import { useState } from "react";
import { AddressInput, type AddressValue } from "@/components/AddressInput";
import { AppHeader } from "@/components/AppHeader";
import { api, useMe } from "@/lib/api";
import { checkContainerNumber, containerCheckDigit, money } from "@/lib/records";

export default function Tools() {
  const me = useMe("admin");
  if (!me) return null;
  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <h1 className="text-xl font-bold">Tools</h1>
        <div className="grid gap-4 lg:grid-cols-2">
          <ContainerCheck />
          <GstCalc />
          <Distance />
          <ImportCustomers />
        </div>
      </main>
    </div>
  );
}

function ContainerCheck() {
  const [n, setN] = useState("");
  const clean = n.replace(/[\s-]/g, "").toUpperCase();
  const problem = clean.length >= 10 ? checkContainerNumber(clean) : null;
  const digit = clean.length >= 10 ? containerCheckDigit(clean.slice(0, 10)) : null;
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Container number check</h2>
      <p className="text-sm text-slate-500">Catches typos using the ISO 6346 check digit (the last digit).</p>
      <input className="field font-mono uppercase" value={n} onChange={(e) => setN(e.target.value)} placeholder="e.g. CSQU3054383" aria-label="Container number" />
      {clean.length >= 10 &&
        (clean.length === 11 && !problem ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ {clean} is a valid container number.</p>
        ) : clean.length === 10 && digit != null ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">The check digit is <b>{digit}</b>, so the full number is <b className="font-mono">{clean + digit}</b>.</p>
        ) : (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠ {problem ?? "That doesn't look like a container number."}</p>
        ))}
    </section>
  );
}

function GstCalc() {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const n = Number(amount.replace(/[$,\s]/g, ""));
  const ok = amount.trim() !== "" && Number.isFinite(n);
  const ex = mode === "add" ? n : n / 1.1;
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">GST calculator</h2>
      <div className="flex gap-2">
        <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" aria-label="Amount" />
        <select className="field w-auto" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Amount is">
          <option value="add">is ex GST</option>
          <option value="remove">includes GST</option>
        </select>
      </div>
      {ok && (
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Ex GST</dt>
          <dd className="text-right tabular-nums">{money(ex)}</dd>
          <dt className="text-slate-500">GST (10%)</dt>
          <dd className="text-right tabular-nums">{money(ex * 0.1)}</dd>
          <dt className="font-semibold">Inc GST</dt>
          <dd className="text-right font-semibold tabular-nums">{money(ex * 1.1)}</dd>
        </dl>
      )}
    </section>
  );
}

function Distance() {
  const empty: AddressValue = { address: "", location: null };
  const [a, setA] = useState(empty);
  const [b, setB] = useState(empty);
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!a.location || !b.location) return setResult("Pick both addresses from the list.");
    setBusy(true);
    try {
      const r = await api<{ km: number; minutes: number }>("/api/route", { body: { points: [[a.location.lat, a.location.lng], [b.location.lat, b.location.lng]] } });
      const h = Math.floor(r.minutes / 60);
      setResult(`${r.km.toFixed(1)} km, about ${h ? `${h} h ` : ""}${Math.round(r.minutes % 60)} min by road (car times; trucks are slower).`);
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Distance and drive time</h2>
      <AddressInput label="From" value={a} onChange={setA} />
      <AddressInput label="To" value={b} onChange={setB} />
      <button className="btn-ghost py-2" disabled={busy} onClick={go}>
        {busy ? "Working…" : "Calculate"}
      </button>
      {result && <p className="text-sm">{result}</p>}
    </section>
  );
}

function ImportCustomers() {
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const out: string[] = [];
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const [name, email, phone, address, abn] = line.split(",").map((s) => s.trim());
      if (!name || name.toLowerCase() === "name") continue;
      try {
        await api("/api/customers", { body: { name, email: email || null, phone: phone || null, address: address || null, abn: abn || null } });
        out.push(`✓ ${name}`);
      } catch (e) {
        out.push(`✕ ${name}: ${(e as Error).message}`);
      }
      setLog([...out]);
    }
    setBusy(false);
  }
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Import customers</h2>
      <p className="text-sm text-slate-500">Paste one customer per line: name, email, phone, address, ABN. Only the name is required. Commas inside fields aren&apos;t supported.</p>
      <textarea className="field min-h-28 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Acme Imports, accounts@acme.com.au, 02 9000 0000, 1 Port Rd Botany NSW, 12 345 678 901"} />
      <button className="btn-ghost py-2" disabled={busy || !text.trim()} onClick={go}>
        {busy ? "Importing…" : "Import"}
      </button>
      {log.length > 0 && <ul className="max-h-40 overflow-auto text-sm">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </section>
  );
}

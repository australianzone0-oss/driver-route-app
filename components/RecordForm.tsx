"use client";

import { useState } from "react";
import type { FieldSpec } from "@/lib/records";
import { AddressFields } from "./AddressFields";

type Values = Record<string, unknown>;

/** A form built from a field list (see lib/records.ts). */
export function RecordForm({
  fields,
  initial,
  customers = [],
  submitLabel,
  onSubmit,
  extra,
}: {
  fields: FieldSpec[];
  initial: Values | null;
  customers?: { id: string; name: string }[];
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [values, setValues] = useState<Values>(() => {
    const v: Values = {};
    for (const f of fields) {
      const cur = initial?.[f.key];
      if (f.type === "bool") v[f.key] = cur ?? f.key === "active";
      else if (f.type === "select") v[f.key] = cur ?? f.options?.[0]?.value ?? "";
      else v[f.key] = cur ?? "";
    }
    return v;
  });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: unknown) => setValues((v) => ({ ...v, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      // New records skip the "active" switch; it defaults on.
      const body = initial ? values : Object.fromEntries(Object.entries(values).filter(([k]) => k !== "active"));
      await onSubmit(body);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const shown = fields.filter((f) => initial || f.key !== "active");
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {shown.map((f) => (
          <div key={f.key} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
            {f.type === "bool" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
                {f.label}
              </label>
            ) : (
              <>
                <label className="label" htmlFor={`f-${f.key}`}>
                  {f.label}
                  {f.required && " *"}
                </label>
                <Input f={f} id={`f-${f.key}`} value={String(values[f.key] ?? "")} onChange={(v) => set(f.key, v)} customers={customers} />
              </>
            )}
          </div>
        ))}
      </div>
      {extra}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Input({
  f,
  id,
  value,
  onChange,
  customers,
}: {
  f: FieldSpec;
  id: string;
  value: string;
  onChange: (v: string) => void;
  customers: { id: string; name: string }[];
}) {
  if (f.type === "address") return <AddressFields id={id} value={value} onChange={onChange} required={f.required} />;
  const common = { id, className: `field ${f.upper ? "font-mono uppercase" : ""}`, value, placeholder: f.placeholder, required: f.required };
  if (f.type === "textarea") return <textarea {...common} className="field min-h-16" onChange={(e) => onChange(e.target.value)} />;
  if (f.type === "select")
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        {f.options!.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  if (f.type === "customer")
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        <option value="">No customer</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  const type = f.type === "money" || f.type === "number" ? "text" : f.type;
  const inputMode = f.type === "money" ? "decimal" : f.type === "number" ? "numeric" : undefined;
  return <input {...common} type={type} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />;
}

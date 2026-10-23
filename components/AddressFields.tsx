"use client";

import { useEffect, useState } from "react";
import { AU_STATES, formatAddress, parseAddress, type AddressParts } from "@/lib/address";

/** Number, street, suburb, state and postcode boxes that read and write a one-line address. */
export function AddressFields({
  id,
  value,
  onChange,
  required,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [parts, setParts] = useState<AddressParts>(() => parseAddress(value));
  // Follow outside changes (a reset, or an address filled from a document).
  useEffect(() => {
    setParts((p) => (formatAddress(p) === value ? p : parseAddress(value)));
  }, [value]);

  const set = (k: keyof AddressParts, v: string) => {
    const next = { ...parts, [k]: v };
    setParts(next);
    onChange(formatAddress(next));
  };
  const box = (k: keyof AddressParts, label: string, cls: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={cls}>
      <label className="text-[11px] font-medium text-slate-500" htmlFor={`${id}-${k}`}>{label}</label>
      <input id={`${id}-${k}`} className="field" value={parts[k]} onChange={(e) => set(k, e.target.value)} autoComplete="off" {...extra} />
    </div>
  );

  return (
    <div className="grid grid-cols-4 gap-2">
      {box("number", "Number", "col-span-1", { placeholder: "12" })}
      {box("street", "Street / road", "col-span-3", { placeholder: "Smith St", required })}
      {box("suburb", "Suburb", "col-span-4 sm:col-span-2", { placeholder: "Botany", required })}
      <div className="col-span-2 sm:col-span-1">
        <label className="text-[11px] font-medium text-slate-500" htmlFor={`${id}-state`}>State</label>
        <select id={`${id}-state`} className="field" value={parts.state} onChange={(e) => set("state", e.target.value)} required={required}>
          <option value="">Select</option>
          {AU_STATES.map((s) => (
            <option key={s.value} value={s.value} title={s.label}>{s.value}</option>
          ))}
        </select>
      </div>
      {box("postcode", "Postcode", "col-span-2 sm:col-span-1", {
        placeholder: "2019",
        inputMode: "numeric",
        maxLength: 4,
        pattern: "\\d{4}",
        title: "4-digit postcode",
        required,
      })}
    </div>
  );
}

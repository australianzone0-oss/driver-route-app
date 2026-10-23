"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/types";
import { AddressFields } from "./AddressFields";

export type AddressValue = { address: string; location: LatLng | null };

type Result = { label: string; lat: number; lng: number };

export async function geocodeFirst(q: string): Promise<Result | null> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  const data = await res.json().catch(() => ({ results: [] }));
  return data.results?.[0] ?? null;
}

export function AddressInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  required?: boolean;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.location || !value.address.includes(",")) {
      setResults([]);
      return;
    }
    const q = value.address;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [value.address, value.location]);

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setTimeout(() => setOpen(false), 150)}>
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <AddressFields
        id={label.toLowerCase().replace(/\W+/g, "-")}
        value={value.address}
        required={required}
        onChange={(address) => {
          typed.current = true;
          onChange({ address, location: null });
        }}
      />
      <p className="mt-1 text-xs font-medium">
        {loading ? (
          <span className="text-slate-400">Searching the map…</span>
        ) : value.location ? (
          <span className="text-emerald-600">✓ Found on the map</span>
        ) : results.length ? (
          <button type="button" className="text-amber-600 underline" onClick={() => setOpen(true)}>Pick the match below</button>
        ) : value.address ? (
          <span className="text-slate-500">Fill in street, suburb, state and postcode to find it on the map</span>
        ) : null}
      </p>
      {open && results.length > 0 && (
        <ul className="absolute z-[1100] mt-1 max-h-64 w-full overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  typed.current = false;
                  // Keep the address as typed; the match only places it on the map.
                  onChange({ address: value.address, location: { lat: r.lat, lng: r.lng } });
                  setOpen(false);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

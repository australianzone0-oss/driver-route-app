"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/types";

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
  placeholder,
  required,
}: {
  label: string;
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.location || value.address.trim().length < 4) {
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
    <div className="relative">
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        className="field pr-20"
        value={value.address}
        placeholder={placeholder ?? "Start typing an address"}
        onChange={(e) => {
          typed.current = true;
          onChange({ address: e.target.value, location: null });
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      <span className="pointer-events-none absolute right-3 top-[34px] text-xs font-medium">
        {loading ? (
          <span className="text-slate-400">Searching…</span>
        ) : value.location ? (
          <span className="text-emerald-600">✓ Found</span>
        ) : value.address ? (
          <span className="text-amber-600">Pick one</span>
        ) : null}
      </span>
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
                  onChange({ address: r.label, location: { lat: r.lat, lng: r.lng } });
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

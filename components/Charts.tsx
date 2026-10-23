"use client";

import { useEffect, useRef, useState } from "react";

type Point = { label: string; value: number };

const PAD = { top: 16, right: 12, bottom: 28, left: 40 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / pow) * pow;
}

function Axis({ max, h, W, format }: { max: number; h: number; W: number; format: (n: number) => string }) {
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const y = (v: number) => PAD.top + (h - PAD.top - PAD.bottom) * (1 - v / max);
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-200" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Single-series chart over time: a line, or bars for counts per bucket. */
export function TimeChart({
  data,
  kind = "line",
  height = 200,
  format = (n) => String(Math.round(n)),
  label,
}: {
  data: Point[];
  kind?: "line" | "bar";
  height?: number;
  format?: (n: number) => string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so text stays the same size on any screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const step = plotW / Math.max(1, data.length);
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + plotH * (1 - v / max);
  const every = Math.ceil(data.length / Math.max(2, Math.floor(W / 64)));
  const h = hover == null ? null : data[hover];

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} className="block max-w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <Axis max={max} h={height} W={W} format={format} />
        {kind === "bar"
          ? data.map((d, i) => {
              const bw = Math.max(2, Math.min(36, step - 4));
              const top = y(d.value);
              const bh = PAD.top + plotH - top;
              return bh > 0 ? (
                <path
                  key={i}
                  d={`M${x(i) - bw / 2},${PAD.top + plotH} v${-Math.max(0, bh - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(0, bh - 4)} z`}
                  className={hover === i ? "fill-brand-700" : "fill-brand-500"}
                />
              ) : null;
            })
          : (
            <>
              <path
                d={data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ")}
                fill="none"
                className="stroke-brand-500"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {data.length <= 31 && data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3.5} className="fill-brand-500 stroke-white" strokeWidth={2} />)}
            </>
          )}
        {hover != null && kind === "line" && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-slate-300" strokeDasharray="3 3" />}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {d.label}
            </text>
          ) : null,
        )}
        {data.map((_, i) => (
          <rect key={i} x={PAD.left + step * i} y={0} width={step} height={height} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
        ))}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow"
          style={{ left: `${(x(hover!) / W) * 100}%` }}
        >
          {h.label}: <b>{format(h.value)}</b>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars with the value written at the end. */
export function RankBars({ data, format = (n) => String(n), empty }: { data: Point[]; format?: (n: number) => string; empty: string }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm" title={`${d.label}: ${format(d.value)}`}>
          <div className="mb-0.5 flex justify-between gap-2">
            <span className="truncate text-slate-700">{d.label}</span>
            <span className="font-semibold tabular-nums text-slate-800">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
export const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });

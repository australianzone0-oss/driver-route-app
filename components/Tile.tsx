import Link from "next/link";

const TONES = {
  blue: "bg-brand-700 text-white",
  green: "bg-emerald-600 text-white",
  red: "bg-red-600 text-white",
  slate: "bg-white text-slate-900 ring-1 ring-slate-200",
};

/** A dashboard number tile, optionally linking to the page behind it. */
export function Tile({ label, value, sub, tone = "slate", href }: { label: string; value: string; sub?: string; tone?: keyof typeof TONES; href?: string }) {
  const body = (
    <>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "slate" ? "text-slate-500" : "text-white/80"}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className={`text-xs ${tone === "slate" ? "text-slate-500" : "text-white/80"}`}>{sub}</p>}
    </>
  );
  const cls = `block rounded-2xl p-4 shadow-sm ${TONES[tone]}`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:brightness-110`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

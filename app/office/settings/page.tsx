"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, useApi, useMe } from "@/lib/api";

type Company = {
  name: string; slug: string; abn: string | null; address: string | null; phone: string | null; email: string | null;
  gstRate: number; invoicePrefix: string; nextInvoiceNo: number; paymentTermsDays: number;
};
type Staff = { id: string; name: string; email: string; active: boolean };

function Msg({ m }: { m?: { ok: boolean; text: string } }) {
  if (!m) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{m.text}</p>;
}

export default function Settings() {
  const me = useMe("admin");
  if (!me) return null;
  return (
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <h1 className="text-xl font-bold">Settings</h1>
        <div className="grid gap-4 lg:grid-cols-2">
          <CompanyForm />
          <div className="space-y-4">
            <section className="card p-5">
              <h2 className="font-semibold">Login page</h2>
              <p className="mt-1 text-sm text-slate-500">Drivers and office staff sign in here.</p>
              <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm">
                {typeof window !== "undefined" ? window.location.origin : ""}/c/{me.company.slug}
              </p>
            </section>
            <StaffList />
            <PasswordForm email={me.email} />
          </div>
        </div>
      </main>
    </div>
  );
}

function CompanyForm() {
  const s = useApi<{ company: Company }>("/api/settings");
  const [c, setC] = useState<Company>();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (s.data) setC(s.data.company);
  }, [s.data]);
  if (!c) return <section className="card p-5 text-sm text-slate-500">Loading…</section>;
  const field = (k: keyof Company, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={extra.className}>
      <label className="label" htmlFor={`s-${k}`}>{label}</label>
      <input id={`s-${k}`} {...extra} className="field" value={String(c[k] ?? "")} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
    </div>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    try {
      const r = await api<{ company: Company }>("/api/settings", { method: "PATCH", body: c });
      setC(r.company);
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Company details</h2>
        <p className="text-sm text-slate-500">These appear on your invoices.</p>
      </div>
      {field("name", "Company name", { required: true })}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("abn", "ABN")}
        {field("phone", "Phone", { type: "tel" })}
      </div>
      {field("email", "Accounts email", { type: "email" })}
      {field("address", "Address")}
      <h3 className="pt-2 text-sm font-semibold">Invoicing</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("invoicePrefix", "Invoice prefix")}
        {field("nextInvoiceNo", "Next invoice number", { inputMode: "numeric" })}
        {field("gstRate", "GST rate (%)", { inputMode: "decimal" })}
        {field("paymentTermsDays", "Payment terms (days)", { inputMode: "numeric" })}
      </div>
      <Msg m={msg} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save company details"}</button>
    </form>
  );
}

function StaffList() {
  const s = useApi<{ staff: Staff[]; myId: string }>("/api/staff");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setMsg(undefined);
    try {
      await fn();
      if (ok) setMsg({ ok: true, text: ok });
      s.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Office staff</h2>
        <button className="btn-ghost py-1.5" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add"}</button>
      </div>
      <ul className="divide-y divide-slate-100 text-sm">
        {s.data?.staff.map((p) => (
          <li key={p.id} className={`flex items-center justify-between gap-2 py-2 ${p.active ? "" : "opacity-60"}`}>
            <span>
              {p.name} <span className="text-slate-500">· {p.email}</span>
            </span>
            {p.id === s.data!.myId ? (
              <span className="text-xs text-slate-500">You</span>
            ) : (
              <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => run(() => api(`/api/staff/${p.id}`, { method: "PATCH", body: { active: !p.active } }))}>
                {p.active ? "Turn off login" : "Turn on login"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <form
          className="space-y-3 border-t border-slate-200 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/staff", { body: form });
              setForm({ name: "", email: "", password: "" });
              setAdding(false);
            }, "Added. They sign in on the Office tab of your login page.");
          }}
        >
          <input className="field" placeholder="Name" aria-label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field" type="email" placeholder="Email" aria-label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="field" type="password" autoComplete="new-password" minLength={8} placeholder="Temporary password (8+ characters)" aria-label="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button className="btn-primary w-full">Add office login</button>
        </form>
      )}
      <Msg m={msg} />
    </section>
  );
}

function PasswordForm({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setMsg({ ok: false, text: "The two new passwords don't match." });
    setBusy(true);
    setMsg(undefined);
    try {
      await api("/api/auth/password", { body: { current, password } });
      setMsg({ ok: true, text: "Password changed." });
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div>
        <h2 className="font-semibold">Change my password</h2>
        <p className="text-sm text-slate-500">{email}</p>
      </div>
      <input className="field" type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <input className="field" type="password" autoComplete="new-password" minLength={8} placeholder="New password" aria-label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <input className="field" type="password" autoComplete="new-password" placeholder="Type it again" aria-label="Type the new password again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      <Msg m={msg} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}

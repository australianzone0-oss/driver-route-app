"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, useMe } from "@/lib/api";

export default function Account() {
  const me = useMe("admin");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  if (!me) return null;

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
    <div className="min-h-dvh">
      <AppHeader me={me} />
      <main className="mx-auto max-w-xl space-y-4 px-4 py-4">
        <section className="card p-5">
          <h1 className="text-xl font-bold">Account</h1>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Name</dt>
            <dd>{me.name}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd>{me.email}</dd>
            <dt className="text-slate-500">Company</dt>
            <dd>{me.company.name}</dd>
            <dt className="text-slate-500">Portal</dt>
            <dd>/c/{me.company.slug}</dd>
          </dl>
        </section>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <h2 className="font-semibold">Change password</h2>
          <div>
            <label className="label">Current password</label>
            <input className="field" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="field" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Type it again</label>
            <input className="field" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </form>
      </main>
    </div>
  );
}

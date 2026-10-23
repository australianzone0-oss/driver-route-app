"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, rememberPortal } from "@/lib/api";

export default function ResetPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ slug: string }>("/api/auth/reset", { body: { token, password } });
      rememberPortal(r.slug);
      router.push("/office");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
        <div>
          <label className="label">New password</label>
          <input className="field" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        <div>
          <label className="label">Type it again</label>
          <input className="field" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !token}>
          {busy ? "Saving…" : "Save new password"}
        </button>
        {!token && <p className="text-sm text-red-700">This link is incomplete. Open the link from your email again.</p>}
      </form>
    </main>
  );
}

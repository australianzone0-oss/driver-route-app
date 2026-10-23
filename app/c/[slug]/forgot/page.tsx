"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Forgot() {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/auth/forgot", { body: { slug, email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href={`/c/${slug}`} className="mb-6 text-sm font-medium text-brand-600">
        ← Back to log in
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      {sent ? (
        <div className="card mt-6 p-5">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-sm text-slate-600">
            If {email} has an office login here, we&apos;ve sent a link to choose a new password. It works for 60 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
          <p className="text-sm text-slate-600">Enter the email you use for the office login. We&apos;ll email you a link to set a new password.</p>
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-xs text-slate-500">Drivers: ask your office to reset your PIN.</p>
        </form>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, rememberPortal } from "@/lib/api";

/** A company's own login page: drivers by mobile + PIN, office by email + password. */
export default function Portal() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<string | null>();
  const [method, setMethod] = useState<"driver" | "office">("driver");
  const [login, setLogin] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ name: string }>(`/api/companies/${slug}`)
      .then((c) => {
        setCompany(c.name);
        rememberPortal(slug);
      })
      .catch(() => setCompany(null));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ role: string }>("/api/auth/login", { body: { slug, method, login, secret } });
      router.push(r.role === "admin" ? "/office" : "/run");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (company === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 text-center">
        <h1 className="text-xl font-bold">Portal not found</h1>
        <p className="mt-2 text-sm text-slate-500">There&apos;s no company at /c/{slug}. Check the address with your office.</p>
        <Link href="/" className="btn-ghost mx-auto mt-6">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <img src="/icon.svg" alt="" className="mx-auto h-12 w-12" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{company ?? " "}</h1>
        <p className="text-sm text-slate-500">Log in to RouteRun</p>
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200 p-1 text-sm font-semibold">
        {(["driver", "office"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-lg py-2 ${method === m ? "bg-white shadow-sm" : "text-slate-600"}`}
            onClick={() => {
              setMethod(m);
              setLogin("");
              setSecret("");
              setError(undefined);
            }}
          >
            {m === "driver" ? "Driver" : "Office"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5">
        {method === "driver" ? (
          <>
            <div>
              <label className="label">Mobile number</label>
              <input className="field" type="tel" inputMode="tel" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="0412 345 678" required />
            </div>
            <div>
              <label className="label">PIN</label>
              <input
                className="field tracking-[0.4em]"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="current-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                required
              />
              <p className="mt-1 text-xs text-slate-500">6 digits. Forgot it? Ask your office to reset it.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label">Email</label>
              <input className="field" type="email" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="field" type="password" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} required />
            </div>
          </>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}

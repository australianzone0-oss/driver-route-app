"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, rememberPortal } from "@/lib/api";
import { slugify } from "@/lib/phone";

export default function Signup() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const portal = slugEdited ? slug : slugify(companyName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ slug: string }>("/api/auth/signup", { body: { companyName, slug: portal, name, email, password } });
      rememberPortal(r.slug, companyName.trim());
      router.push("/office/drivers?welcome=1");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-6 text-sm font-medium text-brand-600">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Create your company account</h1>
      <p className="mt-1 text-sm text-slate-500">You&apos;ll be the office admin. Add drivers and vehicles next.</p>

      <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
        <div>
          <label className="label">Company name</label>
          <input className="field" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Coastal Freight" required />
        </div>
        <div>
          <label className="label">Portal address</label>
          <div className="flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="pl-3 text-sm text-slate-400">/c/</span>
            <input
              className="w-full rounded-xl bg-transparent px-1 py-2.5 text-[15px] outline-none"
              value={portal}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="coastal-freight"
              autoCapitalize="none"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Your drivers and staff log in here.</p>
        </div>
        <div>
          <label className="label">Your name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </main>
  );
}

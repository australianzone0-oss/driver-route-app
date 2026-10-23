"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Me } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Loads JSON from an API path, with optional polling. */
export function useApi<T>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const live = useRef(true);

  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (live.current) {
        setData(d);
        setError(undefined);
      }
    } catch (e) {
      if (live.current) setError((e as Error).message);
    }
  }, [path]);

  useEffect(() => {
    live.current = true;
    refresh();
    if (!pollMs) return () => void (live.current = false);
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), pollMs);
    return () => {
      live.current = false;
      clearInterval(t);
    };
  }, [refresh, pollMs]);

  return { data, error, refresh, setData };
}

const PORTAL_KEY = "routerun:portal";

/** Remembers the company this device last used, so its name is filled in next time. */
export function rememberPortal(slug: string, name?: string) {
  try {
    const keep = name ?? (lastCompany()?.slug === slug ? lastCompany()?.name : undefined);
    localStorage.setItem(PORTAL_KEY, JSON.stringify({ slug, name: keep ?? null }));
  } catch {}
}

export function lastCompany(): { slug: string; name: string | null } | null {
  try {
    const raw = localStorage.getItem(PORTAL_KEY);
    if (!raw) return null;
    // Older versions stored just the portal code.
    if (!raw.startsWith("{")) return { slug: raw, name: null };
    const v = JSON.parse(raw);
    return typeof v?.slug === "string" ? { slug: v.slug, name: typeof v.name === "string" ? v.name : null } : null;
  } catch {
    return null;
  }
}

export function lastPortal(): string | null {
  return lastCompany()?.slug ?? null;
}

/**
 * The signed-in user. Sends people without a session to their company's login
 * page, and people with the wrong role to their own home screen.
 */
export function useMe(role?: Me["role"]) {
  const router = useRouter();
  const { data } = useApi<{ me: Me | null }>("/api/me");
  const me = data?.me;

  useEffect(() => {
    if (!data) return;
    if (!me) {
      const slug = lastPortal();
      router.replace(slug ? `/c/${slug}` : "/");
    } else if (role && me.role !== role) {
      router.replace(me.role === "admin" ? "/office" : "/run");
    }
  }, [data, me, role, router]);

  return me && (!role || me.role === role) ? me : null;
}

export async function signOut(router: ReturnType<typeof useRouter>, slug?: string) {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  router.push(slug ? `/c/${slug}` : "/");
}

/**
 * Postgres access. Uses DATABASE_URL, or the POSTGRES_URL that the Supabase and
 * Neon integrations for Vercel add (with or without a custom prefix). Locally,
 * without either, it uses an embedded Postgres (PGlite) stored on disk.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { HttpError } from "./errors";
import { schema } from "./schema";

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

type Db = { query: Query; transaction<R>(fn: (q: Query) => Promise<R>): Promise<R> };

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

/** Finds the database connection string among the environment variables. */
function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // e.g. POSTGRES_URL, or STORAGE_POSTGRES_URL when the integration adds a prefix.
  const key = Object.keys(process.env)
    .filter((k) => /(^|_)POSTGRES_URL$/.test(k) && process.env[k])
    .sort((a, b) => a.length - b.length)[0];
  return key ? process.env[key] : undefined;
}

async function connect(): Promise<Db> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    // The embedded database would live in /tmp and vanish between requests.
    throw new HttpError(503, "The database isn't connected yet. Connect Supabase to this Vercel project, then redeploy.");
  }
  if (url) {
    const postgres = (await import("postgres")).default;
    // Hosted databases (Supabase, Neon) need SSL; a local Postgres usually doesn't.
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /sslmode=disable/.test(url);
    const sql = postgres(url, { max: 5, prepare: false, ssl: local ? false : "require", onnotice: () => {} });
    await sql.unsafe(schema);
    const wrap = (s: typeof sql): Query => (text, params = []) => s.unsafe(text, params as never[]) as never;
    return {
      query: wrap(sql),
      transaction: (fn) => sql.begin((tx) => fn(wrap(tx as unknown as typeof sql))) as never,
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".data/pglite");
  mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create(dir);
  await pg.exec(schema);
  const query: Query = async (text, params = []) => (await pg.query(text, params)).rows as never;
  return {
    query,
    transaction: (fn) => pg.transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows as never)),
  };
}

function db() {
  globalForDb.__db ??= connect().catch((err) => {
    globalForDb.__db = undefined;
    throw err;
  });
  return globalForDb.__db;
}

export const query: Query = async (text, params) => (await db()).query(text, params);

export async function transaction<R>(fn: (q: Query) => Promise<R>): Promise<R> {
  return (await db()).transaction(fn);
}

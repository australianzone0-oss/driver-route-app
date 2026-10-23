/**
 * Postgres access. Uses DATABASE_URL (Supabase, Neon or any Postgres) when set;
 * otherwise an embedded Postgres (PGlite) stored on disk, for local development.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { schema } from "./schema";

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

type Db = { query: Query; transaction<R>(fn: (q: Query) => Promise<R>): Promise<R> };

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

async function connect(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const postgres = (await import("postgres")).default;
    const url = process.env.DATABASE_URL;
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
  const dir = process.env.VERCEL ? "/tmp/pglite" : path.join(process.cwd(), ".data/pglite");
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

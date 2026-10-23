import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "./db";
import { HttpError } from "./errors";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const COOKIE = "rr_session";
const SESSION_DAYS = 30;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(secret, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [sha256(token), userId, expires]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [sha256(token)]);
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  role: "admin" | "driver";
  email: string | null;
  phone: string | null;
  vehicleId: string | null;
  companyId: string;
  companyName: string;
  companySlug: string;
};

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await query<SessionUser>(
    `select u.id, u.name, u.role, u.email, u.phone, u.vehicle_id as "vehicleId",
            c.id as "companyId", c.name as "companyName", c.slug as "companySlug"
       from sessions s
       join users u on u.id = s.user_id
       join companies c on c.id = u.company_id
      where s.token_hash = $1 and s.expires_at > now() and u.active`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}

export { HttpError };

/** Throws 401/403 unless signed in (optionally with the given role). */
export async function requireUser(role?: "admin" | "driver"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please log in.");
  if (role && user.role !== role) throw new HttpError(403, "You don't have access to that.");
  return user;
}

/** Wraps a route handler so thrown HttpErrors become JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (isUniqueViolation(err)) return NextResponse.json({ error: "That already exists." }, { status: 409 });
      console.error(err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

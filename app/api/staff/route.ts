import { NextResponse } from "next/server";
import { handler, hashSecret, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

const COLS = `id, name, email, active`;

export const GET = handler(async () => {
  const u = await requireUser("admin");
  const staff = await query(`select ${COLS} from users where company_id = $1 and role = 'admin' order by active desc, name`, [u.companyId]);
  return NextResponse.json({ staff, myId: u.id });
});

/** Adds another office login for the same company. */
export const POST = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!name) throw new HttpError(400, "Enter their name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "The password must be at least 8 characters.");
  const exists = await query("select 1 from users where company_id = $1 and email = $2", [u.companyId, email]);
  if (exists.length) throw new HttpError(409, "Someone with that email already has a login.");
  const [member] = await query(
    `insert into users (company_id, role, name, email, password_hash) values ($1, 'admin', $2, $3, $4) returning ${COLS}`,
    [u.companyId, name, email, await hashSecret(password)],
  );
  return NextResponse.json({ member }, { status: 201 });
});

import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { handler, HttpError, LOCK_MINUTES, MAX_FAILED_LOGINS, startSession, verifySecret } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

type UserRow = { id: string; role: string; password_hash: string; active: boolean; failed_logins: number; locked_until: Date | string | null };

/**
 * Logs in on a company portal. Drivers use their mobile number and PIN,
 * office staff use their email and password.
 */
export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const slug = String(b.slug ?? "");
  const method = b.method === "office" ? "office" : "driver";
  const secret = String(b.secret ?? "");

  let column: "phone" | "email";
  let value: string | null;
  if (method === "driver") {
    column = "phone";
    value = normalizePhone(String(b.login ?? ""));
    if (!value) throw new HttpError(400, "Enter your mobile number.");
  } else {
    column = "email";
    value = String(b.login ?? "").trim().toLowerCase();
  }

  const fail = new HttpError(401, method === "driver" ? "Mobile number or PIN is wrong." : "Email or password is wrong.");
  const rows = await query<UserRow>(
    `select u.id, u.role, u.password_hash, u.active, u.failed_logins, u.locked_until
       from users u join companies c on c.id = u.company_id
      where c.slug = $1 and u.${column} = $2 and u.role = $3`,
    [slug, value, method === "driver" ? "driver" : "admin"],
  );
  const user = rows[0];
  if (!user || !user.active) throw fail;
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new HttpError(429, `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes or ask the office to reset it.`);
  }

  if (!(await verifySecret(secret, user.password_hash))) {
    const failed = user.failed_logins + 1;
    await query(
      "update users set failed_logins = $2, locked_until = $3 where id = $1",
      [user.id, failed >= MAX_FAILED_LOGINS ? 0 : failed, failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null],
    );
    throw fail;
  }

  await query("update users set failed_logins = 0, locked_until = null where id = $1", [user.id]);
  await startSession(user.id);
  return NextResponse.json({ role: user.role });
});

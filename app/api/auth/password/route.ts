import { NextResponse } from "next/server";
import { handler, hashSecret, HttpError, requireUser, verifySecret } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

/** Signed-in office user changes their own password. */
export const POST = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const b = await req.json();
  const current = String(b.current ?? "");
  const next = String(b.password ?? "");
  if (next.length < 8) throw new HttpError(400, "Use a new password of at least 8 characters.");
  const [row] = await query<{ password_hash: string }>("select password_hash from users where id = $1", [u.id]);
  if (!row || !(await verifySecret(current, row.password_hash))) throw new HttpError(400, "Your current password is wrong.");
  await query("update users set password_hash = $2 where id = $1", [u.id, await hashSecret(next)]);
  return NextResponse.json({ ok: true });
});

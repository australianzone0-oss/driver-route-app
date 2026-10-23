import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { handler, hashSecret, HttpError, startSession } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";

/** Sets a new password from an emailed reset link, then signs the user in. */
export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const token = String(b.token ?? "");
  const password = String(b.password ?? "");
  if (password.length < 8) throw new HttpError(400, "Use a password of at least 8 characters.");
  const hash = await hashSecret(password);

  const result = await transaction(async (q) => {
    const rows = await q<{ user_id: string; slug: string }>(
      `update password_resets r set used_at = now()
         from users u join companies c on c.id = u.company_id
        where r.token_hash = $1 and r.used_at is null and r.expires_at > now() and u.id = r.user_id
        returning r.user_id, c.slug`,
      [createHash("sha256").update(token).digest("hex")],
    );
    if (!rows[0]) throw new HttpError(400, "This reset link has expired or was already used. Ask for a new one.");
    const { user_id } = rows[0];
    await q("update users set password_hash = $2, failed_logins = 0, locked_until = null where id = $1", [user_id, hash]);
    await q("delete from sessions where user_id = $1", [user_id]);
    await q("delete from password_resets where user_id = $1 and used_at is null", [user_id]);
    return rows[0];
  });
  await startSession(result.user_id);
  return NextResponse.json({ slug: result.slug });
});

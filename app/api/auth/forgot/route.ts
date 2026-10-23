import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { handler, HttpError } from "@/lib/server/auth";
import { appUrl } from "@/lib/server/appUrl";
import { query } from "@/lib/server/db";
import { emailConfigured, sendEmail } from "@/lib/server/notify";

const RESET_MINUTES = 60;

/**
 * Emails an office user a link to set a new password. The reply is the same
 * whether or not the email exists, so it can't be used to find accounts.
 */
export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const slug = String(b.slug ?? "");
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter your email address.");
  if (!emailConfigured()) {
    throw new HttpError(503, "Password reset emails aren't set up for this app yet. Ask the app owner to reset your password.");
  }

  const rows = await query<{ id: string; name: string; company: string }>(
    `select u.id, u.name, c.name as company from users u join companies c on c.id = u.company_id
      where c.slug = $1 and u.email = $2 and u.role = 'admin' and u.active`,
    [slug, email],
  );
  const user = rows[0];
  if (user) {
    const recent = await query("select 1 from password_resets where user_id = $1 and expires_at > now() + interval '55 minutes'", [user.id]);
    if (!recent.length) {
      const token = randomBytes(32).toString("base64url");
      await query("insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, $3)", [
        createHash("sha256").update(token).digest("hex"),
        user.id,
        new Date(Date.now() + RESET_MINUTES * 60_000),
      ]);
      const link = `${appUrl(req)}/reset?token=${token}`;
      await sendEmail(
        email,
        `Reset your ${user.company} password`,
        `Hi ${user.name},\n\nSomeone asked to reset the password for your ${user.company} office login on RouteRun. To choose a new password, open this link within ${RESET_MINUTES} minutes:\n\n${link}\n\nIf this wasn't you, ignore this email and your password stays the same.`,
      );
    }
  }
  return NextResponse.json({ ok: true });
});

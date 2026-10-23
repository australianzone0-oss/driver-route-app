import { NextResponse } from "next/server";
import { slugify } from "@/lib/phone";
import { handler, hashSecret, HttpError, startSession } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";

/** Creates a new company with its first office (admin) user. */
export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const companyName = String(b.companyName ?? "").trim();
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const slug = slugify(String(b.slug ?? "") || companyName);

  if (!companyName || !name) throw new HttpError(400, "Enter your company name and your name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "Use a password of at least 8 characters.");
  if (slug.length < 3) throw new HttpError(400, "The portal address needs at least 3 letters or numbers.");

  const hash = await hashSecret(password);
  const userId = await transaction(async (q) => {
    const taken = await q("select 1 from companies where slug = $1", [slug]);
    if (taken.length) throw new HttpError(409, `The portal address "${slug}" is taken. Try another.`);
    const [c] = await q<{ id: string }>("insert into companies (name, slug) values ($1, $2) returning id", [companyName, slug]);
    const [u] = await q<{ id: string }>(
      "insert into users (company_id, role, name, email, password_hash) values ($1, 'admin', $2, $3, $4) returning id",
      [c.id, name, email, hash],
    );
    return u.id;
  });
  await startSession(userId);
  return NextResponse.json({ slug });
});

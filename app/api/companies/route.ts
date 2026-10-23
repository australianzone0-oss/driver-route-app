import { NextResponse } from "next/server";
import { slugify } from "@/lib/phone";
import { handler, HttpError } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

/** Public: finds a company's login page from its name or portal code. */
export const GET = handler(async (req: Request) => {
  const q = (new URL(req.url).searchParams.get("find") ?? "").trim();
  if (!q) throw new HttpError(400, "Enter your company name.");
  const bySlug = await query<{ name: string; slug: string }>(
    "select name, slug from companies where slug = $1 or slug = $2 limit 1",
    [q.toLowerCase(), slugify(q)],
  );
  if (bySlug[0]) return NextResponse.json(bySlug[0]);
  const byName = await query<{ name: string; slug: string }>(
    "select name, slug from companies where lower(regexp_replace(name, '\\s+', ' ', 'g')) = lower($1) limit 2",
    [q.replace(/\s+/g, " ")],
  );
  if (byName.length === 1) return NextResponse.json(byName[0]);
  if (byName.length > 1) throw new HttpError(409, "More than one company has that name. Ask your office for your portal code.");
  throw new HttpError(404, "We couldn't find that company. Check the name, or ask your office for the link.");
});

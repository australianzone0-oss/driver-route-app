import { NextResponse } from "next/server";
import { slugify } from "@/lib/phone";
import { handler, HttpError } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

type Match = { name: string; slug: string };

/**
 * Public: finds a company's login page from its name, portal code or an
 * office email. `exact` is false when the matches are only
 * close spellings to suggest.
 */
export const GET = handler(async (req: Request) => {
  const q = (new URL(req.url).searchParams.get("find") ?? "").trim();
  if (!q) throw new HttpError(400, "Enter your company name or email.");
  const reply = (matches: Match[], by: string, exact = true) => NextResponse.json({ matches, by, exact });

  if (q.includes("@")) {
    const rows = await query<Match>(
      `select distinct c.name, c.slug from users u join companies c on c.id = u.company_id
        where u.role = 'admin' and u.active and u.email = $1 order by c.name limit 5`,
      [q.toLowerCase()],
    );
    return reply(rows, "email");
  }

  const exact = await query<Match>(
    `select name, slug from companies
      where slug = $1 or slug = $2 or lower(regexp_replace(name, '\\s+', ' ', 'g')) = lower($3)
      order by (slug = $1 or slug = $2) desc, name limit 5`,
    [q.toLowerCase(), slugify(q), q.replace(/\s+/g, " ")],
  );
  // A portal code match is exact; several companies with the same name are choices.
  if (exact.length) return reply(exact.length > 1 && exact[0].slug === slugify(q) ? [exact[0]] : exact, "name");

  // Close spellings: same first few letters, ignoring spaces and punctuation.
  const key = q.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key.length < 3) return reply([], "suggest", false);
  const near = await query<Match>(
    `select name, slug from companies
      where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') like $1 || '%'
         or regexp_replace(slug, '[^a-z0-9]', '', 'g') like $1 || '%'
         or position(regexp_replace(lower(name), '[^a-z0-9]', '', 'g') in $2) = 1
      order by name limit 5`,
    [key.slice(0, Math.min(4, key.length)), key],
  );
  return reply(near, "suggest", false);
});

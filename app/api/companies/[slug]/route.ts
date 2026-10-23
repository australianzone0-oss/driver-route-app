import { NextResponse } from "next/server";
import { handler, HttpError } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

/** Public: the company name shown on its login portal. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const rows = await query<{ name: string }>("select name from companies where slug = $1", [slug]);
  if (!rows[0]) throw new HttpError(404, "No company with that portal address.");
  return NextResponse.json({ name: rows[0].name, slug });
});

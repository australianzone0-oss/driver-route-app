import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { READY_JOBS_SQL, type ReadyJob } from "@/lib/server/finance";

export const GET = handler(async () => {
  const u = await requireUser("admin");
  const jobs = await query<ReadyJob>(READY_JOBS_SQL, [u.companyId]);
  return NextResponse.json({ jobs });
});

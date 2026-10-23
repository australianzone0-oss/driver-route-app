import { NextResponse } from "next/server";
import { endSession, handler } from "@/lib/server/auth";

export const POST = handler(async () => {
  await endSession();
  return NextResponse.json({ ok: true });
});

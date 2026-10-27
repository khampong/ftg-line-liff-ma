import { NextResponse } from "next/server";
import { clearSession } from "@/server/auth/session";
import { withErrorHandling } from "@/lib/api-error";

export const POST = withErrorHandling(async () => {
  await clearSession();
  return NextResponse.json({ success: true });
});

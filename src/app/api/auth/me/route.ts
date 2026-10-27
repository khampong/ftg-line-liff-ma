import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { withErrorHandling } from "@/lib/api-error";

export const GET = withErrorHandling(async () => {
  const session = await requireRole(); // ต้อง login แต่ไม่จำกัด role

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, displayName: true, role: true, active: true },
  });

  return NextResponse.json({ user });
});

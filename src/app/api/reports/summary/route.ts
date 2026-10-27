import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { reportDateRangeSchema } from "@/lib/schemas/report";
import { withErrorHandling } from "@/lib/api-error";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/reports/summary — สรุปจำนวนใบแจ้งซ่อมตามสถานะ ภายในช่วงเวลาที่กำหนด (Req 10.1, 10.4)
 * เข้าถึงได้: Admin, Manager
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN", "MANAGER"]);

  const { from, to } = reportDateRangeSchema.parse({
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });

  const where: Prisma.TicketWhereInput = {};
  if (from || to) {
    where.reportedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const grouped = await prisma.ticket.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const countByStatus: Record<string, number> = {
    NEW: 0,
    ACCEPTED: 0,
    IN_PROGRESS: 0,
    REPAIRED: 0,
    CLOSED: 0,
    CANCELLED: 0,
  };
  for (const row of grouped) {
    countByStatus[row.status] = row._count._all;
  }

  const total = Object.values(countByStatus).reduce((sum, n) => sum + n, 0);

  return NextResponse.json({
    total,
    byStatus: countByStatus,
    range: { from: from ?? null, to: to ?? null },
  });
});

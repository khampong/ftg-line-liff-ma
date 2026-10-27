import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { reportDateRangeSchema } from "@/lib/schemas/report";
import { withErrorHandling } from "@/lib/api-error";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/reports/avg-resolution — เวลาเฉลี่ยในการดำเนินการ (จากแจ้งใหม่ถึงปิดงาน) (Req 10.3)
 * คำนวณเฉพาะใบที่ปิดงานแล้ว (closedAt ไม่เป็น null) เพื่อความถูกต้องของค่าเฉลี่ย
 * เข้าถึงได้: Admin, Manager
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN", "MANAGER"]);

  const { from, to } = reportDateRangeSchema.parse({
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });

  const where: Prisma.TicketWhereInput = {
    status: "CLOSED",
    closedAt: { not: null },
  };
  if (from || to) {
    where.reportedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const closedTickets = await prisma.ticket.findMany({
    where,
    select: { reportedAt: true, closedAt: true },
  });

  if (closedTickets.length === 0) {
    return NextResponse.json({
      averageResolutionHours: null,
      sampleSize: 0,
      range: { from: from ?? null, to: to ?? null },
    });
  }

  const totalMs = closedTickets.reduce((sum, ticket) => {
    const closedAt = ticket.closedAt as Date;
    return sum + (closedAt.getTime() - ticket.reportedAt.getTime());
  }, 0);

  const averageMs = totalMs / closedTickets.length;
  const averageResolutionHours = Math.round((averageMs / (1000 * 60 * 60)) * 100) / 100;

  return NextResponse.json({
    averageResolutionHours,
    sampleSize: closedTickets.length,
    range: { from: from ?? null, to: to ?? null },
  });
});

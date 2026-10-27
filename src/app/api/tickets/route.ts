import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { ticketListQuerySchema } from "@/lib/schemas/ticket-action";
import { withErrorHandling } from "@/lib/api-error";
import type { Prisma } from "@prisma/client";

const TICKET_LIST_SELECT = {
  id: true,
  ticketNo: true,
  status: true,
  symptomCategories: true,
  reportedAt: true,
  asset: { select: { id: true, assetCode: true, model: true, location: true } },
  customer: { select: { id: true, name: true } },
  assignee: { select: { id: true, displayName: true } },
} as const;

/**
 * GET /api/tickets — list ใบแจ้งซ่อม พร้อม filter (Req 6.1, 6.2)
 * - ADMIN/MANAGER: เห็นทุกใบ
 * - TECHNICIAN: เห็นเฉพาะใบที่ตนเองรับผิดชอบ (Req 7.1)
 *
 * query params: status, customerId, assetId, assigneeId, from, to (ISO datetime)
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole(["ADMIN", "MANAGER", "TECHNICIAN"]);

  const query = ticketListQuerySchema.parse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    customerId: req.nextUrl.searchParams.get("customerId") ?? undefined,
    assetId: req.nextUrl.searchParams.get("assetId") ?? undefined,
    assigneeId: req.nextUrl.searchParams.get("assigneeId") ?? undefined,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });

  const where: Prisma.TicketWhereInput = {
    status: query.status,
    customerId: query.customerId,
    assetId: query.assetId,
    assigneeId: query.assigneeId,
  };

  if (query.from || query.to) {
    where.reportedAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  // ช่างเห็นเฉพาะงานตนเอง ไม่ว่า query จะขออะไรมา (Req 7.1) — บังคับที่ backend เสมอ
  if (session.role === "TECHNICIAN") {
    where.assigneeId = session.sub;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: TICKET_LIST_SELECT,
    orderBy: { reportedAt: "desc" },
  });

  return NextResponse.json({ tickets });
});

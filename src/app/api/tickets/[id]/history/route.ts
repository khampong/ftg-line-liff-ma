import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/tickets/[id]/history — ดูประวัติการเปลี่ยนแปลงของใบแจ้งซ่อม (Req 6.5) */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const session = await requireRole(["ADMIN", "MANAGER", "TECHNICIAN"]);
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { assigneeId: true } });
  if (!ticket) {
    throw new ApiError("NOT_FOUND", "ไม่พบใบแจ้งซ่อม");
  }

  if (session.role === "TECHNICIAN" && ticket.assigneeId !== session.sub) {
    throw new ApiError("FORBIDDEN", "คุณไม่มีสิทธิ์ดูประวัติของใบแจ้งซ่อมนี้");
  }

  const history = await prisma.ticketHistory.findMany({
    where: { ticketId: id },
    include: { actor: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ history });
});

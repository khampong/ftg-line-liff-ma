import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tickets/[id] — ดูรายละเอียดใบแจ้งซ่อม รวมรูปที่แนบ (Req 6.3)
 * TECHNICIAN เห็นได้เฉพาะใบที่ตนรับผิดชอบ (Req 7.1, 7.5)
 */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const session = await requireRole(["ADMIN", "MANAGER", "TECHNICIAN"]);
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, assetCode: true, model: true, location: true } },
      customer: { select: { id: true, name: true, phone: true, address: true } },
      assignee: { select: { id: true, displayName: true } },
      attachments: {
        select: { id: true, type: true, mimeType: true, size: true, createdAt: true },
      },
    },
  });

  if (!ticket) {
    throw new ApiError("NOT_FOUND", "ไม่พบใบแจ้งซ่อม");
  }

  if (session.role === "TECHNICIAN" && ticket.assigneeId !== session.sub) {
    throw new ApiError("FORBIDDEN", "คุณไม่มีสิทธิ์ดูใบแจ้งซ่อมนี้");
  }

  return NextResponse.json({ ticket });
});

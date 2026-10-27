import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { assignTicketSchema } from "@/lib/schemas/ticket-action";
import { assertTransition } from "@/server/services/ticket-state-machine";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/tickets/[id]/assign — มอบหมายช่างให้รับผิดชอบใบแจ้งซ่อม (เฉพาะ Admin)
 * เปลี่ยนสถานะ NEW -> ACCEPTED โดยอัตโนมัติ และบันทึกประวัติ (Req 6.4, 6.5)
 */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  const session = await requireRole(["ADMIN"]);
  const { id } = await params;

  const body = await req.json();
  const input = assignTicketSchema.parse(body);

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new ApiError("NOT_FOUND", "ไม่พบใบแจ้งซ่อม");
  }

  const technician = await prisma.user.findUnique({ where: { id: input.assigneeId } });
  if (!technician || !technician.active || technician.role !== "TECHNICIAN") {
    throw new ApiError("VALIDATION_ERROR", "ไม่พบช่างที่ระบุ หรือผู้ใช้นี้ไม่ใช่ช่าง");
  }

  assertTransition({
    fromStatus: ticket.status,
    toStatus: "ACCEPTED",
    actorRole: session.role,
    hasAssignee: true,
    hasRepairNote: Boolean(ticket.repairNote),
  });

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      assigneeId: input.assigneeId,
      status: "ACCEPTED",
      acceptedAt: new Date(),
      history: {
        create: {
          actorUserId: session.sub,
          fromStatus: ticket.status,
          toStatus: "ACCEPTED",
          note: `มอบหมายงานให้ ${technician.displayName}`,
        },
      },
    },
    include: { assignee: { select: { id: true, displayName: true } } },
  });

  return NextResponse.json({ ticket: updated });
});

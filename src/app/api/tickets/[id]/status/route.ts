import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { updateTicketStatusSchema } from "@/lib/schemas/ticket-action";
import {
  assertTransition,
  getTimestampFieldForStatus,
} from "@/server/services/ticket-state-machine";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/tickets/[id]/status — เปลี่ยนสถานะใบแจ้งซ่อมตาม state machine
 * (Req 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3)
 *
 * - ADMIN: เปลี่ยนได้ทุก transition ที่ state machine อนุญาต (รวมปิดงาน/เปิดงานใหม่/ยกเลิก)
 * - TECHNICIAN: เปลี่ยนได้เฉพาะ ACCEPTED->IN_PROGRESS->REPAIRED และเฉพาะใบที่ตนรับผิดชอบ
 * - MANAGER: ไม่มีสิทธิ์เปลี่ยนสถานะ (read-only)
 */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  const session = await requireRole(["ADMIN", "TECHNICIAN", "MANAGER"]);
  const { id } = await params;

  const body = await req.json();
  const input = updateTicketStatusSchema.parse(body);

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new ApiError("NOT_FOUND", "ไม่พบใบแจ้งซ่อม");
  }

  // ช่างแก้ไขได้เฉพาะใบที่ตนรับผิดชอบเท่านั้น (Req 7.5) — ตรวจก่อน assertTransition เพื่อ error message ชัดเจน
  if (session.role === "TECHNICIAN" && ticket.assigneeId !== session.sub) {
    throw new ApiError("FORBIDDEN", "คุณไม่มีสิทธิ์แก้ไขใบแจ้งซ่อมนี้");
  }

  if (ticket.status === "CLOSED" && input.status !== "ACCEPTED") {
    throw new ApiError(
      "FORBIDDEN",
      "ใบแจ้งซ่อมที่ปิดงานแล้วไม่สามารถแก้ไขได้ (ยกเว้นเปิดงานใหม่โดยแอดมิน)",
    );
  }

  assertTransition({
    fromStatus: ticket.status,
    toStatus: input.status,
    actorRole: session.role,
    hasAssignee: Boolean(ticket.assigneeId),
    hasRepairNote: Boolean(input.repairNote ?? ticket.repairNote),
  });

  const timestampField = getTimestampFieldForStatus(input.status);

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      status: input.status,
      ...(input.repairNote ? { repairNote: input.repairNote } : {}),
      ...(timestampField ? { [timestampField]: new Date() } : {}),
      history: {
        create: {
          actorUserId: session.sub,
          fromStatus: ticket.status,
          toStatus: input.status,
          note: input.note,
        },
      },
    },
    include: { assignee: { select: { id: true, displayName: true } } },
  });

  return NextResponse.json({ ticket: updated });
});

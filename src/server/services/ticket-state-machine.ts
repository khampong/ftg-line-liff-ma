import type { TicketStatus, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-error";

/**
 * State machine ของใบแจ้งซ่อม อ้างอิง design.md > สถานะและ State Machine ของใบแจ้งซ่อม
 *
 *   NEW --> ACCEPTED --> IN_PROGRESS --> REPAIRED --> CLOSED
 *   CLOSED --> ACCEPTED (เปิดงานใหม่)
 *   NEW/ACCEPTED/IN_PROGRESS --> CANCELLED
 */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["REPAIRED", "CANCELLED"],
  REPAIRED: ["CLOSED"],
  CLOSED: ["ACCEPTED"],
  CANCELLED: [],
};

export interface TransitionContext {
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  actorRole: UserRole;
  /** มีการระบุช่างที่รับผิดชอบแล้วหรือยัง (ต้องมีก่อนเข้าสถานะ ACCEPTED) */
  hasAssignee: boolean;
  /** มีการบันทึกผลการซ่อมแล้วหรือยัง (ต้องมีก่อนเข้าสถานะ REPAIRED) */
  hasRepairNote: boolean;
}

/**
 * ตรวจสอบว่าการเปลี่ยนสถานะนี้ถูกต้องหรือไม่ ทั้งในมุม state machine และสิทธิ์ผู้ใช้
 * throw ApiError("INVALID_TRANSITION") ถ้าไม่ถูกต้อง ไม่ throw ถ้าผ่านทุกเงื่อนไข
 *
 * (Req 6.4, 7.2, 7.3, 7.4, 8.1)
 */
export function assertTransition(ctx: TransitionContext): void {
  const { fromStatus, toStatus, actorRole, hasAssignee, hasRepairNote } = ctx;

  const allowedNextStates = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowedNextStates.includes(toStatus)) {
    throw new ApiError(
      "INVALID_TRANSITION",
      `ไม่สามารถเปลี่ยนสถานะจาก ${fromStatus} ไป ${toStatus} ได้`,
    );
  }

  // NEW -> ACCEPTED ต้องระบุช่างที่รับผิดชอบแล้ว (Req 6.4)
  if (toStatus === "ACCEPTED" && !hasAssignee) {
    throw new ApiError("VALIDATION_ERROR", "ต้องระบุช่างที่รับผิดชอบก่อนเปลี่ยนเป็นสถานะรับเรื่อง");
  }

  // IN_PROGRESS -> REPAIRED ต้องมีบันทึกผลการซ่อม (Req 7.3)
  if (toStatus === "REPAIRED" && !hasRepairNote) {
    throw new ApiError("VALIDATION_ERROR", "ต้องบันทึกผลการซ่อมก่อนเปลี่ยนเป็นสถานะซ่อมเสร็จ");
  }

  // ปิดงาน/เปิดงานใหม่ (CLOSED <-> ACCEPTED) ทำได้เฉพาะ Admin (Req 8.1)
  if ((toStatus === "CLOSED" || fromStatus === "CLOSED") && actorRole !== "ADMIN") {
    throw new ApiError("FORBIDDEN", "เฉพาะแอดมินเท่านั้นที่ปิดงาน/เปิดงานใหม่ได้");
  }

  // ช่างเปลี่ยนสถานะได้เฉพาะ ACCEPTED -> IN_PROGRESS -> REPAIRED (งานของตนเอง ตรวจสิทธิ์ assignee แยกที่ route)
  if (actorRole === "TECHNICIAN") {
    const technicianAllowedTransitions: Array<[TicketStatus, TicketStatus]> = [
      ["ACCEPTED", "IN_PROGRESS"],
      ["IN_PROGRESS", "REPAIRED"],
    ];
    const isAllowedForTechnician = technicianAllowedTransitions.some(
      ([from, to]) => from === fromStatus && to === toStatus,
    );
    if (!isAllowedForTechnician) {
      throw new ApiError("FORBIDDEN", "ช่างไม่มีสิทธิ์เปลี่ยนสถานะนี้");
    }
  }

  // Manager เป็น read-only ไม่มีสิทธิ์เปลี่ยนสถานะใดๆ
  if (actorRole === "MANAGER") {
    throw new ApiError("FORBIDDEN", "ผู้บริหารไม่มีสิทธิ์เปลี่ยนสถานะใบแจ้งซ่อม");
  }
}

/** timestamp field ที่ต้อง set ตาม status ปลายทาง (Req 10.3 ใช้คำนวณ avg resolution time) */
export function getTimestampFieldForStatus(
  status: TicketStatus,
): "acceptedAt" | "repairedAt" | "closedAt" | null {
  switch (status) {
    case "ACCEPTED":
      return "acceptedAt";
    case "REPAIRED":
      return "repairedAt";
    case "CLOSED":
      return "closedAt";
    default:
      return null;
  }
}

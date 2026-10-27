import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { readStoredImage } from "@/server/storage/file-storage";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/attachments/[id] — stream ไฟล์รูปแนบของใบแจ้งซ่อม
 * (Req 11.3) ควบคุมสิทธิ์: Admin/Manager เข้าถึงได้ทุกใบ, Technician เข้าถึงได้เฉพาะใบที่ตนรับผิดชอบ
 */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  const session = await requireRole(["ADMIN", "MANAGER", "TECHNICIAN"]);
  const { id } = await params;

  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { assigneeId: true } } },
  });

  if (!attachment) {
    throw new ApiError("NOT_FOUND", "ไม่พบไฟล์แนบ");
  }

  if (session.role === "TECHNICIAN" && attachment.ticket.assigneeId !== session.sub) {
    throw new ApiError("FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงไฟล์แนบของใบแจ้งซ่อมนี้");
  }

  const buffer = await readStoredImage(attachment.filePath);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
});

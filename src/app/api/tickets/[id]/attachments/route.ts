import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { saveUploadedImage } from "@/server/storage/file-storage";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_ATTACHMENTS_PER_REQUEST = 5;

/**
 * POST /api/tickets/[id]/attachments — แนบรูปเพิ่มเติม (เช่น รูปหลังซ่อม) (Req 7.3)
 * ADMIN แนบได้ทุกใบ, TECHNICIAN แนบได้เฉพาะใบที่ตนรับผิดชอบ, ห้ามแนบถ้าใบงานปิดแล้ว (Req 8.3)
 */
export const POST = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  const session = await requireRole(["ADMIN", "TECHNICIAN"]);
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new ApiError("NOT_FOUND", "ไม่พบใบแจ้งซ่อม");
  }

  if (session.role === "TECHNICIAN" && ticket.assigneeId !== session.sub) {
    throw new ApiError("FORBIDDEN", "คุณไม่มีสิทธิ์แนบไฟล์ในใบแจ้งซ่อมนี้");
  }

  if (ticket.status === "CLOSED") {
    throw new ApiError("FORBIDDEN", "ใบแจ้งซ่อมที่ปิดงานแล้วไม่สามารถแก้ไขได้");
  }

  const formData = await req.formData();
  const imageFiles = formData.getAll("images").filter((v): v is File => v instanceof File);

  if (imageFiles.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "กรุณาแนบรูปอย่างน้อย 1 รูป");
  }
  if (imageFiles.length > MAX_ATTACHMENTS_PER_REQUEST) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `แนบรูปได้ไม่เกิน ${MAX_ATTACHMENTS_PER_REQUEST} รูปต่อครั้ง`,
    );
  }

  const attachments = [];
  for (const file of imageFiles) {
    const saved = await saveUploadedImage(file);
    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        type: "REPAIR",
        filePath: saved.filePath,
        mimeType: saved.mimeType,
        size: saved.size,
      },
      select: { id: true, type: true, mimeType: true, size: true, createdAt: true },
    });
    attachments.push(attachment);
  }

  return NextResponse.json({ attachments }, { status: 201 });
});

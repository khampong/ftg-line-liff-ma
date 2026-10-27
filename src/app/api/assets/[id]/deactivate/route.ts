import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/assets/[id]/deactivate — ปิดใช้งานรถ (soft delete, เฉพาะ Admin)
 * ไม่ลบข้อมูลถาวรเพื่อรักษาประวัติใบแจ้งซ่อมที่อ้างอิงอยู่ (Req 4.4)
 * รถที่ถูกปิดใช้งานจะสแกน QR แจ้งซ่อมไม่ได้อีก (เพราะ endpoint LIFF จะเช็ค asset.active)
 */
export const PATCH = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "ไม่พบรถ");
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ asset });
});

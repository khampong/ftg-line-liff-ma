import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/customers/[id]/deactivate — ปิดใช้งานลูกค้า (soft delete, เฉพาะ Admin)
 * ไม่ลบข้อมูลถาวรเพื่อรักษาประวัติใบแจ้งซ่อมที่อ้างอิงอยู่ (Req 4.1)
 */
export const PATCH = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "ไม่พบลูกค้า");
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ customer });
});

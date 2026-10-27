import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { updateAssetSchema } from "@/lib/schemas/asset";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/assets/[id] — ดูรายละเอียดรถหนึ่งคัน */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!asset) {
    throw new ApiError("NOT_FOUND", "ไม่พบรถ");
  }

  return NextResponse.json({ asset });
});

/** PATCH /api/assets/[id] — แก้ไขข้อมูลรถ (เฉพาะ Admin) */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const body = await req.json();
  const input = updateAssetSchema.parse(body);

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "ไม่พบรถ");
  }

  if (input.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new ApiError("VALIDATION_ERROR", "ไม่พบลูกค้าที่ระบุ (customerId)");
    }
  }

  if (input.assetCode && input.assetCode !== existing.assetCode) {
    const duplicate = await prisma.asset.findUnique({ where: { assetCode: input.assetCode } });
    if (duplicate) {
      throw new ApiError("CONFLICT", "มีรหัสรถนี้อยู่แล้ว");
    }
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: input,
    include: { customer: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ asset });
});

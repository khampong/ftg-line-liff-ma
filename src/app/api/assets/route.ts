import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { createAssetSchema } from "@/lib/schemas/asset";
import { ApiError, withErrorHandling } from "@/lib/api-error";

/** GET /api/assets — list รถทั้งหมด (Admin + Manager อ่านได้) รองรับกรองด้วย customerId */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN", "MANAGER"]);

  const customerId = req.nextUrl.searchParams.get("customerId") ?? undefined;

  const assets = await prisma.asset.findMany({
    where: customerId ? { customerId } : undefined,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ assets });
});

/** POST /api/assets — สร้างรถใหม่ ผูกกับลูกค้าหนึ่งราย (เฉพาะ Admin) */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN"]);

  const body = await req.json();
  const input = createAssetSchema.parse(body);

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) {
    throw new ApiError("VALIDATION_ERROR", "ไม่พบลูกค้าที่ระบุ (customerId)");
  }

  const existingAsset = await prisma.asset.findUnique({ where: { assetCode: input.assetCode } });
  if (existingAsset) {
    throw new ApiError("CONFLICT", "มีรหัสรถนี้อยู่แล้ว");
  }

  const asset = await prisma.asset.create({
    data: input,
    include: { customer: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ asset }, { status: 201 });
});

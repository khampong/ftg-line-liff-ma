import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { updateCustomerSchema } from "@/lib/schemas/customer";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/customers/[id] — ดูรายละเอียดลูกค้าหนึ่งราย */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    throw new ApiError("NOT_FOUND", "ไม่พบลูกค้า");
  }

  return NextResponse.json({ customer });
});

/** PATCH /api/customers/[id] — แก้ไขข้อมูลลูกค้า (เฉพาะ Admin) */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const body = await req.json();
  const input = updateCustomerSchema.parse(body);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "ไม่พบลูกค้า");
  }

  const customer = await prisma.customer.update({ where: { id }, data: input });

  return NextResponse.json({ customer });
});

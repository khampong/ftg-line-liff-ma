import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { createCustomerSchema } from "@/lib/schemas/customer";
import { withErrorHandling } from "@/lib/api-error";

/** GET /api/customers — list ลูกค้าทั้งหมด (Admin + Manager อ่านได้, Manager read-only) */
export const GET = withErrorHandling(async () => {
  await requireRole(["ADMIN", "MANAGER"]);

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ customers });
});

/** POST /api/customers — สร้างลูกค้าใหม่ (เฉพาะ Admin) */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN"]);

  const body = await req.json();
  const input = createCustomerSchema.parse(body);

  const customer = await prisma.customer.create({ data: input });

  return NextResponse.json({ customer }, { status: 201 });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { hashPassword } from "@/server/auth/password";
import { createUserSchema } from "@/lib/schemas/user";
import { ApiError, withErrorHandling } from "@/lib/api-error";

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** GET /api/users — list ผู้ใช้หลังบ้านทั้งหมด (เฉพาะ Admin) */
export const GET = withErrorHandling(async () => {
  await requireRole(["ADMIN"]);

  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
});

/** POST /api/users — สร้างผู้ใช้หลังบ้านใหม่ (เฉพาะ Admin) */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN"]);

  const body = await req.json();
  const input = createUserSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new ApiError("CONFLICT", "มีชื่อผู้ใช้นี้อยู่แล้ว");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
    },
    select: USER_SELECT,
  });

  return NextResponse.json({ user }, { status: 201 });
});

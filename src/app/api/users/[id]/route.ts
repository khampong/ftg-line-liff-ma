import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { hashPassword } from "@/server/auth/password";
import { updateUserSchema } from "@/lib/schemas/user";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/users/[id] — ดูรายละเอียดผู้ใช้หนึ่งคน (เฉพาะ Admin) */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) {
    throw new ApiError("NOT_FOUND", "ไม่พบผู้ใช้");
  }

  return NextResponse.json({ user });
});

/** PATCH /api/users/[id] — แก้ไขข้อมูลผู้ใช้ / เปลี่ยน role / ปิดใช้งาน / เปลี่ยนรหัสผ่าน (เฉพาะ Admin) */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const body = await req.json();
  const input = updateUserSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "ไม่พบผู้ใช้");
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      displayName: input.displayName,
      role: input.role,
      active: input.active,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: USER_SELECT,
  });

  return NextResponse.json({ user });
});

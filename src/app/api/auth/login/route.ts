import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { loginSchema } from "@/lib/schemas/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json();
  const { username, password } = loginSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { username } });

  // ไม่บอกว่า username ไม่มีอยู่ หรือ password ผิด (ป้องกัน user enumeration)
  const invalidCredentialsError = () =>
    new ApiError("UNAUTHORIZED", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

  if (!user || !user.active) {
    throw invalidCredentialsError();
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    throw invalidCredentialsError();
  }

  await createSession({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

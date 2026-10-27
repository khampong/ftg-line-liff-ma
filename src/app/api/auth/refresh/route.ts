import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { verifyRefreshToken } from "@/server/auth/jwt";
import { createSession, getRefreshTokenFromCookie } from "@/server/auth/session";
import { ApiError, withErrorHandling } from "@/lib/api-error";

/**
 * ต่ออายุ access token โดยใช้ refresh token cookie
 * ตรวจ user จาก DB ซ้ำ (ไม่เชื่อ payload อย่างเดียว) เผื่อกรณี user ถูกปิดใช้งาน/เปลี่ยน role หลัง login
 */
export const POST = withErrorHandling(async () => {
  const refreshToken = await getRefreshTokenFromCookie();
  if (!refreshToken) {
    throw new ApiError("UNAUTHORIZED", "ไม่พบ session กรุณาเข้าสู่ระบบใหม่");
  }

  const decoded = await verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw new ApiError("UNAUTHORIZED", "session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || !user.active) {
    throw new ApiError("UNAUTHORIZED", "บัญชีผู้ใช้ไม่พร้อมใช้งาน กรุณาเข้าสู่ระบบใหม่");
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

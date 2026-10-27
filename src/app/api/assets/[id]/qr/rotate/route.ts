import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { issueNewQrToken, buildLiffUrlForToken } from "@/server/services/qr-token";
import { env } from "@/server/env";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/assets/[id]/qr/rotate — ออก QR token ใหม่ให้รถ (ยกเลิก token เดิมอัตโนมัติ)
 * ใช้ตอน QR หาย/ถูกคัดลอก หรือต้องการออก QR ครั้งแรกให้รถที่ยังไม่มี token (เฉพาะ Admin)
 * (Req 5.1, 5.4)
 */
export const POST = withErrorHandling(async (_req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) {
    throw new ApiError("NOT_FOUND", "ไม่พบรถ");
  }

  const qrToken = await issueNewQrToken(id);
  const liffUrl = buildLiffUrlForToken(qrToken.token, env.NEXT_PUBLIC_LIFF_ID, env.PUBLIC_BASE_URL);

  return NextResponse.json({
    qrToken: {
      id: qrToken.id,
      token: qrToken.token,
      active: qrToken.active,
      createdAt: qrToken.createdAt,
    },
    liffUrl,
  });
});

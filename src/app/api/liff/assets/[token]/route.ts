import { NextRequest, NextResponse } from "next/server";
import { authenticateLineUser } from "@/server/line/auth";
import { resolveAssetByQrToken } from "@/server/services/qr-token";
import { prisma } from "@/server/db";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/liff/assets/[token] — ดูบริบทรถจาก QR token ที่สแกนได้
 * (Req 1.1, 1.2, 2.1, 2.2, 2.3, 5.5)
 *
 * ขั้นตอน:
 * 1. verify LINE access token (ส่งมาใน header Authorization: Bearer <token>)
 * 2. ตรวจสอบว่าเป็นเพื่อนกับ LINE OA แล้วหรือไม่ (ถ้ายังไม่เป็น -> 403 NOT_FRIEND)
 * 3. resolve asset จาก QR token (ถ้า token ผิด/ถูก revoke/รถถูกปิดใช้งาน -> error ตาม qr-token.ts)
 */
export const GET = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  const { token } = await params;

  const authHeader = req.headers.get("authorization") ?? "";
  const lineAccessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const { profile, isFriend } = await authenticateLineUser(lineAccessToken);

  if (!isFriend) {
    throw new ApiError("NOT_FRIEND", "กรุณาเพิ่มเพื่อน LINE Official Account ก่อนแจ้งซ่อม");
  }

  const { asset } = await resolveAssetByQrToken(token);

  const customer = await prisma.customer.findUnique({
    where: { id: asset.customerId },
    select: { name: true, location: true },
  });

  return NextResponse.json({
    asset: {
      assetCode: asset.assetCode,
      model: asset.model,
      location: asset.location,
    },
    customer: {
      name: customer?.name ?? null,
      location: customer?.location ?? null,
    },
    reporter: {
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? null,
    },
  });
});

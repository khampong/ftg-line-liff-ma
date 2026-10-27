import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { ApiError } from "@/lib/api-error";
import type { Asset, AssetQrToken } from "@prisma/client";

/**
 * สร้าง token แบบ opaque, non-guessable สำหรับฝังใน QR (Req 5.2)
 * 32 bytes -> 43 ตัวอักษร base64url ซึ่งเดายากเพียงพอ และปลอดภัยสำหรับใส่ใน URL
 */
function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * ออก QR token ใหม่ให้กับรถ พร้อมยกเลิก token เดิมที่ active อยู่ (ถ้ามี)
 * ใช้ทั้งตอนสร้างรถใหม่ (ยังไม่มี token เดิม) และตอน rotate (มี token เดิมที่ต้อง revoke)
 * (Req 5.1, 5.2, 5.4)
 */
export async function issueNewQrToken(assetId: string): Promise<AssetQrToken> {
  return prisma.$transaction(async (tx) => {
    await tx.assetQrToken.updateMany({
      where: { assetId, active: true },
      data: { active: false, revokedAt: new Date() },
    });

    // ป้องกัน token ชนกัน (ความเป็นไปได้ต่ำมากแต่ทำ retry ไว้เพื่อความปลอดภัย)
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = generateOpaqueToken();
      const existing = await tx.assetQrToken.findUnique({ where: { token } });
      if (!existing) {
        return tx.assetQrToken.create({ data: { assetId, token } });
      }
    }
    throw new ApiError("INTERNAL_ERROR", "ไม่สามารถออก QR token ได้ กรุณาลองใหม่อีกครั้ง");
  });
}

export interface ResolvedAssetToken {
  token: AssetQrToken;
  asset: Asset;
}

/**
 * ตรวจสอบ token ที่ได้จากการสแกน QR และคืนข้อมูลรถที่ผูกอยู่
 * ใช้โดย endpoint ฝั่ง LIFF (Req 2.1, 2.3, 5.5)
 *
 * throw INVALID_QR ถ้าไม่พบ token หรือรถถูกปิดใช้งานแล้ว
 * throw QR_REVOKED ถ้า token นี้ถูกยกเลิกไปแล้ว (rotate แล้ว)
 */
export async function resolveAssetByQrToken(token: string): Promise<ResolvedAssetToken> {
  const qrToken = await prisma.assetQrToken.findUnique({
    where: { token },
    include: { asset: true },
  });

  if (!qrToken) {
    throw new ApiError("INVALID_QR", "QR ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
  }

  if (!qrToken.active) {
    throw new ApiError("QR_REVOKED", "QR นี้ถูกยกเลิกการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ");
  }

  if (!qrToken.asset.active) {
    throw new ApiError("INVALID_QR", "รถคันนี้ถูกปิดใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ");
  }

  return { token: qrToken, asset: qrToken.asset };
}

/** สร้าง URL ของ LIFF ที่ฝัง token ไว้ ใช้ประกอบเป็น QR code (Req 5.1) */
export function buildLiffUrlForToken(token: string, liffId: string, baseUrl: string): string {
  if (liffId) {
    // ถ้ามี LIFF ID ให้ใช้ liff.line.me เพื่อเปิดผ่าน LINE โดยตรง
    return `https://liff.line.me/${liffId}?asset=${encodeURIComponent(token)}`;
  }
  // fallback: เปิดผ่าน URL เว็บของเราตรงๆ (เช่นตอน dev ที่ยังไม่ผูก LIFF ID จริง)
  return `${baseUrl}/liff?asset=${encodeURIComponent(token)}`;
}

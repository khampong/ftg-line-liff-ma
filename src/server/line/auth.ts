import { ApiError } from "@/lib/api-error";
import {
  getLineFriendshipStatus,
  getLineProfile,
  verifyLineAccessToken,
  type LineProfile,
} from "@/server/line/client";

export interface LineAuthResult {
  profile: LineProfile;
  isFriend: boolean;
}

/**
 * Verify LINE access token + ตรวจสอบสถานะเพื่อน + ดึง profile ในขั้นตอนเดียว
 * ใช้เป็น entry point หลักสำหรับทุก endpoint ฝั่ง LIFF ที่ต้องยืนยันตัวตนลูกค้า (Req 1)
 *
 * throw UNAUTHORIZED ถ้า token ไม่ถูกต้อง/หมดอายุ/ไม่ตรง channel
 */
export async function authenticateLineUser(accessToken: string): Promise<LineAuthResult> {
  if (!accessToken) {
    throw new ApiError("UNAUTHORIZED", "ไม่พบ LINE access token");
  }

  await verifyLineAccessToken(accessToken);

  const [profile, friendship] = await Promise.all([
    getLineProfile(accessToken),
    getLineFriendshipStatus(accessToken),
  ]);

  return { profile, isFriend: friendship.friendFlag };
}

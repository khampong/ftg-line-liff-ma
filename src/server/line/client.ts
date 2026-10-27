import { env } from "@/server/env";
import { ApiError } from "@/lib/api-error";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LINE_PROFILE_URL = "https://api.line.me/v2/profile";
const LINE_FRIENDSHIP_URL = "https://api.line.me/friendship/v1/status";

export interface LineVerifyTokenResult {
  clientId: string;
  expiresIn: number;
  scope: string;
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LineFriendshipStatus {
  friendFlag: boolean;
}

/**
 * ตรวจสอบว่า LINE access token ยังใช้ได้จริงและออกให้ channel ของเรา
 * (Req 1.4, 1.5) — ไม่เชื่อ userId ที่ client ส่งมาตรงๆ ต้อง verify กับ LINE ก่อนเสมอ
 *
 * GET https://api.line.me/oauth2/v2.1/verify?access_token=...
 * ดู: https://developers.line.biz/en/reference/line-login/#verify-access-token
 */
export async function verifyLineAccessToken(accessToken: string): Promise<LineVerifyTokenResult> {
  const url = new URL(LINE_VERIFY_URL);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    throw new ApiError("UNAUTHORIZED", "LINE access token ไม่ถูกต้องหรือหมดอายุ");
  }

  const data = (await res.json()) as { client_id: string; expires_in: number; scope: string };

  if (data.client_id !== env.LINE_LOGIN_CHANNEL_ID) {
    throw new ApiError("UNAUTHORIZED", "LINE access token ไม่ได้ออกให้ช่องทางนี้");
  }

  return { clientId: data.client_id, expiresIn: data.expires_in, scope: data.scope };
}

/**
 * ดึงข้อมูล LINE profile (userId, displayName, pictureUrl) ด้วย access token ที่ verify แล้ว
 * (Req 1.4)
 *
 * GET https://api.line.me/v2/profile
 * ดู: https://developers.line.biz/en/reference/line-login/#get-user-profile
 */
export async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch(LINE_PROFILE_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new ApiError("UNAUTHORIZED", "ไม่สามารถดึงข้อมูลผู้ใช้ LINE ได้");
  }

  return (await res.json()) as LineProfile;
}

/**
 * ตรวจสอบว่าผู้ใช้เป็นเพื่อนกับ LINE Official Account ที่ผูกกับ LINE Login channel นี้หรือไม่
 * (Req 1.1, 1.2, 1.3)
 *
 * GET https://api.line.me/friendship/v1/status
 * ดู: https://developers.line.biz/en/reference/line-login/#get-friendship-status
 */
export async function getLineFriendshipStatus(accessToken: string): Promise<LineFriendshipStatus> {
  const res = await fetch(LINE_FRIENDSHIP_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new ApiError("UNAUTHORIZED", "ไม่สามารถตรวจสอบสถานะเพื่อนกับ LINE OA ได้");
  }

  return (await res.json()) as LineFriendshipStatus;
}

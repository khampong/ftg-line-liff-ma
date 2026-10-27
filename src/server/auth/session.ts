import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  type DecodedSession,
  type SessionPayload,
} from "@/server/auth/jwt";

export const ACCESS_COOKIE_NAME = "forklift_access_token";
export const REFRESH_COOKIE_NAME = "forklift_refresh_token";

const isProduction = process.env.NODE_ENV === "production";

const ACCESS_COOKIE_MAX_AGE_SEC = 15 * 60; // 15 นาที ตรงกับ ACCESS_TOKEN_TTL
const REFRESH_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 วัน ตรงกับ REFRESH_TOKEN_TTL

/**
 * ออก access + refresh token คู่ใหม่ แล้วเซ็ตเป็น httpOnly cookie
 * เรียกใช้ตอน login สำเร็จ หรือตอน refresh token
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE_SEC,
  });
  cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_SEC,
  });
}

/** ล้าง session cookie ทั้งคู่ ใช้ตอน logout */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

/**
 * อ่าน session ปัจจุบันจาก access token cookie
 * คืน null ถ้าไม่มี cookie หรือ token ไม่ถูกต้อง/หมดอายุ
 */
export async function getSession(): Promise<DecodedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function getRefreshTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

export type { SessionPayload, DecodedSession };
export type SessionRole = UserRole;

import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/env";
import type { UserRole } from "@prisma/client";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

/** payload ที่ฝังใน JWT ทั้ง access และ refresh token */
export interface SessionPayload {
  sub: string; // userId
  username: string;
  role: UserRole;
}

export interface DecodedSession extends SessionPayload {
  iat: number;
  exp: number;
}

async function signToken(
  payload: SessionPayload,
  secret: Uint8Array,
  ttl: string,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret);
}

export function signAccessToken(payload: SessionPayload): Promise<string> {
  return signToken(payload, accessSecret, ACCESS_TOKEN_TTL);
}

export function signRefreshToken(payload: SessionPayload): Promise<string> {
  return signToken(payload, refreshSecret, REFRESH_TOKEN_TTL);
}

async function verifyToken(token: string, secret: Uint8Array): Promise<DecodedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as DecodedSession;
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): Promise<DecodedSession | null> {
  return verifyToken(token, accessSecret);
}

export function verifyRefreshToken(token: string): Promise<DecodedSession | null> {
  return verifyToken(token, refreshSecret);
}

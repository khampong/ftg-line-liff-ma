import type { UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { getSession } from "@/server/auth/session";
import type { DecodedSession } from "@/server/auth/jwt";

/**
 * Pure logic ของการตรวจสิทธิ์ (แยกออกมาเพื่อ unit test ได้โดยไม่ต้อง mock next/headers)
 *
 * throw ApiError("UNAUTHORIZED") ถ้า session เป็น null (ยังไม่ login / token ไม่ถูกต้อง)
 * throw ApiError("FORBIDDEN") ถ้า login แล้วแต่ role ไม่ตรง (พร้อม log การเข้าถึงเกินสิทธิ์)
 *
 * @param allowedRoles ถ้าไม่ระบุ (ปล่อยว่าง) จะอนุญาตทุก role ที่ login แล้ว
 */
export function assertRole(
  session: DecodedSession | null,
  allowedRoles?: UserRole[],
): DecodedSession {
  if (!session) {
    throw new ApiError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบก่อนใช้งาน");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    console.warn(
      `[RBAC] Forbidden access attempt: user=${session.username} role=${session.role} required=[${allowedRoles.join(",")}]`,
    );
    throw new ApiError("FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้");
  }

  return session;
}

/**
 * บังคับว่าต้องล็อกอินและมี role อยู่ในลิสต์ที่อนุญาต
 * ใช้ในทุก Route Handler ที่ต้องจำกัดสิทธิ์ (source of truth ของ RBAC ตาม design.md)
 *
 * @param allowedRoles ถ้าไม่ระบุ (ปล่อยว่าง) จะอนุญาตทุก role ที่ login แล้ว
 */
export async function requireRole(allowedRoles?: UserRole[]): Promise<DecodedSession> {
  const session = await getSession();
  return assertRole(session, allowedRoles);
}

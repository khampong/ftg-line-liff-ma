import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/server/auth/jwt";
import { ACCESS_COOKIE_NAME } from "@/server/auth/session";

/**
 * Proxy (เดิมชื่อ Middleware ก่อน Next.js 16): ป้องกัน route /admin/* ที่ระดับ UX
 * (redirect ไป login ถ้าไม่มี session)
 *
 * หมายเหตุความปลอดภัย: นี่เป็นแค่ชั้น UX เท่านั้น
 * source of truth ของ RBAC คือ `requireRole()` ที่เรียกในทุก Route Handler (/api/**)
 * เพราะ proxy ตรวจได้แค่ "มี token ที่ decode ได้" แต่ไม่เจาะจงตรวจ role ต่อ endpoint
 */
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const session = token ? await verifyAccessToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Readiness probe: ตรวจว่าแอปพร้อมรับ traffic จริง (ต่อฐานข้อมูลได้)
 * ใช้กับ Kubernetes readinessProbe (Req 12.4)
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return NextResponse.json({ status: "error", database: "down" }, { status: 503 });
  }
}

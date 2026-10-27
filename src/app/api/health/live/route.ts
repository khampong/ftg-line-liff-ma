import { NextResponse } from "next/server";

/**
 * Liveness probe: ตอบกลับว่า process ยังทำงานอยู่ ไม่ต้องพึ่งพา dependency ภายนอก
 * ใช้กับ Kubernetes livenessProbe (Req 12.4)
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

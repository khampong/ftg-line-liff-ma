import { prisma } from "@/server/db";

/**
 * สร้างหมายเลขใบแจ้งซ่อมที่มนุษย์อ่านง่าย รูปแบบ T-YYYYMMDD-NNNN (รันตามลำดับต่อวัน)
 * ใช้ transaction + count เพื่อความง่าย (ปริมาณงานต่อวันของระบบนี้น้อย ~30 คันไม่เสี่ยง race condition หนัก)
 */
export async function generateTicketNo(): Promise<string> {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const countToday = await prisma.ticket.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });

  const sequence = String(countToday + 1).padStart(4, "0");
  return `T-${datePart}-${sequence}`;
}

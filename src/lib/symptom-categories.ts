/**
 * หมวดอาการเสีย — ใช้ร่วมกันทั้ง client (แสดงผล) และต้องตรงกับ enum SymptomCategory ใน prisma/schema.prisma
 */
export const SYMPTOM_CATEGORIES = [
  { value: "ENGINE_NO_START", label: "เครื่องยนต์/สตาร์ทไม่ติด" },
  { value: "LIFT_FAIL", label: "ระบบยก/ยกไม่ขึ้น" },
  { value: "BRAKE", label: "เบรก" },
  { value: "ELECTRICAL", label: "ระบบไฟฟ้า/ไฟเตือน" },
  { value: "TIRE_WHEEL", label: "ยาง/ล้อ" },
  { value: "HYDRAULIC", label: "ระบบไฮดรอลิก/น้ำมันรั่ว" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

export type SymptomCategoryValue = (typeof SYMPTOM_CATEGORIES)[number]["value"];

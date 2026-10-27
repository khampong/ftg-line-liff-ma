import { z } from "zod";

export const symptomCategorySchema = z.enum([
  "ENGINE_NO_START",
  "LIFT_FAIL",
  "BRAKE",
  "ELECTRICAL",
  "TIRE_WHEEL",
  "HYDRAULIC",
  "OTHER",
]);

export type SymptomCategoryInput = z.infer<typeof symptomCategorySchema>;

/**
 * ฟอร์มแจ้งซ่อมจาก LIFF (Req 3.1, 3.2, 3.4)
 * - ต้องเลือกอาการอย่างน้อย 1 หมวด
 * - ถ้าเลือก OTHER ต้องกรอก description ด้วย (บังคับ)
 */
export const createTicketFromLiffSchema = z
  .object({
    assetToken: z.string().min(1, "ไม่พบข้อมูลรถ"),
    symptomCategories: z.array(symptomCategorySchema).min(1, "กรุณาเลือกอาการเสียอย่างน้อย 1 หมวด"),
    description: z.string().trim().max(2000, "รายละเอียดยาวเกินไป").optional(),
  })
  .refine(
    (data) => !data.symptomCategories.includes("OTHER") || Boolean(data.description?.length),
    {
      message: "กรุณากรอกรายละเอียดเพิ่มเติมเมื่อเลือกหมวด 'อื่นๆ'",
      path: ["description"],
    },
  );

export type CreateTicketFromLiffInput = z.infer<typeof createTicketFromLiffSchema>;

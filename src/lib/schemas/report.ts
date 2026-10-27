import { z } from "zod";

/** ช่วงเวลาสำหรับกรองรายงาน ใช้ query param ?from=...&to=... (ISO datetime) */
export const reportDateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;

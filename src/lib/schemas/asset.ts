import { z } from "zod";

export const createAssetSchema = z.object({
  customerId: z.string().uuid("customerId ไม่ถูกต้อง"),
  assetCode: z.string().min(1, "กรุณากรอกรหัสรถ"),
  model: z.string().optional(),
  serialNo: z.string().optional(),
  location: z.string().optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = z.object({
  customerId: z.string().uuid("customerId ไม่ถูกต้อง").optional(),
  assetCode: z.string().min(1, "กรุณากรอกรหัสรถ").optional(),
  model: z.string().optional(),
  serialNo: z.string().optional(),
  location: z.string().optional(),
  active: z.boolean().optional(),
});

export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

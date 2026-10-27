import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อลูกค้า").optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
  active: z.boolean().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

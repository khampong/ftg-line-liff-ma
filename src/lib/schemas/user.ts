import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร")
  .max(50, "ชื่อผู้ใช้ต้องไม่เกิน 50 ตัวอักษร")
  .regex(/^[a-zA-Z0-9_.-]+$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, A-Z, 0-9, _ . -");

const passwordSchema = z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");

export const userRoleSchema = z.enum(["ADMIN", "TECHNICIAN", "MANAGER"]);

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().min(1, "กรุณากรอกชื่อที่ใช้แสดง"),
  role: userRoleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: z.string().min(1, "กรุณากรอกชื่อที่ใช้แสดง").optional(),
  role: userRoleSchema.optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

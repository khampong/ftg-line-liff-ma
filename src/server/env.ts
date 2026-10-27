import { z } from "zod";

/**
 * Type-safe environment config
 * อ่านและ validate env variables ตั้งแต่ตอน import โมดูลนี้ครั้งแรก
 * ถ้า env ไม่ครบ/ไม่ถูกต้อง จะ throw ทันทีตอน start แอป (fail fast)
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),

  LINE_CHANNEL_ID: z.string().optional().default(""),
  LINE_CHANNEL_SECRET: z.string().optional().default(""),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional().default(""),
  LINE_LOGIN_CHANNEL_ID: z.string().optional().default(""),
  NEXT_PUBLIC_LIFF_ID: z.string().optional().default(""),

  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(5),

  // Cloudflare R2 / S3 Storage (ถ้าไม่ระบุจะ fallback ไปเก็บที่ UPLOAD_DIR ในเครื่อง)
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET_NAME: z.string().optional().default(""),
  R2_FOLDER: z.string().optional().default(""),

  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

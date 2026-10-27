import { ApiError } from "@/lib/api-error";

/**
 * In-memory rate limiter แบบ sliding window ง่ายๆ
 * เหมาะกับ deployment แบบ single replica (ตาม design.md) ถ้าต้อง scale หลาย replica
 * ในอนาคตให้เปลี่ยนไปใช้ shared store (เช่น Redis) แทน
 */
interface RateLimitBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitOptions {
  /** จำนวนครั้งที่อนุญาตภายในหน้าต่างเวลา */
  limit: number;
  /** ขนาดหน้าต่างเวลา (ms) */
  windowMs: number;
}

/**
 * throw ApiError("RATE_LIMITED") ถ้าเกิน quota ภายในหน้าต่างเวลา
 * @param key ตัวระบุ (เช่น LINE userId หรือ IP) แยก quota ต่อ key
 */
export function checkRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < options.windowMs);

  if (bucket.timestamps.length >= options.limit) {
    throw new ApiError("RATE_LIMITED", "คุณส่งคำขอบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่");
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
}

/** ล้าง bucket ทั้งหมด (ใช้ใน unit test เพื่อไม่ให้ state ค้างข้าม test case) */
export function resetRateLimitStore(): void {
  buckets.clear();
}
